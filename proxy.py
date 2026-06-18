from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import socket
import ssl

PORT = 3001

# 兼容部分环境的SSL证书验证问题
ssl._create_default_https_context = ssl._create_unverified_context

class ProxyHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status_code=200, content_type="application/json; charset=utf-8"):
        self.send_response(status_code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, *")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)
        return

    def do_HEAD(self):
        self._set_headers(200)
        return

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            # 兼容多种路径格式
            if parsed.path.rstrip('/') not in ("", "/api/proxy"):
                self._set_headers(404)
                self.wfile.write(b'{"ok":false,"msg":"not found"}')
                return

            query = urllib.parse.parse_qs(parsed.query)
            type_val = query.get("type", ["normal"])[0]

            if type_val == "r18":
                target = "https://i.mukyu.ru/random?r18=1&format=json"
            else:
                target = "https://i.mukyu.ru/random?format=json"

            req = urllib.request.Request(
                target,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Referer": "https://i.mukyu.ru/"
                }
            )

            # 上游请求10秒超时，避免长时间卡住
            resp = urllib.request.urlopen(req, timeout=10)
            body = resp.read()
            self._set_headers(200, resp.headers.get("Content-Type", "application/json; charset=utf-8"))
            self.wfile.write(body)
            print(f"[OK] 转发成功 type={type_val}")

        except socket.timeout:
            print("[ERR] 上游请求超时")
            self._set_headers(504)
            self.wfile.write(b'{"ok":false,"msg":"upstream timeout"}')
        except Exception as e:
            print(f"[ERR] {str(e)}")
            self._set_headers(500)
            self.wfile.write(b'{"ok":false,"msg":"proxy error"}')

    # 关闭默认访问日志，只保留关键错误/成功日志
    def log_message(self, format, *args):
        return

if __name__ == "__main__":
    try:
        server = HTTPServer(("127.0.0.1", PORT), ProxyHandler)
        print("=" * 50)
        print("  本地代理服务启动成功")
        print(f"  监听地址: http://127.0.0.1:{PORT}")
        print(f"  测试地址: http://127.0.0.1:{PORT}/api/proxy?type=normal")
        print("=" * 50)
        server.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"[错误] 端口 {PORT} 已被占用，请修改PORT后重试")
        else:
            print(f"[错误] 启动失败: {str(e)}")
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.shutdown()