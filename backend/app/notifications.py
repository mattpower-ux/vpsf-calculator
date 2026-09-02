import smtplib
from email.message import EmailMessage

from app.config import Settings


def send_email(settings: Settings, *, subject: str, body: str, recipient: str | None = None) -> bool:
    if not settings.smtp_host or not settings.alert_email_from:
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.alert_email_from
    message["To"] = recipient or settings.alert_email_to
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)

    return True
