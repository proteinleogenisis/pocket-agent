#!/usr/bin/env python3
"""Regenerates sw.js with the current file list and a content hash, so every deploy updates offline caches."""
import hashlib, json, os, shutil, subprocess, sys, tempfile
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.chdir(root)
skip_dirs = ('.git', 'tests', 'tools', 'node_modules', 'models')
files = []
for d, _, fs in os.walk('.'):
    rel = os.path.relpath(d, '.')
    if rel.split(os.sep)[0] in skip_dirs: continue
    for f in fs:
        p = os.path.normpath(os.path.join(rel, f))
        if f.startswith('.') or f.endswith('.map') or f.endswith('.shortcut') or p in ('sw.js', 'README.md') or f.startswith('LICENSE'): continue
        files.append(p)
files.sort()
# Syntax-check every app module with Node (if installed) so a broken file never ships.
if shutil.which('node'):
    bad = []
    for p in [f for f in files if f.startswith('js/')] + ['tests/tasks.js']:
        with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False) as t: t.write(open(p).read())
        r = subprocess.run(['node', '--check', t.name], capture_output=True, text=True); os.unlink(t.name)
        if r.returncode: bad.append(f"{p}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'error'}")
    if bad: sys.exit('Syntax errors:\n' + '\n'.join(bad))
h = hashlib.sha256()
for p in files: h.update(p.encode()); h.update(open(p, 'rb').read())
ver = h.hexdigest()[:12]
tpl = open('tools/sw.template.js').read()
open('sw.js', 'w').write(tpl.replace('__VERSION__', ver).replace('__FILES__', json.dumps(['./'] + files, indent=2)))
print(f'sw.js: {len(files)} files, version {ver}')
