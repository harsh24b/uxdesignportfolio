import os
import socket
import http.server
import socketserver

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

STATIC_EXTENSIONS = ('.webp', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.ico',
                     '.otf', '.ttf', '.woff', '.woff2', '.css', '.js', '.mp4')

class FastOptimizedHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        path = self.path.split('?')[0].split('#')[0].lower()
        if path.endswith(STATIC_EXTENSIONS):
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

class DualStackServer(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        return super().server_bind()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = DualStackServer(('::', PORT), FastOptimizedHandler)
        print(f"Dual-stack server running on http://localhost:{PORT}/ and http://127.0.0.1:{PORT}/")
        httpd.serve_forever()
    except Exception as e:
        print(f"Fallback to IPv4: {e}")
        with http.server.ThreadingHTTPServer(('0.0.0.0', PORT), FastOptimizedHandler) as httpd:
            httpd.serve_forever()
