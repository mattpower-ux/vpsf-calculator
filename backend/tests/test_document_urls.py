import socket
import pytest
from fastapi import HTTPException
from app.ocr.document_urls import public_destination, download_document

@pytest.mark.parametrize('url', ['file:///tmp/a.pdf','http://example.com/a.pdf','https://u:p@example.com/a.pdf','https://example.com:8443/a.pdf'])
def test_unsafe_url_forms_rejected(url):
    with pytest.raises(HTTPException): public_destination(url)

@pytest.mark.parametrize('address', ['127.0.0.1','10.1.1.1','169.254.169.254','::1','::ffff:127.0.0.1'])
def test_private_dns_rejected(monkeypatch,address):
    monkeypatch.setattr(socket,'getaddrinfo',lambda *a,**k:[(2,1,6,'',(address,443))])
    with pytest.raises(HTTPException): public_destination('https://example.com/a.pdf')

def test_public_destination_pins_validated_ip(monkeypatch):
    monkeypatch.setattr(socket,'getaddrinfo',lambda *a,**k:[(2,1,6,'',('93.184.216.34',443))])
    host, ip, path = public_destination('https://example.com/document?id=1')
    assert (host,ip,path)==('example.com','93.184.216.34','/document?id=1')

def install_download(monkeypatch, responses):
    from app.ocr import document_urls as module
    monkeypatch.setattr(socket,'getaddrinfo',lambda host,*a,**k:[(2,1,6,'',('127.0.0.1' if host=='internal.test' else '93.184.216.34',443))])
    requests=[]
    class Connection:
        sock=None
        def __init__(self,host,ip,timeout): requests.append((host,ip))
        def connect(self): pass
        def request(self,*a,**kw): pass
        def getresponse(self): return responses.pop(0)
        def close(self): pass
    monkeypatch.setattr(module,'PinnedHTTPSConnection',Connection)
    return requests

class Response:
    def __init__(self,body=b'',status=200,headers=None):
        from io import BytesIO
        self.body=BytesIO(body); self.status=status; self.headers=headers or {'Content-Type':'text/plain'}
    def getheader(self,key,default=None): return self.headers.get(key,default)
    def read1(self,size): return self.body.read(size)

def test_redirect_to_private_network_is_blocked(monkeypatch):
    calls=install_download(monkeypatch,[Response(status=302,headers={'Location':'https://internal.test/report.txt'})])
    with pytest.raises(HTTPException): download_document('https://public.test/report.txt')
    assert len(calls)==1

def test_download_stream_limit_and_html_rejection(monkeypatch):
    from app.ocr import document_urls as module
    monkeypatch.setattr(module,'MAX_BYTES',10)
    install_download(monkeypatch,[Response(b'12345678901')])
    with pytest.raises(HTTPException) as error: download_document('https://public.test/report.txt')
    assert error.value.status_code==413
    install_download(monkeypatch,[Response(b'<html>',headers={'Content-Type':'text/html'})])
    with pytest.raises(HTTPException) as error: download_document('https://public.test/report.pdf')
    assert error.value.status_code==415

def test_url_route_reuses_extraction_without_saving(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers.properties import router
    install_download(monkeypatch,[Response(b'Address: 12 Example Street\nBuilt: 2008\n1,400 sq ft\n3 beds')])
    app=FastAPI(); app.include_router(router)
    response=TestClient(app).post('/api/properties/ocr-url',json={'url':'https://public.test/download'})
    assert response.status_code==200
    assert response.json()['address']=='12 Example Street'
    assert response.json()['squareFeet']=='1400'
    assert response.json()['bathrooms']==''
