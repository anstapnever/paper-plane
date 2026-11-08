# Renders the unique faces of a bake with the v2 face drawer (headless Chrome) and lays out one PNG per frame per mascot:
# out/faces_<name>/face_0001.png ... (Blender plays them as an image sequence).   python faces.py <project dir>
import sys, json, base64, os, shutil, http.server, threading, functools
from playwright.sync_api import sync_playwright
proj = os.path.abspath(sys.argv[1]); bake = json.load(open(os.path.join(proj, 'out', 'bake.json'), encoding='utf-8'))
here = os.path.dirname(os.path.abspath(__file__)); uq = os.path.join(proj, 'out', 'faces_unique'); os.makedirs(uq, exist_ok=True)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=here)); threading.Thread(target=srv.serve_forever, daemon=True).start()
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME', r'C:\Program Files\Google\Chrome\Application\chrome.exe'), args=['--headless=new'])
    pg = b.new_page(); pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/face_export.html'); pg.wait_for_function('window.__ok')
    for fid, f in bake['faces'].items():
        url = pg.evaluate('(f) => window.renderFace(f)', f); open(os.path.join(uq, fid + '.png'), 'wb').write(base64.b64decode(url.split(',')[1]))
    b.close()
srv.shutdown()
for name, seq in bake['faceSeq'].items():
    d = os.path.join(proj, 'out', 'faces_' + name); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    for i, fid in enumerate(seq): shutil.copyfile(os.path.join(uq, fid + '.png'), os.path.join(d, 'face_%04d.png' % (i + 1)))
print('faces', len(bake['faces']), 'unique,', {k: len(v) for k, v in bake['faceSeq'].items()})
