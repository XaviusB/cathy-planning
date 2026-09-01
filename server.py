"""
Serveur de développement local pour cathy-planning.
Usage : python server.py [port]
"""

import http.server
import socketserver
import sys
import os
import webbrowser
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500

# Force le bon MIME type pour les modules ES (.js) et autres assets
MIME_OVERRIDES = {
    ".js":   "application/javascript",
    ".mjs":  "application/javascript",
    ".css":  "text/css",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
}

class DevHandler(http.server.SimpleHTTPRequestHandler):

    def guess_type(self, path):
        ext = Path(path).suffix.lower()
        return MIME_OVERRIDES.get(ext, super().guess_type(path))

    def log_message(self, fmt, *args):
        # Colorise la sortie console (args can be strings or HTTPStatus objects)
        first = str(args[0]) if args else ""
        code = str(args[1]) if len(args) > 1 else ""
        color = "\033[32m" if code.startswith("2") else "\033[33m" if code.startswith("3") else "\033[31m"
        reset = "\033[0m"
        print(f"  {color}{code}{reset}  {first}")

    def end_headers(self):
        # Headers utiles pour le dev local
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def main():
    os.chdir(Path(__file__).parent)

    with socketserver.TCPServer(("", PORT), DevHandler) as httpd:
        httpd.allow_reuse_address = True
        url = f"http://localhost:{PORT}"
        print(f"\n  🚀  Serveur démarré sur {url}")
        print(f"  📁  Dossier : {Path.cwd()}")
        print(f"  ⌨️   Ctrl+C pour arrêter\n")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Serveur arrêté.")


if __name__ == "__main__":
    main()
