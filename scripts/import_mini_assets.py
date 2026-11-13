#!/usr/bin/env python3
"""Import a curated CC0 Kenney Mini subset and compose the two town landmarks.

Usage: python scripts/import_mini_assets.py --download  (official download)
       node scripts/generate_models.mjs              (offline regeneration)

The official archives are cached in /tmp; only selected GLBs and the exact
licenses enter the project. Textures are embedded, so there are no new runtime
image URLs. Download cookies and expiring links are never written or printed.
"""
import argparse
import copy
import hashlib
import http.cookiejar
import io
import json
import math
from pathlib import Path
import re
import shutil
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


def append_model(target, binary, filename, position, scale, angle=0, material_policy=None):
    """Merge GLTF index spaces and preserve original Mini mesh/node transforms."""
    source, blob = read_glb((OUT / filename).read_bytes())
    if material_policy == 'matte-cloth':
        # Nature's legacy color-only export encodes even fabric/wood metallic=1.
        # Its official tent preview is matte; keep colors/roughness, correct only
        # these three materials on this explicitly identified source layer.
        for material in source.get('materials', []):
            material['pbrMetallicRoughness']['metallicFactor'] = 0
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


def extract_camp_base():
    """Cache only the old project base, never previously appended Kenney props."""
    path = TOWN / '_sources/camp-base.glb'
    if path.exists():
        return path
    doc, blob = read_glb((TOWN / 'camp.glb').read_bytes())
    source_mesh = doc['meshes'][next(n['mesh'] for n in doc['nodes'] if n.get('name') == 'camp')]
    result = {'asset': {'version': '2.0', 'generator': 'extract_camp_base',
        'copyright': 'Project-authored camp base/crate/stools only'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'camp', 'mesh': 0}],
        'meshes': [{'name': 'camp base', 'primitives': []}], 'accessors': [], 'bufferViews': [], 'materials': []}
    binary = bytearray()
    for primitive in source_mesh['primitives']:
        p = copy.deepcopy(primitive)
        for key, index in list(p['attributes'].items()) + [('indices', p['indices'])]:
            a = copy.deepcopy(doc['accessors'][index]); view = copy.deepcopy(doc['bufferViews'][a['bufferView']])
            start = view.get('byteOffset', 0)
            binary += b'\0' * (-len(binary) % 4)
            view.update(buffer=0, byteOffset=len(binary))
            binary += blob[start:start + view['byteLength']]
            a['bufferView'] = len(result['bufferViews']); result['bufferViews'].append(view)
            dest = len(result['accessors']); result['accessors'].append(a)
            if key == 'indices':
                p['indices'] = dest
            else:
                p['attributes'][key] = dest
        p['material'] = len(result['materials'])
        result['materials'].append(copy.deepcopy(doc['materials'][primitive['material']]))
        result['meshes'][0]['primitives'].append(p)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_glb(path, result, binary)
    return path


