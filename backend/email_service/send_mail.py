import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

HOST = "smtp.gmail.com"
PORT = 587

FROM_EMAIL = "uitexchange.customerservice@gmail.com"
PASSWORD = "zaei jfvf ogqi oyyv"

def send_order_success_email(to_email):
    try:
        message = MIMEMultipart("alternative")
        message['Subject'] = "Order success!!! - UIT Exchange"
        message['From'] = FROM_EMAIL
        message['To'] = to_email

        current_dir = os.path.dirname(os.path.abspath(__file__))
        html_file_path = os.path.join(current_dir, "mail.html")
        
        with open(html_file_path, "r", encoding="utf-8") as file:
            html = file.read()

        html_part = MIMEText(html, 'html')
        message.attach(html_part)

        smtp = smtplib.SMTP(HOST, PORT)
        smtp.ehlo()
        smtp.starttls()
        smtp.login(FROM_EMAIL, PASSWORD)
        smtp.sendmail(FROM_EMAIL, to_email, message.as_string())
        smtp.quit()
        
        print(f"[+] Email successfully sent to {to_email}")
        return True
    except Exception as e:
        print(f"[-] Failed to send email to {to_email}: {e}")
        return False
