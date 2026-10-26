import http.server
import socketserver
import os
import socket

PORT = 8123
ROOT = os.path.dirname(os.path.abspath(__file__))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        pass


try:
    httpd = socketserver.TCPServer(('0.0.0.0', PORT), Handler)
except OSError:
    print(f'端口 {PORT} 已被占用，可能已在运行，请直接打开 http://127.0.0.1:{PORT}')
    input('按回车键退出…')
    raise SystemExit(0)

print(f'工作台已启动: http://127.0.0.1:{PORT}')
ip = lan_ip()
if ip:
    print(f'手机同 WiFi 访问: http://{ip}:{PORT}')
print('关闭本窗口即可停止服务')
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
