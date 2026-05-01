import os
import threading
import json
import urllib.request
from urllib.error import URLError, HTTPError

from flask import jsonify



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
        # Get env vars at runtime to ensure dotenv has already loaded .env
        resend_api_key = os.getenv("RESEND_API_KEY", "")
        from_email = os.getenv("RESEND_FROM_EMAIL", "")
        
        if not resend_api_key:
            print("[-] Resend API key is missing.")
            return False
            
        url = "https://api.resend.com/emails"
        
        payload = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        data = json.dumps(payload).encode("utf-8")
        
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Authorization", f"Bearer {resend_api_key}")
        req.add_header("Content-Type", "application/json")
        
        # THÊM DÒNG NÀY ĐỂ VƯỢT QUA LỚP BẢO VỆ 1010
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

        with urllib.request.urlopen(req, timeout=15) as response:
            # ... (xử lý phản hồi) ...
            print(f"[+] Email successfully sent to {to_email}", flush=True)
            return True
            
    except HTTPError as e:
        print(f"[-] Failed to send email to {to_email}: HTTP Error {e.code} - {e.read().decode('utf-8')}")
        return False
    except URLError as e:
        print(f"[-] Failed to send email to {to_email}: URL Error - {e.reason}")
        return False
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

    subject = f"UIT Exchange - Xác nhận đơn hàng #{context['productId']}"
    thread = threading.Thread(
        target=_send_email, 
        args=(to_email, subject, html)
    )
    thread.start()
    return True

def send_report_email(admin_emails, report_data):
    context = {
        "productId": report_data.get("productId", "N/A"),
        "reporterUsername": report_data.get("reporterUsername", "anonymous"),
        "reason": report_data.get("reason", ""),
        "driveLink": report_data.get("driveLink", "#"),
    }
    html = _render_template("report.html", context)
    subject = f"UIT Exchange - Báo cáo vi phạm SP #{context['productId']}"

    # Định nghĩa một hàm thực thi việc gửi mail (hỗ trợ cả list và string)
    def background_task():
        if isinstance(admin_emails, list):
            for email in admin_emails:
                _send_email(email, subject, html)
        else:
            _send_email(admin_emails, subject, html)

    # Chạy toàn bộ quá trình lặp và gửi mail ở luồng riêng
    thread = threading.Thread(target=background_task)
    thread.start()

    # Trả về True ngay lập tức để giải phóng tài nguyên cho Server
    return True

def send_report_seller_email(seller, report_data, admin_emails=None):
    context = {
        "productId": report_data.get("productId", "N/A"),
        "reporterUsername": report_data.get("reporterUsername", "anonymous"),
        "reason": report_data.get("reason", ""),
        "driveLink": report_data.get("driveLink", "#"),
    }
    html = _render_template("report.html", context)
    subject = f"UIT Exchange - Báo cáo vi phạm SP #{context['productId']}"

    def bg_task():
        # Gửi cho admin nếu có
        if admin_emails:
            if isinstance(admin_emails, list):
                for email in admin_emails:
                    _send_email(email, subject, html)
            else:
                _send_email(admin_emails, subject, html)
        # Gửi cho người bán
        _send_email(seller, subject, html)

    threading.Thread(target=bg_task).start()
    return True


def send_verification_request_email(admin_emails, user_data):
    context = {
        "username": user_data.get("username", "N/A"),
        "fullName": user_data.get("fullName", "N/A"),
        "email": user_data.get("email", "N/A"),
        "phone": user_data.get("phone", "N/A"),
        "studentId": user_data.get("studentId", "N/A"),
    }
    html = _render_template("request.html", context)
    subject = f"UIT Exchange - Yêu cầu xác minh tài khoản @{context['username']}"

    def bg_task():
        if isinstance(admin_emails, list):
            for email in admin_emails:
                _send_email(email, subject, html)
        else:
            _send_email(admin_emails, subject, html)

    threading.Thread(target=bg_task).start()
    return True

def send_forgot_password_email(to_email, code):
    context = {"reset-code": code}
    html = _render_template("forgotpass.html", context)
    subject = "UIT Exchange - Mã khôi phục mật khẩu"
    
    threading.Thread(target=_send_email, args=(to_email, subject, html)).start()
    return True

def send_order_seller_email(to_email, order_data):
    # Dùng logic nối chuỗi an toàn để không bị lỗi "nhuộm xanh" code
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
              <p style="color: #43474e; font-size: 12px; margin: 0">Số lượng: {item.get('qty', 1)}</p>
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
    subject = f"UIT Exchange - Thông báo đơn hàng mới #{order_data.get('orderId', 'N/A')}"
    
    threading.Thread(target=_send_email, args=(to_email, subject, html)).start()
    return True

def send_refund_email(to_email, context):
    html = _render_template("refund.html", context)
    subject = f"UIT Exchange - Yêu cầu hoàn trả sản phẩm #{context.get('productId')}"
    
    threading.Thread(target=_send_email, args=(to_email, subject, html)).start()
    return True
