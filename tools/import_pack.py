"""Import the Poly Haven pack: textures → client/public/assets/pbr (1k jpg, normal+arm), HDRIs → assets/hdr (downsized),
models → assets/props/<id>/ with textures shrunk to 512 px (mobile-friendly) and a manifest.json.
Usage: python3 -I import_pack.py <unzipped pack dir>"""
import json, os, shutil, sys
from PIL import Image
SRC = sys.argv[1]; DST = '/home/claude/awd3/client/public/assets'
os.makedirs(f'{DST}/pbr', exist_ok=True); os.makedirs(f'{DST}/props', exist_ok=True); os.makedirs(f'{DST}/hdr', exist_ok=True)
def shrink(src, dst, px, q=82):
    im = Image.open(src); im.thumbnail((px, px), Image.LANCZOS)
    if im.mode not in ('RGB', 'L'): im = im.convert('RGB')
    im.save(dst, 'JPEG', quality=q, optimize=True)
# textures
n = 0
for f in sorted(os.listdir(f'{SRC}/tex')):
    if not f.endswith('.jpg'): continue
    base, kind = f[:-4].rsplit('_', 1) if not f.endswith('_nor_gl.jpg') else (f[:-11], 'nor')
    kind = {'Diffuse': 'diff', 'nor': 'nor', 'arm': 'arm'}.get(kind)
    if not kind: continue
    shrink(f'{SRC}/tex/{f}', f'{DST}/pbr/{base}_{kind}.jpg', 1024, 80); n += 1
print('textures', n)
# hdris (keep as .hdr; three's RGBELoader reads them; already 1k from the pack)
for f in os.listdir(f'{SRC}/hdr'):
    shutil.copy(f'{SRC}/hdr/{f}', f'{DST}/hdr/{f}')
print('hdr', os.listdir(f'{DST}/hdr'))
# models
man = []
for mid in sorted(os.listdir(f'{SRC}/models')):
    d = f'{SRC}/models/{mid}'; g = f'{d}/{mid}.gltf'
    if not os.path.exists(g): continue
    out = f'{DST}/props/{mid}'; os.makedirs(out, exist_ok=True)
    gl = json.load(open(g))
    for im in gl.get('images', []):
        uri = im['uri']; src = f'{d}/{uri}'
        if not os.path.exists(src): continue
        newuri = os.path.splitext(uri)[0].replace('/', '_') + '.jpg'
        shrink(src, f'{out}/{newuri}', 512, 80); im['uri'] = newuri; im.pop('mimeType', None)
    for b in gl.get('buffers', []):
        shutil.copy(f'{d}/{b["uri"]}', f'{out}/{b["uri"]}')
    json.dump(gl, open(f'{out}/{mid}.gltf', 'w'))
    man.append({'id': mid})
json.dump(man, open(f'{DST}/props/manifest.json', 'w'))
print('models', len(man))
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(f'{DST}/props') for f in fs)
print('props MB', round(tot / 1e6, 1))
