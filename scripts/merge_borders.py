#!/usr/bin/env python3
"""
Merge two country GeoJSON files into one, dissolving the shared border.
The merged result is saved under the first country's ID; the second file is deleted.

Usage:
    python scripts/merge_country_files.py <ID1> <ID2>

Example:
    python scripts/merge_country_files.py SDN SSD
"""

import json
import sys
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
import shapely

if len(sys.argv) != 3:
    print("Usage: merge_country_files.py <ID1> <ID2>")
    sys.exit(1)

id1, id2 = sys.argv[1].upper(), sys.argv[2].upper()

countries_dir = Path('countries')
path1 = countries_dir / f'{id1}.geo.json'
path2 = countries_dir / f'{id2}.geo.json'

for p in (path1, path2):
    if not p.exists():
        print(f"Error: {p} not found")
        sys.exit(1)

def load_geometry(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    geoms = [shape(f['geometry']) for f in data['features']]
    return unary_union(geoms)

geom1 = shapely.make_valid(load_geometry(path1))
geom2 = shapely.make_valid(load_geometry(path2))

merged = shapely.make_valid(unary_union([geom1, geom2]))

# Fix winding order (CW exterior, matching the rest of the dataset)
if merged.geom_type == 'Polygon':
    merged = orient(merged, sign=-1.0)
elif merged.geom_type == 'MultiPolygon':
    merged = type(merged)([orient(p, sign=-1.0) for p in merged.geoms])

feature = {
    'type': 'Feature',
    'id': id1,
    'properties': json.load(open(path1, encoding='utf-8'))['features'][0]['properties'],
    'geometry': mapping(merged),
}

collection = {'type': 'FeatureCollection', 'features': [feature]}

# Delete both originals
path1.unlink()
path2.unlink()
print(f"Deleted {path1} and {path2}")

# Write merged file
with open(path1, 'w', encoding='utf-8') as f:
    json.dump(collection, f, ensure_ascii=False)
    f.write('\n')

print(f"Created {path1} (merged {id1} + {id2})")
