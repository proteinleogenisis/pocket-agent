#!/usr/bin/env python3
"""Regenerates sw.js with the current file list and a content hash, so every deploy updates offline caches."""
import hashlib, json, os, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.chdir(root)
skip_dirs = ('.git', 'tests', 'tools', 'node_modules', 'models')
files = []
for d, _, fs in os.walk('.'):
    rel = os.path.relpath(d, '.')
    if rel.split(os.sep)[0] in skip_dirs: continue
    for f in fs:
        p = os.path.normpath(os.path.join(rel, f))
        if f.startswith('.') or f.endswith('.map') or p in ('sw.js', 'README.md') or f.startswith('LICENSE'): continue
        files.append(p)
files.sort()
h = hashlib.sha256()
for p in files: h.update(p.encode()); h.update(open(p, 'rb').read())
ver = h.hexdigest()[:12]
tpl = open('tools/sw.template.js').read()
open('sw.js', 'w').write(tpl.replace('__VERSION__', ver).replace('__FILES__', json.dumps(['./'] + files, indent=2)))
print(f'sw.js: {len(files)} files, version {ver}')
