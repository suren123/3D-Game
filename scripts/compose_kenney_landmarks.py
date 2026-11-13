#!/usr/bin/env python3
"""Compose CC0 Kenney buildings with project landmark signs, entirely offline.

python scripts/compose_kenney_landmarks.py
python scripts/compose_kenney_landmarks.py --import-library /path/to/dated-library

Original input GLBs/textures/licenses live beside the outputs in _sources/.
The original buildings retain every vertex, material, UV and texture. Only
uniform placement transforms and separate project sign/canopy meshes are added.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/kenney-landmarks'
INPUTS = [
    ('city-kit-suburban', 'building-type-b'),
    ('city-kit-commercial', 'building-c'),
    ('city-kit-commercial', 'building-e'),
    ('mini-shop', 'display-fruit'),
]
CONFIG = {
    'school': ('city-kit-suburban', 'building-type-b', 2.35),
    'hospital': ('city-kit-commercial', 'building-c', 3.3),
    'shop': ('city-kit-commercial', 'building-e', 2.6),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    assert (magic, version, length) == (0x46546C67, 2, len(data))
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + size])
    bsize, bkind = struct.unpack_from('<II', data, 20 + size)
    assert bkind == 0x004E4942
    return doc, bytearray(data[28 + size:28 + size + bsize])


def write_glb(path, doc, blob):
    doc['buffers'] = [{'byteLength': len(blob)}]
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    blob += b'\0' * (-len(blob) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(data) + len(blob))
                     + struct.pack('<II', len(data), 0x4E4F534A) + data
                     + struct.pack('<II', len(blob), 0x004E4942) + blob)


def cache_library(library):
    for pack, name in INPUTS:
        source = library / 'packs' / pack / 'original'
        dest = OUT / '_sources' / pack
        (dest / 'Textures').mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / 'Models/GLB format' / (name + '.glb'), dest / (name + '.glb'))
        shutil.copyfile(source / 'Models/GLB format/Textures/colormap.png', dest / 'Textures/colormap.png')
        shutil.copyfile(source / 'License.txt', OUT / (pack + '-License.txt'))


def append_model(target, binary, pack, name, scale, position=(0, 0, 0)):
    path = OUT / '_sources' / pack / (name + '.glb')
    source, blob = read_glb(path)
    # Each original pack's colormap is embedded in its own image bufferView.
    for img in source.get('images', []):
        if 'uri' in img:
            texture = (path.parent / img.pop('uri')).read_bytes()
            blob += b'\0' * (-len(blob) % 4)
            img['bufferView'] = len(source['bufferViews'])
            img['mimeType'] = 'image/png'
            source['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(texture)})
            blob += texture
    binary += b'\0' * (-len(binary) % 4)
    offset = len(binary)
    binary += blob
    spaces = ['bufferViews', 'accessors', 'images', 'samplers', 'textures', 'materials', 'meshes', 'nodes']
    shifts = {key: len(target.setdefault(key, [])) for key in spaces}
    for view in source.get('bufferViews', []):
        view['buffer'] = 0
        view['byteOffset'] = view.get('byteOffset', 0) + offset
    for accessor in source.get('accessors', []):
        accessor['bufferView'] += shifts['bufferViews']
    for img in source.get('images', []):
        img['bufferView'] += shifts['bufferViews']
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
    for key in spaces:
        target[key].extend(source.get(key, []))
    target['scenes'][0]['nodes'].append(len(target['nodes']))
    target['nodes'].append({'name': 'Kenney original ' + pack + '/' + name, 'children': roots,
                            'translation': list(position), 'scale': [scale] * 3,
                            'extras': {'source': 'Kenney CC0; geometry/materials unchanged'}})


class Details:
    def __init__(self, doc, blob):
        self.doc, self.blob = doc, blob
        self.materials = {}

    def material(self, color):
        if color not in self.materials:
            self.materials[color] = len(self.doc['materials'])
            rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            self.doc['materials'].append({'name': 'Project sign ' + color,
                'pbrMetallicRoughness': {'baseColorFactor': rgb + [1], 'metallicFactor': 0, 'roughnessFactor': .85}})
        return self.materials[color]

    def accessor(self, data, component, typ, count, limits=None):
        self.blob += b'\0' * (-len(self.blob) % 4)
        offset = len(self.blob)
        self.blob += data
        view = len(self.doc['bufferViews'])
        self.doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)})
        idx = len(self.doc['accessors'])
        a = {'bufferView': view, 'componentType': component, 'count': count, 'type': typ}
        if limits:
            a.update(min=limits[0], max=limits[1])
        self.doc['accessors'].append(a)
        return idx

    def polygon(self, name, points, depth, color, position=(0, 0, 0)):
        # Convex XY extrusion, with separate normals for each flat face.
        if sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points))) < 0:
            points = list(reversed(points))
        verts, normals, indices = [], [], []
        faces = [([(x, y, -depth / 2) for x, y in reversed(points)], (0, 0, -1)),
                 ([(x, y, depth / 2) for x, y in points], (0, 0, 1))]
        for i, (x, y) in enumerate(points):
            nx, ny = points[(i + 1) % len(points)]
            length = math.hypot(nx - x, ny - y)
            faces.append(([(x, y, -depth / 2), (nx, ny, -depth / 2),
                           (nx, ny, depth / 2), (x, y, depth / 2)], ((ny - y) / length, (x - nx) / length, 0)))
        for face, normal in faces:
            start = len(verts)
            verts.extend([[v[k] + position[k] for k in range(3)] for v in face])
            normals.extend([normal] * len(face))
            for k in range(1, len(face) - 1):
                indices.extend((start, start + k, start + k + 1))
        minimum = [min(v[k] for v in verts) for k in range(3)]
        maximum = [max(v[k] for v in verts) for k in range(3)]
        p = self.accessor(struct.pack('<' + 'f' * len(verts) * 3, *[c for v in verts for c in v]), 5126, 'VEC3', len(verts), (minimum, maximum))
        n = self.accessor(struct.pack('<' + 'f' * len(normals) * 3, *[c for v in normals for c in v]), 5126, 'VEC3', len(normals))
        ix = self.accessor(struct.pack('<' + 'H' * len(indices), *indices), 5123, 'SCALAR', len(indices))
        mesh = len(self.doc['meshes'])
        self.doc['meshes'].append({'name': name, 'primitives': [{'attributes': {'POSITION': p, 'NORMAL': n}, 'indices': ix, 'material': self.material(color)}]})
        self.doc['scenes'][0]['nodes'].append(len(self.doc['nodes']))
        self.doc['nodes'].append({'name': 'Project addition ' + name, 'mesh': mesh})

    def box(self, name, center, size, color):
        w, h, d = size
        self.polygon(name, [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], d, color, center)

    def roof_post(self, name, x, z, top, color, width=.12, depth=.12):
        # A model's maximum Y can be a chimney or a different roof tier. Sample
        # the actual source triangles under all four post corners instead.
        levels = [roof_height(self.doc, self.blob, x + dx, z + dz)
                  for dx in [-width / 2, width / 2] for dz in [-depth / 2, depth / 2]]
        assert max(levels) - min(levels) < .35, ('Post straddles roof edge', name, levels)
        bottom = min(levels) - .04
        assert top > max(levels), (name, bottom, top, levels)
        self.box(name, [x, (bottom + top) / 2, z], [width, top - bottom, depth], color)


def roof_height(doc, blob, x, z):
    """Intersect a vertical ray with retained City shell triangles, in GLB coordinates."""
    def values(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        size, code = {5121: (1, 'B'), 5123: (2, 'H'), 5125: (4, 'I'), 5126: (4, 'f')}[a['componentType']]
        count = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride', size * count)
        return [struct.unpack_from('<' + code * count, blob, offset + i * stride) for i in range(a['count'])]
    hits = []
    def visit(index, scale=(1, 1, 1), translation=(0, 0, 0)):
        node = doc['nodes'][index]
        assert 'matrix' not in node and 'rotation' not in node
        ns, nt = node.get('scale', [1] * 3), node.get('translation', [0] * 3)
        s = [scale[i] * ns[i] for i in range(3)]
        t = [translation[i] + scale[i] * nt[i] for i in range(3)]
        if 'mesh' in node and node.get('name', '').startswith('building-'):
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                pts = [[t[k] + s[k] * p[k] for k in range(3)] for p in values(primitive['attributes']['POSITION'])]
                indices = [p[0] for p in values(primitive['indices'])] if 'indices' in primitive else list(range(len(pts)))
                for j in range(0, len(indices), 3):
                    a, b, c = [pts[indices[j + k]] for k in range(3)]
                    den = (b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
                    if abs(den) < 1e-10:
                        continue
                    u = ((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2])) / den
                    v = ((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2])) / den
                    w = 1-u-v
                    if min(u, v, w) >= -1e-7:
                        hits.append(u*a[1]+v*b[1]+w*c[1])
        for child in node.get('children', []):
            visit(child, s, t)
    for root in doc['scenes'][0]['nodes']:
        visit(root)
    assert hits, ('No real roof under attachment', x, z)
    return max(hits)


def add_details(d, name):
    if name == 'hospital':
        # The previous canopy floated in front of the wall. Keep the authentic
        # door exposed; seat a shorter plaque above, rather than in, the parapet.
        d.roof_post('medical sign support', 0, -.64, 3.16, '#626C85', .14, .14)
        d.box('medical sign white backing', [0, 3.50, -.70], [1.44, 1.12, .16], '#FFF9ED')
        d.box('medical cross vertical', [0, 3.50, -.80], [.30, .88, .10], '#D72F45')
        d.box('medical cross horizontal', [0, 3.50, -.81], [.88, .30, .10], '#D72F45')
    elif name == 'school':
        d.roof_post('book sign support', .40, -.76, 3.14, '#466B99', .13, .13)
        # The open-book silhouette has two cream pages and a blue cover/spine.
        for sign in [-1, 1]:
            pts = [(sign * .02, -.40), (sign * .67, -.24), (sign * .67, .48), (sign * .02, .31)]
            if sign == 1:
                pts.reverse()
            d.polygon('blue open-book cover', pts, .16, '#3D79AF', [.40, 3.20, -.81])
            inner = [(sign * .06, -.31), (sign * .58, -.18), (sign * .58, .37), (sign * .06, .24)]
            if sign == 1:
                inner.reverse()
            d.polygon('cream open-book page', inner, .05, '#FFF4CC', [.40, 3.20, -.90])
        for sign in [-1, 1]:
            for y in [.18, -.02]:
                line = [(sign * .49, y), (sign * .15, y - .085), (sign * .15, y - .13), (sign * .49, y - .045)]
                d.polygon('blue page reading line', line, .025, '#5683AB', [.40, 3.20, -.935])
        d.box('gold book spine', [.40, 3.16, -.86], [.075, .65, .18], '#F4B94C')
    elif name == 'shop':
        # A shopping basket sign above the single-storey wing; original green
        # Kenney entrance awning remains visible and unchanged.
        d.roof_post('basket sign support', .72, -.28, 2.51, '#626C85')
        d.polygon('orange shopping basket', [(-.54, -.38), (.54, -.38), (.67, .29), (-.67, .29)], .22, '#F5A33D', [.72, 2.73, -.38])
        d.box('basket handle top', [.72, 3.35, -.38], [.69, .10, .12], '#F1BA62')
        for x in [.42, 1.02]:
            d.box('basket handle side', [x, 3.17, -.38], [.10, .36, .12], '#F1BA62')
        for x in [.41, .72, 1.03]:
            d.box('basket cream slot', [x, 2.73, -.50], [.09, .36, .035], '#FFF4CC')


def bounds(doc):
    minimum, maximum = [float('inf')] * 3, [float('-inf')] * 3
    def visit(index, scale=(1, 1, 1), translation=(0, 0, 0)):
        node = doc['nodes'][index]
        assert 'matrix' not in node and 'rotation' not in node, 'Unexpected source transform'
        ns = node.get('scale', [1] * 3)
        nt = node.get('translation', [0] * 3)
        child_scale = [scale[i] * ns[i] for i in range(3)]
        child_translation = [translation[i] + scale[i] * nt[i] for i in range(3)]
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                a = doc['accessors'][primitive['attributes']['POSITION']]
                for i in range(3):
                    minimum[i] = min(minimum[i], child_translation[i] + child_scale[i] * a['min'][i])
                    maximum[i] = max(maximum[i], child_translation[i] + child_scale[i] * a['max'][i])
        for child in node.get('children', []):
            visit(child, child_scale, child_translation)
    for root in doc['scenes'][0]['nodes']:
        visit(root)
    return minimum, maximum


def compose():
    OUT.mkdir(parents=True, exist_ok=True)
    reports = []
    for name, (pack, model, scale) in CONFIG.items():
        doc = {'asset': {'version': '2.0', 'generator': 'compose_kenney_landmarks.py',
                'copyright': 'Kenney CC0 buildings/props; project-added landmark signs and canopy',
                'extras': {'semanticUse': name, 'front': '-Z', 'projectAdaptation': True}},
               'scene': 0, 'scenes': [{'nodes': []}]}
        binary = bytearray()
        append_model(doc, binary, pack, model, scale)
        sources = [(pack, model)]
        if name == 'shop':
            append_model(doc, binary, 'mini-shop', 'display-fruit', 1.15, (1.20, 0, -1.62))
            sources.append(('mini-shop', 'display-fruit'))
        add_details(Details(doc, binary), name)
        minimum, maximum = bounds(doc)
        # Center the full distribution (including all signs/props), ground at y=0.
        shift = [-(minimum[0] + maximum[0]) / 2, -minimum[1], -(minimum[2] + maximum[2]) / 2]
        roots = doc['scenes'][0]['nodes']
        doc['scenes'][0]['nodes'] = [len(doc['nodes'])]
        doc['nodes'].append({'name': 'Grounded centered ' + name, 'children': roots, 'translation': shift})
        minimum, maximum = bounds(doc)
        size = [maximum[i] - minimum[i] for i in range(3)]
        assert size[0] <= 4.8 and size[1] <= 4.8 and size[2] <= 4.8
        path = OUT / (name + '.glb')
        write_glb(path, doc, binary)
        entries = []
        for p, n in sources:
            original = OUT / '_sources' / p / (n + '.glb')
            texture = original.parent / 'Textures/colormap.png'
            entries.append({'pack': p, 'url': 'https://kenney.nl/assets/' + p,
                'originalLibraryPath': 'packs/' + p + '/original/Models/GLB format/' + n + '.glb',
                'offlineInput': str(original.relative_to(OUT)), 'originalSha256': sha(original),
                'texture': str(texture.relative_to(OUT)), 'textureSha256': sha(texture),
                'license': p + '-License.txt', 'licenseId': 'CC0-1.0'})
        reports.append({'file': path.name, 'semanticUse': name, 'projectAdaptation': True,
            'notOfficialDedicatedBuilding': name in ['school', 'hospital'],
            'sourceLayers': entries,
            'modificationLayers': [
                {'layer': 'Kenney original shell', 'model': pack + '/' + model,
                 'uniformScale': scale, 'geometryMaterialsUVsTextures': 'preserved verbatim'},
                {'layer': 'Project additions', 'description': {'school': 'Blue/cream open book roof sign with gold spine; no original shell reconstruction',
                    'hospital': 'Medical cross on plaque seated above parapet; support sampled against actual roof; original doorway unobstructed',
                    'shop': 'Large orange basket roof sign; original Kenney green awning remains; Kenney Mini fruit display added'}[name]},
                {'layer': 'Distribution', 'description': 'All distinct source textures embedded; full assembly XZ centered and grounded at y=0; front -Z'}],
            'bounds': {'min': minimum, 'max': maximum, 'size': size},
            'bytes': path.stat().st_size, 'distributedSha256': sha(path)})
        print(name, 'size', [round(v, 3) for v in size], 'bytes', path.stat().st_size)
    (OUT / 'sources.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--import-library', type=Path)
    args = parser.parse_args()
    if args.import_library:
        OUT.mkdir(parents=True, exist_ok=True)
        cache_library(args.import_library)
    compose()
