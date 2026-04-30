import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
PORT = int(os.getenv("SMTP_PORT", "587"))

FROM_EMAIL = os.getenv("SMTP_USER", "")
PASSWORD = os.getenv("SMTP_PASS", "")

def _render_template(template_name, context):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, template_name)
    with open(file_path, "r", encoding="utf-8") as f:
        html = f.read()
    
    for key, value in context.items():
        html = html.replace(f"{{{{ {key} }}}}", str(value))

    return html

def _send_email(to_email, subject, html_content):
    try:
        if not FROM_EMAIL or not PASSWORD:
            print("[-] SMTP credentials are missing (SMTP_USER/SMTP_PASS).")
            return False
        message = MIMEMultipart("alternative")
        message['Subject'] = subject
        message['From'] = FROM_EMAIL
        message['To'] = to_email

        html_part = MIMEText(html_content, 'html')
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

def send_order_success_email(to_email, order_data):
    # Construct items HTML
    items_html = ""
    for item in order_data.get("items", []):
        items_html += f"""
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px">
          <tr>
            <td width="80" valign="top" style="padding-right: 16px">
              <img src="{item.get('imageUrl', '')}" alt="{item.get('name', '')}" width="80" height="80" style="display: block; border-radius: 6px; background-color: #eff4ff; object-fit: cover;"/>
            </td>
            <td valign="top">
              <h3 style="color: #0b1c30; font-size: 16px; font-weight: 600; margin: 0 0 4px 0;">{item.get('name', '')}</h3>
              <p style="color: #43474e; font-size: 12px; margin: 0">Quantity: {item.get('qty', 1)}</p>
            </td>
            <td valign="top" align="right" style="color: #0b1c30; font-size: 16px; font-weight: bold;">{item.get('lineTotal', '0đ')}</td>
          </tr>
        </table>
        """
    
    context = {
        "productId": order_data.get("productId", "N/A"),
        "items": items_html,
        "subtotal": order_data.get("subtotal", "0đ"),
        "shipping": order_data.get("shipping", "0đ"),
        "total": order_data.get("total", "0đ"),
        "deliveryAddress": order_data.get("deliveryAddress", "N/A"),
        "paymentMethod": order_data.get("paymentMethod", "N/A"),
    }
    
    html = _render_template("order.html", context)
    return _send_email(to_email, f"UIT Exchange - Xác nhận đơn hàng #{context['productId']}", html)

def send_report_email(admin_emails, report_data):
    context = {
        "productId": report_data.get("productId", "N/A"),
        "reporterUsername": report_data.get("reporterUsername", "anonymous"),
        "reason": report_data.get("reason", ""),
        "driveLink": report_data.get("driveLink", "#"),
    }
    html = _render_template("report.html", context)
    
    # If admin_emails is a list, join them or send individually. 
    # For now, we'll try to send as a comma-separated string or just a single one.
    if isinstance(admin_emails, list):
        success = True
        for email in admin_emails:
            if not _send_email(email, f"UIT Exchange - Báo cáo vi phạm SP #{context['productId']}", html):
                success = False
        return success
    return _send_email(admin_emails, f"UIT Exchange - Báo cáo vi phạm SP #{context['productId']}", html)

def send_report_seller_email(seller, report_data, admin_emails=None):
    context = {
        "productId": report_data.get("productId", "N/A"),
        "reporterUsername": report_data.get("reporterUsername", "anonymous"),
        "reason": report_data.get("reason", ""),
        "driveLink": report_data.get("driveLink", "#"),
    }
    html = _render_template("report.html", context)

    success = True
    # Gửi cho admin nếu có
    if admin_emails:
        if isinstance(admin_emails, list):
            for email in admin_emails:
                if not _send_email(email, f"UIT Exchange - Báo cáo vi phạm SP #{context['productId']}", html):
                    success = False
        else:
            if not _send_email(admin_emails, f"UIT Exchange - Báo cáo vi phạm SP #{context['productId']}", html):
                success = False
    # Gửi cho người bán
    if not _send_email(seller, f"UIT Exchange - Báo cáo vi phạm SP #{context['productId']}", html):
        success = False
    return success

def send_verification_request_email(admin_emails, user_data):
    context = {
        "username": user_data.get("username", "N/A"),
        "fullName": user_data.get("fullName", "N/A"),
        "email": user_data.get("email", "N/A"),
        "phone": user_data.get("phone", "N/A"),
        "studentId": user_data.get("studentId", "N/A"),
    }
    html = _render_template("request.html", context)
    
    if isinstance(admin_emails, list):
        success = True
        for email in admin_emails:
            if not _send_email(email, f"UIT Exchange - Yêu cầu xác minh tài khoản @{context['username']}", html):
                success = False
        return success
    return _send_email(admin_emails, f"UIT Exchange - Yêu cầu xác minh tài khoản @{context['username']}", html)

def send_forgot_password_email(to_email, code):
    context = {
        "reset-code": code
    }
    html = _render_template("forgotpass.html", context)
    return _send_email(to_email, "UIT Exchange - Mã khôi phục mật khẩu", html)

def send_order_seller_email(to_email, order_data):
    # Construct items HTML
    items_html = ""
    for item in order_data.get("items", []):
        items_html += f"""
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px">
          <tr>
            <td width="80" valign="top" style="padding-right: 16px">
              <img src="{item.get('imageUrl', '')}" alt="{item.get('name', '')}" width="80" height="80" style="display: block; border-radius: 6px; background-color: #eff4ff; object-fit: cover;"/>
            </td>
            <td valign="top">
              <h3 style="color: #0b1c30; font-size: 16px; font-weight: 600; margin: 0 0 4px 0;">{item.get('name', '')}</h3>
              <p style="color: #43474e; font-size: 12px; margin: 0">Quantity: {item.get('qty', 1)}</p>
            </td>
            <td valign="top" align="right" style="color: #0b1c30; font-size: 16px; font-weight: bold;">{item.get('lineTotal', '0đ')}</td>
          </tr>
        </table>
        """
    
    context = {
        "productId": order_data.get("productId", "N/A"),
        "items": items_html,
        "subtotal": order_data.get("subtotal", "0đ"),
        "shipping": order_data.get("shipping", "0đ"),
        "total": order_data.get("total", "0đ"),
        "deliveryAddress": order_data.get("deliveryAddress", "N/A"),
        "paymentMethod": order_data.get("paymentMethod", "N/A"),
    }
    
    html = _render_template("order_seller.html", context)
    return _send_email(to_email, f"UIT Exchange - Thông báo đơn hàng mới #{order_data.get('orderId', 'N/A')}", html)

def send_refund_email(to_email, context):
    html = _render_template("refund.html", context)
    return _send_email(to_email, f"UIT Exchange - Yêu cầu hoàn trả sản phẩm #{context.get('productId')}", html)
