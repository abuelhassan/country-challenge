#!/usr/bin/env python3
"""
For each country in missing_countries.csv, fetch its GeoJSON from the
geo-countries dataset and create a file under countries/{ID}.geo.json.

Usage:
    python scripts/add_missing_countries.py
"""

import csv
import json
import urllib.request
from pathlib import Path

GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
MISSING_CSV = 'missing_countries.csv'
COUNTRIES_DIR = Path('countries')

# Read missing countries
missing = {}
with open(MISSING_CSV, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        missing[row['id']] = row['name']

print(f"Looking for {len(missing)} countries...")

# Download geo-countries dataset
print("Downloading geo-countries dataset...")
with urllib.request.urlopen(GEOJSON_URL) as r:
    source = json.loads(r.read().decode('utf-8'))

# Index source features by ISO_A3
index = {}
for feature in source['features']:
    props = feature.get('properties', {})
    alpha3 = props.get('ISO3166-1-Alpha-3') or props.get('ISO_A3') or feature.get('id')
    if alpha3:
        index[alpha3.upper()] = feature

found, not_found = [], []

for alpha3, name in missing.items():
    feature = index.get(alpha3)
    if not feature:
        not_found.append(f"{alpha3} ({name})")
        continue

    # Normalise to match the format of existing country files
    out_feature = {
        'type': 'Feature',
        'id': alpha3,
        'properties': {'name': name},
        'geometry': feature['geometry'],
    }
    collection = {'type': 'FeatureCollection', 'features': [out_feature]}

    out_path = COUNTRIES_DIR / f'{alpha3}.geo.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(collection, f, ensure_ascii=False)
        f.write('\n')

    found.append(alpha3)
    print(f"  Created {out_path}")

print(f"\nCreated {len(found)} files.")
if not_found:
    print(f"Not found in source ({len(not_found)}): {', '.join(not_found)}")
