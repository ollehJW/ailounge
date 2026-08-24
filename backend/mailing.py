from __future__ import annotations

import base64
import html
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent


def load_env_file(path: Path = BACKEND_DIR / ".env") -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip(chr(34)).strip(chr(39)))


load_env_file()

SENDER_EMAIL = os.getenv("MAIL_SENDER_EMAIL", "")
GMAIL_APP_PASSWORD = os.getenv("MAIL_GMAIL_APP_PASSWORD", "")

SENDER_NAME = os.getenv("MAIL_SENDER_NAME", "AI Lounge")

# This network closes port 587, so use direct SSL on 465 by default.
SMTP_HOST = os.getenv("MAIL_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("MAIL_SMTP_PORT", "465"))
SMTP_TIMEOUT_SECONDS = int(os.getenv("MAIL_SMTP_TIMEOUT_SECONDS", "30"))

logger = logging.getLogger(__name__)

REVIEW_TYPES = {
    "asset": {"title": "AI 자산 등록 심사가 완료되었습니다.", "label": "자산명", "subject": "AI 자산 등록"},
    "idea": {"title": "아이디어 공모 심사가 완료되었습니다.", "label": "아이디어명", "subject": "아이디어 공모"},
}


def require_mail_settings(recipient_email: str) -> None:
    missing = []
    if not SENDER_EMAIL.strip():
        missing.append("SENDER_EMAIL")
    if not GMAIL_APP_PASSWORD.strip():
        missing.append("GMAIL_APP_PASSWORD")
    if not recipient_email.strip() or "@" not in recipient_email or "\r" in recipient_email or "\n" in recipient_email:
        missing.append("recipient_email")
    if missing:
        raise ValueError(f"backend/.env의 메일 설정값을 확인하세요: {', '.join(missing)}")


def build_review_completed_message(recipient_email: str, item_name: str, review_type: str = "asset") -> EmailMessage:
    item_name = " ".join(item_name.split())
    if not item_name:
        raise ValueError("심사 대상 이름을 입력하세요.")
    review = REVIEW_TYPES.get(review_type)
    if review is None:
        raise ValueError("지원하지 않는 심사 유형입니다.")

    review_title = review["title"]
    item_label = review["label"]
    subject_type = review["subject"]
    safe_item_name = html.escape(item_name)
    heading_html = review_title.replace(" 심사가 완료", " 심사가<br>완료")
    subject = f"[AI Lounge] {subject_type} 심사 완료 - {item_name}"
    plain_body = f"""안녕하세요.

{review_title}
{item_label}: {item_name}
상세 내용은 AI Lounge에서 확인해 주세요.

본 메일은 AI Lounge에서 자동 발송되었습니다.
"""
    html_body = f"""<!doctype html>
<html lang="ko">
  <body style="margin:0;padding:0;background:#f3f6fa;font-family:Arial,Malgun Gothic,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6fa;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe6ef;">
            <tr>
              <td style="padding:22px 30px;background:#082a73;border-bottom:4px solid #36a66a;">
                <div style="font-size:20px;line-height:1.2;font-weight:700;color:#ffffff;">AI Lounge</div>
                <div style="margin-top:6px;font-size:11px;line-height:1.4;font-weight:700;color:#b9c9e8;letter-spacing:1.4px;">AI REVIEW NOTIFICATION</div>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 30px 34px;">
                <div style="display:inline-block;padding:6px 10px;border:1px solid #badfc9;background:#edf8f1;color:#23734a;font-size:12px;font-weight:700;">심사 완료</div>
                <h1 style="margin:18px 0 12px;font-size:25px;line-height:1.4;color:#172033;letter-spacing:0;">{heading_html}</h1>
                <p style="margin:0;color:#5c687b;font-size:15px;line-height:1.75;">신청하신 내용의 심사가 완료되었습니다.<br>상세 내용은 AI Lounge에서 확인해 주세요.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border:1px solid #dce4ee;background:#f8fafc;">
                  <tr>
                    <td style="width:88px;padding:17px 18px;color:#718096;font-size:12px;font-weight:700;vertical-align:top;">{item_label}</td>
                    <td style="padding:17px 18px 17px 0;color:#172033;font-size:16px;line-height:1.5;font-weight:700;">{safe_item_name}</td>
                  </tr>
                </table>
                <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e5eaf1;color:#7b8798;font-size:12px;line-height:1.65;">본 메일은 AI Lounge의 심사 절차에 따라 자동 발송되었습니다.</div>
              </td>
            </tr>
          </table>
          <div style="padding-top:16px;color:#9aa5b4;font-size:11px;line-height:1.5;">AI Lounge · DX추진랩</div>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    message = EmailMessage()
    message["From"] = formataddr((SENDER_NAME.strip() or "AI Lounge", SENDER_EMAIL.strip()))
    message["To"] = recipient_email.strip()
    message["Subject"] = subject
    message.set_content(plain_body)
    message.add_alternative(html_body, subtype="html")
    return message


def send_review_completed_email(recipient_email: str, item_name: str, review_type: str = "asset") -> None:
    require_mail_settings(recipient_email)
    message = build_review_completed_message(recipient_email, item_name, review_type)
    app_password = "".join(GMAIL_APP_PASSWORD.split())
    tls_context = ssl.create_default_context()

    logger.info("Gmail SMTP 연결: %s:%s", SMTP_HOST, SMTP_PORT)
    with smtplib.SMTP_SSL(
        SMTP_HOST,
        SMTP_PORT,
        local_hostname="ailounge.local",
        timeout=SMTP_TIMEOUT_SECONDS,
        context=tls_context,
    ) as smtp:
        smtp.helo("ailounge.local")
        logger.info("Gmail SMTP 인증을 시작합니다.")
        credentials = f"\0{SENDER_EMAIL.strip()}\0{app_password}".encode("utf-8")
        auth_token = base64.b64encode(credentials).decode("ascii")
        auth_code, auth_message = smtp.docmd("AUTH", f"PLAIN {auth_token}")
        if auth_code != 235:
            raise smtplib.SMTPAuthenticationError(auth_code, auth_message)
        smtp.send_message(message)

    logger.info("심사 완료 이메일 발송을 완료했습니다. review_type=%s", review_type)


def send_review_completed_email_safely(recipient_email: str, item_name: str, review_type: str = "asset") -> None:
    try:
        send_review_completed_email(recipient_email, item_name, review_type)
    except Exception:
        logger.exception("심사 완료 이메일 발송에 실패했습니다. review_type=%s", review_type)