def compose_camp(library=None):
    base = extract_camp_base()
    source = OUT / '_sources/nature-kit/tent_smallOpen.glb'
    if not source.exists():
        library = library or Path('/workspace/kenney-3d-library/2026-11-12')
        original = library / 'packs/nature-kit/original'
        source.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original / 'Models/GLTF format/tent_smallOpen.glb', source)
        shutil.copyfile(original / 'License.txt', OUT / 'nature-kit-License.txt')
    doc, binary = read_glb(base.read_bytes())
    # Raise the crate/stools from the underside onto the 14cm platform, then
    # keep their complete geometry outside the new tent's footprint.
    for primitive in doc['meshes'][0]['primitives']:
        name = doc['materials'][primitive['material']]['name']
        shift = {'brown': (.2, .14, .1), 'cream': (.2, .14, .1), 'bark': (.4, .14, -.3)}.get(name)
        if not shift:
            continue
        accessor = doc['accessors'][primitive['attributes']['POSITION']]
        view = doc['bufferViews'][accessor['bufferView']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', 12)
        moved = []
        for i in range(accessor['count']):
            point = struct.unpack_from('<fff', binary, offset + i * stride)
            # The source's negative-X stool would sit directly in the -Z
            # doorway after unrotating the tent. Move only that stool to the
            # free left-side gap between the crate, flag and stones.
            stool_shift = (1.6, 0, 1.25) if name == 'bark' and point[0] < 0 else (0, 0, 0)
            moved.append([point[k] + shift[k] + stool_shift[k] for k in range(3)])
            struct.pack_into('<fff', binary, offset + i * stride, *moved[-1])
        for key in ['min', 'max']:
            accessor[key] = [(min if key == 'min' else max)(point[k] for point in moved) for k in range(3)]
    layers = [
        # Actual Babylon AUTO loading mirrors X, but the source open gable
        # already faces world -Z. Keep it aligned with the other town fronts;
        # the former +45deg pointed the opening straight at the camera instead.
        ('_sources/nature-kit/tent_smallOpen.glb', [-.3, .345, -.1], 4.1, 0, 'matte-cloth'),
        ('forest-tree.glb', [1.35, .14, .9], .95, 0, None),
        ('forest-tree.glb', [-1.80, .14, .7], .70, 0, None),
        ('forest-flag.glb', [1.25, .14, -.50], 1.75, 0, None),
        ('forest-stones.glb', [1.7, .14, 0], .35, 0, None),
    ]
    records = []
    for filename, position, scale, angle, policy in layers:
        append_model(doc, binary, filename, position, scale, angle, policy)
        path = OUT / filename
        nature = filename.endswith('tent_smallOpen.glb')
        records.append({'file': str(path.relative_to(ROOT / 'public/models')),
            'sourceUrl': 'https://kenney.nl/assets/' + ('nature-kit' if nature else 'mini-forest'),
            'originalLibraryPath': 'packs/nature-kit/original/Models/GLTF format/tent_smallOpen.glb' if nature else None,
            'inputSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'license': '../kenney-mini/' + ('nature-kit-License.txt' if nature else 'mini-forest-License.txt'),
            'licenseId': 'CC0-1.0', 'translation': position, 'uniformScale': scale, 'rotationY': angle,
            'materialPolicy': 'metallicFactor 1 -> 0 for Nature cloth/wood only; original colors and roughness preserved' if policy else 'preserved'})
    doc['asset'].update(generator='import_mini_assets.py --rebuild-camp',
        copyright='Project base/crate/stools; Kenney Nature Kit 2.1 open tent and Mini Forest 1.0 props CC0-1.0')
    path = TOWN / 'camp.glb'
    write_glb(path, doc, binary)
    record = {'id': 'camp', 'file': 'camp.glb', 'distributedSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'bytes': path.stat().st_size, 'projectBase': {'file': '_sources/camp-base.glb',
            'sha256': hashlib.sha256(base.read_bytes()).hexdigest(),
            'primitiveTranslations': {'brown': [.2, .14, .1], 'cream': [.2, .14, .1], 'bark': [.4, .14, -.3]},
            'stoolAdjustment': {'sourceMaterial': 'bark', 'sourceVertexSelection': 'x < 0',
                'additionalTranslation': [1.6, 0, 1.25], 'reason': 'Clear the world -Z entrance; place the one front stool in the left-side gap'}}, 'sourceLayers': records,
        'modification': 'Keep the open matte Nature tent entrance aligned to Babylon world -Z like the other buildings (source rotationY 0); move only the doorway stool to the free left-side gap; preserve tent scale/colors and other props; all feet sit on platform; Mini tent retained historically but not in runtime camp'}
    (TOWN / 'camp-sources.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print('camp.glb rebuilt from isolated project base and Nature/Mini sources', path.stat().st_size)


def compose():
    # Models face the -Z street. Contents sit in front of the rear wall,
    # with an unobstructed opening to keep real miniature goods visible.
    scenes = {
        'shop': [
            ('shop-shelf-boxes.glb', [-.95, .18, .60], 1.65, 0),
            ('shop-display-fruit.glb', [1.12, .18, -.85], 1.7, 0),
            ('shop-cash-register.glb', [-.75, .18, -1.05], 1.5, 0),
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
    compose_camp()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--compose', action='store_true')
    parser.add_argument('--rebuild-camp', action='store_true', help='Rebuild only camp without regenerating unrelated town models')
    parser.add_argument('--library', type=Path)
    args = parser.parse_args()
    if args.download:
        import_packs()
    if args.compose:
        compose()
    elif args.rebuild_camp:
        compose_camp(args.library)
