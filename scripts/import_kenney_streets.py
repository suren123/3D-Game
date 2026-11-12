#!/usr/bin/env python3
"""Import the curated street subset from the downloaded Kenney library.

Geometry, UVs, materials and node transforms stay original; only external
PNG images are embedded. No downloads or package dependencies are required.
"""
import argparse
import hashlib
import json
from pathlib import Path
from import_mini_assets import read_glb, write_glb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/kenney-streets'
SELECTED = {
    'city-kit-roads': {
        'street-road-straight': 'road-straight',
        'street-road-corner': 'road-bend-square',
        'street-road-t': 'road-intersection',
        'street-road-cross': 'road-crossroad',
        'street-road-end': 'road-end',
        'street-lamp': 'light-square',
        'street-fence': 'construction-fence',
        'street-cone': 'construction-cone',
    },
    'coaster-kit': {'street-bench': 'bench', 'street-flower': 'flowers'},
}


def import_models(library):
    OUT.mkdir(parents=True, exist_ok=True)
    licenses = OUT / 'licenses'
    licenses.mkdir(exist_ok=True)
    provenance = []
    for pack, models in SELECTED.items():
        original = library / 'packs' / pack / 'original'
        license_path = licenses / (pack + '-License.txt')
        license_path.write_bytes((original / 'License.txt').read_bytes())
        for model_id, name in models.items():
            relative = 'Models/GLB format/' + name + '.glb'
            source = original / relative
            source_bytes = source.read_bytes()
            doc, binary = read_glb(source_bytes)
            dependencies = []
            for image in doc.get('images', []):
                if 'uri' not in image:
                    continue
                texture_path = source.parent / image.pop('uri')
                texture = texture_path.read_bytes()
                dependencies.append({'originalPath': str(texture_path.relative_to(library)),
                                     'sha256': hashlib.sha256(texture).hexdigest()})
                binary += b'\0' * (-len(binary) % 4)
                image['bufferView'] = len(doc['bufferViews'])
                image['mimeType'] = 'image/png'
                doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(texture)})
                binary += texture
            target = OUT / (model_id + '.glb')
            write_glb(target, doc, binary)
            provenance.append({
                'id': model_id, 'file': target.name,
                'sourceUrl': 'https://kenney.nl/assets/' + pack,
                'pack': pack, 'originalPath': str(source.relative_to(library)),
                'license': str(license_path.relative_to(OUT)), 'licenseId': 'CC0-1.0',
                'originalSha256': hashlib.sha256(source_bytes).hexdigest(),
                'distributedSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                'bytes': target.stat().st_size, 'textureDependencies': dependencies,
                'modification': 'Embed original PNG images; preserve original geometry, materials, UVs and node transforms',
            })
            print(model_id, target.stat().st_size)
    (licenses / 'sources.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--library', type=Path, default=Path('/workspace/kenney-3d-library/2026-11-12'))
    import_models(parser.parse_args().library)
