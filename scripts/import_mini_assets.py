#!/usr/bin/env python3
"""Import a curated CC0 Kenney Mini subset and compose the two town landmarks.

Usage: python scripts/import_mini_assets.py --download  (official download)
       node scripts/generate_models.mjs              (offline regeneration)

The official archives are cached in /tmp; only selected GLBs and the exact
licenses enter the project. Textures are embedded, so there are no new runtime
image URLs. Download cookies and expiring links are never written or printed.
"""
import argparse
import hashlib
import http.cookiejar
import io
import json
import math
from pathlib import Path
import re
import struct
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/kenney-mini'
TOWN = ROOT / 'public/models/town-v2'
SELECTED = {
    'mini-shop': ['shelf-boxes', 'display-fruit', 'cash-register'],
    'mini-forest': ['tent', 'tree', 'flag', 'stones'],
}


def read_glb(data):
    magic, version, length = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    jl, jt = struct.unpack_from('<II', data, 12)
    assert jt == 0x4E4F534A
    doc = json.loads(data[20:20 + jl])
    bl, bt = struct.unpack_from('<II', data, 20 + jl)
    assert bt == 0x004E4942
    return doc, bytearray(data[28 + jl:28 + jl + bl])


def write_glb(path, doc, binary):
    doc['buffers'] = [{'byteLength': len(binary)}]
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
                     + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
                     + struct.pack('<II', len(binary), 0x004E4942) + binary)


def import_packs():
    OUT.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    provenance = []
    for pack, names in SELECTED.items():
        cache = Path('/tmp') / (pack + '.zip')
        if not cache.exists():
            page = 'https://kenney.nl/assets/' + pack
            html = opener.open(page).read().decode()
            download_id = re.search(r'data-download-id=["\']([^"\']+)', html).group(1)
            request = urllib.request.Request('https://kenney.nl/download-link/' + download_id,
                                             headers={'Referer': page, 'Accept': 'application/json'})
            link = json.load(opener.open(request))['url']
            cache.write_bytes(opener.open(link).read())
        archive = zipfile.ZipFile(io.BytesIO(cache.read_bytes()))
        (OUT / (pack + '-License.txt')).write_bytes(archive.read('License.txt'))
        for name in names:
            original_path = 'Models/GLB format/' + name + '.glb'
            original = archive.read(original_path)
            doc, binary = read_glb(original)
            for image in doc.get('images', []):
                texture = archive.read('Models/GLB format/' + image.pop('uri'))
                binary += b'\0' * (-len(binary) % 4)
                image['bufferView'] = len(doc['bufferViews'])
                image['mimeType'] = 'image/png'
                doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(texture)})
                binary += texture
            filename = ('shop-' if pack == 'mini-shop' else 'forest-') + name + '.glb'
            write_glb(OUT / filename, doc, binary)
            provenance.append({'file': filename, 'source': 'https://kenney.nl/assets/' + pack,
                               'archivePath': original_path, 'license': pack + '-License.txt',
                               'licenseId': 'CC0-1.0', 'modification': 'Embed the original colormap PNG in GLB; preserve geometry/materials/node transforms',
                               'originalSha256': hashlib.sha256(original).hexdigest(),
                               'distributedSha256': hashlib.sha256((OUT / filename).read_bytes()).hexdigest(),
                               'bytes': (OUT / filename).stat().st_size})
            print(filename, (OUT / filename).stat().st_size, 'bytes')
    (OUT / 'sources.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')


def append_model(target, binary, filename, position, scale, angle=0):
    """Merge GLTF index spaces and preserve original Mini mesh/node transforms."""
    source, blob = read_glb((OUT / filename).read_bytes())
    binary += b'\0' * (-len(binary) % 4)
    offset = len(binary)
    binary += blob
    collections = ['bufferViews', 'accessors', 'images', 'samplers', 'textures', 'materials', 'meshes', 'nodes']
    shifts = {key: len(target.setdefault(key, [])) for key in collections}
    for view in source.get('bufferViews', []):
        view['buffer'] = 0
        view['byteOffset'] = view.get('byteOffset', 0) + offset
    for accessor in source.get('accessors', []):
        accessor['bufferView'] += shifts['bufferViews']
    for image in source.get('images', []):
        assert 'uri' not in image
        image['bufferView'] += shifts['bufferViews']
    for texture in source.get('textures', []):
        texture['source'] += shifts['images']
        if 'sampler' in texture:
            texture['sampler'] += shifts['samplers']
    for material in source.get('materials', []):
        for key in ['baseColorTexture', 'metallicRoughnessTexture']:
            tex = material.get('pbrMetallicRoughness', {}).get(key)
            if tex:
                tex['index'] += shifts['textures']
        for key in ['normalTexture', 'occlusionTexture', 'emissiveTexture']:
            if key in material:
                material[key]['index'] += shifts['textures']
    for mesh in source.get('meshes', []):
        for primitive in mesh['primitives']:
            primitive['attributes'] = {k: v + shifts['accessors'] for k, v in primitive['attributes'].items()}
            for key, space in [('indices', 'accessors'), ('material', 'materials')]:
                if key in primitive:
                    primitive[key] += shifts[space]
    for node in source.get('nodes', []):
        if 'mesh' in node:
            node['mesh'] += shifts['meshes']
        if 'children' in node:
            node['children'] = [i + shifts['nodes'] for i in node['children']]
    roots = [i + shifts['nodes'] for i in source['scenes'][source.get('scene', 0)]['nodes']]
    for key in collections:
        target[key].extend(source.get(key, []))
    target['scenes'][0]['nodes'].append(len(target['nodes']))
    target['nodes'].append({'name': 'Kenney ' + filename[:-4], 'children': roots,
                            'translation': position, 'scale': [scale] * 3,
                            'rotation': [0, math.sin(angle / 2), 0, math.cos(angle / 2)]})


def compose():
    # Models face the -Z street. Contents sit in front of the rear wall,
    # with an unobstructed opening to keep real miniature goods visible.
    scenes = {
        'shop': [
            ('shop-shelf-boxes.glb', [-.95, .18, .60], 1.65, 0),
            ('shop-display-fruit.glb', [1.12, .18, -.85], 1.7, 0),
            ('shop-cash-register.glb', [-.75, .18, -1.05], 1.5, 0),
        ],
        'camp': [
            # Mini Forest's entrance faces +Z; turn it toward the -Z street
            # so the fixed town/viewer camera sees the open tent front.
            ('forest-tent.glb', [-.45, .14, -.10], 2.0, math.pi),
            ('forest-tree.glb', [1.12, .14, .95], 1.5, 0),
            ('forest-tree.glb', [-1.25, .14, 1.0], 1.25, 0),
            ('forest-flag.glb', [1.25, .14, -.50], 1.75, 0),
            ('forest-stones.glb', [-1.35, .14, -1.1], .9, 0),
        ],
    }
    for name, props in scenes.items():
        path = TOWN / (name + '.glb')
        doc, binary = read_glb(path.read_bytes())
        for args in props:
            append_model(doc, binary, *args)
        doc['asset']['copyright'] = 'Original town shell; Mini props by Kenney, CC0 1.0'
        write_glb(path, doc, binary)
        print(name + '.glb (with Kenney Mini)', path.stat().st_size, 'bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--compose', action='store_true')
    args = parser.parse_args()
    if args.download:
        import_packs()
    if args.compose:
        compose()
