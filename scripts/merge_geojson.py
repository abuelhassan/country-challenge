#!/usr/bin/env python3
"""
Merge all GeoJSON files under countries/ into a single FeatureCollection.
Fixes polygon winding order (exterior CCW, holes CW) so D3 renders correctly.

Usage:
    python scripts/merge_geojson.py [--out output.geojson]
"""

import json
import argparse
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.geometry.polygon import orient

parser = argparse.ArgumentParser()
parser.add_argument('--out', default='countries_merged.geojson')
args = parser.parse_args()


def fix_winding(geometry):
    """Ensure exterior rings are CCW and holes are CW (GeoJSON right-hand rule)."""
    geom = shape(geometry)
    if geom.geom_type == 'Polygon':
        geom = orient(geom, sign=-1.0)
    elif geom.geom_type == 'MultiPolygon':
        geom = type(geom)([orient(p, sign=-1.0) for p in geom.geoms])
    return mapping(geom)


features = []
for path in sorted(Path('countries').glob('*.geo.json')):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    for feature in data['features']:
        feature['geometry'] = fix_winding(feature['geometry'])
        features.append(feature)

collection = {
    'type': 'FeatureCollection',
    'features': features,
}

with open(args.out, 'w', encoding='utf-8') as f:
    json.dump(collection, f, ensure_ascii=False)
    f.write('\n')

print(f"Merged {len(features)} features from {len(list(Path('countries').glob('*.geo.json')))} files")
print(f"Saved → {Path(args.out).resolve()}")
