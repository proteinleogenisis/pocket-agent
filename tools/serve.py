#!/usr/bin/env python3
"""Local dev server with caching disabled, so tests always run the current files."""
import functools, http.server, os, sys
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(('', port), functools.partial(NoCache, directory=root)).serve_forever()
