"""Bounded public document downloads; validated DNS addresses are pinned per hop."""
import asyncio
import http.client
import ipaddress
import socket
import ssl
import time
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore, Timer
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit, urljoin, unquote
from fastapi import HTTPException, UploadFile
from .extractor import extract_property_from_upload

MAX_BYTES = 10 * 1024 * 1024
TYPES = {'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png','text/plain':'.txt'}
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix='document-url')
_slots = BoundedSemaphore(4)

def interrupt_socket(sock):
    try:
        sock.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass

def public_destination(url):
    try:
        parsed = urlsplit(url)
        if (len(url) > 4096 or parsed.scheme != 'https' or not parsed.hostname
                or parsed.username or parsed.password or parsed.port not in (None,443)
                or any(ord(c) < 32 for c in url)):
            raise ValueError()
        host = parsed.hostname.encode('idna').decode('ascii')
        addresses = [row[4][0] for row in socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)]
        if not addresses or any(not ipaddress.ip_address(ip).is_global for ip in addresses):
            raise ValueError()
        path = parsed.path or '/'
        if parsed.query: path += '?' + parsed.query
        return host, addresses[0], path
    except (ValueError, UnicodeError, OSError):
        raise HTTPException(400,'Use a publicly accessible HTTPS document link. Private network addresses and login links are not supported.')

class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, ip, timeout):
        super().__init__(host,timeout=timeout,context=ssl.create_default_context())
        self.ip = ip
    def connect(self):
        raw = socket.create_connection((self.ip,443),timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw,server_hostname=self.host)
        except BaseException:
            raw.close()
            raise

def download_document(url):
    deadline = time.monotonic() + 30
    try:
        for _ in range(4):
            host, ip, path = public_destination(url)
            remaining = deadline - time.monotonic()
            if remaining <= 0: raise TimeoutError()
            connection = PinnedHTTPSConnection(host,ip,min(15,remaining))
            timer = None
            try:
                connection.connect()
                remaining = deadline - time.monotonic()
                if remaining <= 0: raise TimeoutError()
                timer = Timer(remaining, interrupt_socket, args=(connection.sock,))
                timer.daemon = True
                timer.start()
                connection.request('GET',path,headers={'Accept':'application/pdf,image/png,image/jpeg,text/plain','Accept-Encoding':'identity','User-Agent':'VPSF-Document-Reader/1.0'})
                response = connection.getresponse()
                if response.status in (301,302,303,307,308):
                    location = response.getheader('Location')
                    if not location: raise HTTPException(422,'This document link redirects without a destination.')
                    url = urljoin(url,location)
                    continue
                if response.status != 200:
                    raise HTTPException(422,'The document link could not be opened. Use a direct public file link or choose the file from your device.')
                content_type = response.getheader('Content-Type','').split(';')[0].lower().strip()
                suffix = Path(unquote(urlsplit(url).path)).suffix.lower()
                if content_type in TYPES: suffix = TYPES[content_type]
                elif content_type not in ('application/octet-stream','') or suffix not in ('.pdf','.png','.jpg','.jpeg','.txt'):
                    raise HTTPException(415,'This link is not a PDF, JPG, PNG, or TXT document. Download the file and select it from your device instead.')
                length = response.getheader('Content-Length','')
                if length.isdigit() and int(length) > MAX_BYTES: raise HTTPException(413,'Each document must be smaller than 10 MB.')
                data = bytearray()
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0: raise TimeoutError()
                    if connection.sock: connection.sock.settimeout(min(15,remaining))
                    chunk = response.read1(min(65536,MAX_BYTES+1-len(data)))
                    if not chunk: break
                    data.extend(chunk)
                    if len(data) > MAX_BYTES: raise HTTPException(413,'Each document must be smaller than 10 MB.')
                if not data: raise HTTPException(422,'The document is empty.')
                return bytes(data), 'linked-document'+suffix
            finally:
                if timer: timer.cancel()
                connection.close()
        raise HTTPException(422,'This document link redirects too many times. Use the direct file link.')
    except (OSError,http.client.HTTPException,UnicodeError):
        raise HTTPException(422,'The document could not be downloaded. Check the link or upload the file from your device.')

async def extract_property_from_url(url):
    if not _slots.acquire(blocking=False):
        raise HTTPException(429, 'Document reading is busy. Please try again shortly.')
    try:
        future = _pool.submit(download_document, url)
    except BaseException:
        _slots.release()
        raise
    future.add_done_callback(lambda _: _slots.release())
    try:
        contents, filename = await asyncio.wait_for(asyncio.wrap_future(future), timeout=35)
    except TimeoutError:
        raise HTTPException(422, 'Document download timed out. Upload the file from your device instead.') from None
    file = UploadFile(filename=filename,file=BytesIO(contents))
    try:
        return await extract_property_from_upload(file)
    finally:
        await file.close()
