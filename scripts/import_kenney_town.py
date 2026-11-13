#!/usr/bin/env python3
"""Rebuild the curated town assets offline, preserving Kenney geometry/materials.

First import: python scripts/import_kenney_town.py --library /path/to/library
Rebuild from committed inputs: python scripts/import_kenney_town.py
Only wrapper transforms, embedded source PNGs and separate landmark signs differ.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

import compose_kenney_landmarks as glb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/kenney-town'
glb.OUT = OUT
# id, display name, pack, source, uniform scale, category, description
ENTRIES = [
    ('taxi', '出租车', 'car-kit', 'taxi', 1, 'vehicle', '原版黄色出租车与车顶灯。'),
    ('tractor', '拖拉机', 'car-kit', 'tractor', 1, 'vehicle', '原版黄色拖拉机，大后轮与短车头。'),
    ('ambulance', '救护车', 'car-kit', 'ambulance', 1, 'vehicle', '原版红白救护车与车顶警灯。'),
    ('police', '巡逻车', 'car-kit', 'police', 1, 'vehicle', '原版警车与车顶警灯。'),
    ('bus', '接送车', 'car-kit', 'suv-luxury', 1, 'vehicle', '原版黄色休旅车，替换旧项目自建巴士；并非官方公交车。'),
    ('tanker', '消防车', 'car-kit', 'firetruck', 1, 'vehicle', '原版红色消防车，替换旧项目自建水罐车；并非官方罐车。'),
    ('depot', '仓库', 'city-kit-industrial', 'building-k', 3.3, 'place', '原版锯齿采光低厂房，加独立包裹屋顶标识。'),
    ('garage', '车库', 'city-kit-industrial', 'building-j', 3.1, 'place', '原版拱顶车库，保留车库门与前庭绿植，加独立扳手标识。'),
    ('cafe', '餐厅', 'city-kit-commercial', 'building-k', 2.1, 'place', '原版横向商业楼与黄色长雨棚，加Kenney咖啡杯屋顶标识；是项目用途改造。'),
    ('home-g', '双翼平房', 'city-kit-suburban', 'building-type-g', 3.0375, 'decoration', '原版单层双翼坡顶住宅。'),
    ('home-k', '斜顶住宅', 'city-kit-suburban', 'building-type-k', 3.375, 'decoration', '原版两层单斜顶住宅。'),
    ('home-m', '转角平房', 'city-kit-suburban', 'building-type-m', 3.0375, 'decoration', '原版L形单层坡顶住宅。'),
    ('home-q', '车棚住宅', 'city-kit-suburban', 'building-type-q', 3.375, 'decoration', '原版平顶住宅与开放车棚。'),
    ('town-trash', '街边纸篓', 'coaster-kit', 'trash', 1.7, 'decoration', '原版公园纸篓。'),
    ('town-traffic-light', '交通信号灯', 'city-kit-roads', 'traffic-light', 3.2, 'decoration', '原版立杆交通信号灯；静态装饰，不指示游戏通行规则。'),
    ('town-road-sign', '街道路牌', 'city-kit-roads', 'road-sign-street', 3.2, 'decoration', '原版双向街道路牌。'),
    ('town-low-fence', '低矮围栏', 'city-kit-suburban', 'fence-low', 2.4, 'decoration', '原版低矮木围栏。'),
]
PACK_NAMES = {'car-kit': 'Car Kit 3.1', 'city-kit-industrial': 'City Kit (Industrial) 2.0',
    'city-kit-commercial': 'City Kit (Commercial) 2.1', 'city-kit-suburban': 'City Kit (Suburban) 2.0',
    'food-kit': 'Food Kit 2.0', 'coaster-kit': 'Coaster Kit 1.0', 'city-kit-roads': 'City Kit Roads 2.2'}
INPUTS = sorted({(e[2], e[3]) for e in ENTRIES} | {('food-kit', 'cup-coffee')})


def cache_library(library):
    for pack, name in INPUTS:
        source = library / 'packs' / pack / 'original'
        folder = source / 'Models/GLB format'
        destination = OUT / '_sources' / pack
        destination.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(folder / (name + '.glb'), destination / (name + '.glb'))
        doc, _ = glb.read_glb(folder / (name + '.glb'))
        for image in doc.get('images', []):
            if 'uri' in image:
                target = destination / image['uri']
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(folder / image['uri'], target)
        licenses = OUT / 'licenses'
        licenses.mkdir(exist_ok=True)
        shutil.copyfile(source / 'License.txt', licenses / (pack + '-License.txt'))


def add_sign(doc, blob, model_id):
    d = glb.Details(doc, blob)
    if model_id == 'depot':
        d.roof_post('parcel sign support', 0, -.65, 2.73, '#697587')
        d.box('parcel sign', [0, 3.02, -.65], [1.12, .88, .7], '#DDA95D')
        d.box('parcel vertical tape', [0, 3.02, -1.015], [.17, .9, .035], '#FFF1CF')
        d.box('parcel horizontal tape', [0, 3.02, -1.035], [1.13, .15, .035], '#FFF1CF')
        d.box('parcel top tape', [0, 3.47, -.65], [.17, .035, .7], '#FFF1CF')
    elif model_id == 'garage':
        x, z = -1.35, -.25  # Actual centered roof region of the offset original.
        d.roof_post('wrench support', x, z, 2.955, '#697587')
        d.polygon('wrench handle', [(-.13,-.62),(.13,-.62),(.13,.35),(-.13,.35)], .16, '#F5B443', [x,3.18,z-.04])
        # Four convex parts preserve the characteristic open wrench jaw.
        d.box('wrench head base', [x,3.49,z-.04], [.66,.20,.16], '#F5B443')
        for dx in [-.28,.28]:
            d.box('wrench open jaw', [x+dx,3.70,z-.04], [.17,.42,.16], '#F5B443')


def source_record(pack, name):
    original = OUT / '_sources' / pack / (name + '.glb')
    doc, _ = glb.read_glb(original)
    textures = []
    for image in doc.get('images', []):
        if 'uri' in image:
            texture = original.parent / image['uri']
            textures.append({'offlineInput': str(texture.relative_to(OUT)), 'sha256': glb.sha(texture)})
    return {'pack': pack, 'sourceUrl': 'https://kenney.nl/assets/' + pack,
        'originalLibraryPath': f'packs/{pack}/original/Models/GLB format/{name}.glb',
        'offlineInput': str(original.relative_to(OUT)), 'originalSha256': glb.sha(original),
        'textureDependencies': textures, 'license': 'licenses/' + pack + '-License.txt',
        'licenseSha256': glb.sha(OUT / 'licenses' / (pack + '-License.txt')), 'licenseId': 'CC0-1.0'}


def compose():
    OUT.mkdir(parents=True, exist_ok=True)
    provenance, catalog = [], []
    for model_id, name, pack, original, scale, category, details in ENTRIES:
        doc = {'asset': {'version': '2.0', 'generator': 'import_kenney_town.py',
            'copyright': 'Kenney CC0; separate project parcel/wrench landmark signs',
            'extras': {'front': '+Z' if category == 'vehicle' else '-Z', 'semanticUse': model_id}},
            'scene': 0, 'scenes': [{'nodes': []}]}
        blob = bytearray()
        glb.append_model(doc, blob, pack, original, scale)
        sources = [source_record(pack, original)]
        add_sign(doc, blob, model_id)
        if model_id == 'cafe':
            # This is the original Food Kit coffee cup, not a replacement building.
            roof = glb.roof_height(doc, blob, 0, .12)
            glb.append_model(doc, blob, 'food-kit', 'cup-coffee', 5.0, (0, roof, .12))
            sources.append(source_record('food-kit', 'cup-coffee'))
        minimum, maximum = glb.bounds(doc)
        shift = [-(minimum[0] + maximum[0]) / 2, -minimum[1], -(minimum[2] + maximum[2]) / 2]
        roots = doc['scenes'][0]['nodes']
        doc['scenes'][0]['nodes'] = [len(doc['nodes'])]
        doc['nodes'].append({'name': 'Grounded XZ-centered ' + model_id, 'children': roots, 'translation': shift})
        minimum, maximum = glb.bounds(doc)
        size = [maximum[i] - minimum[i] for i in range(3)]
        if category == 'vehicle':
            assert size[0] <= 1.7 and size[2] <= 3.6, (model_id, size)
        elif category == 'place':
            assert size[0] <= 5.6 and size[2] <= 5.6 and size[1] <= 5.5, (model_id, size)
        elif model_id.startswith('home-'):
            assert size[0] <= 4.5 and size[2] <= 4.5 and size[1] <= 4.0, (model_id, size)
        path = OUT / (model_id + '.glb')
        glb.write_glb(path, doc, blob)
        bounds = {'min': minimum, 'max': maximum, 'size': size}
        adapted = model_id in ['depot', 'garage', 'cafe']
        record = {'id': model_id, 'path': 'models/kenney-town/' + path.name,
            'sourceLayers': sources, 'distributedSha256': glb.sha(path), 'bytes': path.stat().st_size,
            'bounds': bounds, 'runtimeScale': 1.16 if category == 'vehicle' else 1,
            'sourceUniformScale': scale, 'sourceOrientationPreserved': True,
            'front': '+Z' if category == 'vehicle' else '-Z', 'groundY': 0,
            'modification': 'Original geometry, materials, UVs and texture pixels preserved; source PNGs embedded; wrapper scale/centering/grounding' + ('; separate landmark sign added' if adapted else '')}
        provenance.append(record)
        catalog.append({'id': model_id, 'name': name, 'category': category,
            'sourceType': 'combined' if adapted else 'kenney',
            'sourceLabel': '组合模型' if adapted else 'Kenney素材',
            'packLabel': PACK_NAMES[pack] + (' + Food Kit 2.0' if model_id == 'cafe' else ''),
            'sourceUrl': 'https://kenney.nl/assets/' + pack,
            'details': details + f' 原文件：{original}.glb；保留源几何、材质及纹理。',
            'runtimeScale': record['runtimeScale'], 'bounds': bounds,
            'front': record['front']})
        print(model_id, 'size', [round(x, 3) for x in size], 'bytes', record['bytes'])
    (OUT / 'sources.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
    module = '// Generated by scripts/import_kenney_town.py; runtime dimensions are authored into the GLBs.\n'
    module += 'export const TOWN_MODELS = ' + json.dumps([{'id': p['id'], 'path': p['path']} for p in provenance], ensure_ascii=False, indent=2) + ';\n'
    module += 'export const TOWN_CATALOG = ' + json.dumps(catalog, ensure_ascii=False, indent=2) + ';\n'
    (ROOT / 'src/v2/town-assets.js').write_text(module)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--library', type=Path)
    args = parser.parse_args()
    if args.library:
        cache_library(args.library)
    compose()
