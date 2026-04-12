#!/usr/bin/env python3
"""
Read all country GeoJSON files from countries/ and write a CSV with id, continent, game_name, and alts.
Sorted by continent then id.

Usage:
    python scripts/list_countries_csv.py [--out countries_list.csv]
"""

import json
import csv
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--out', default='countries_list.csv')
args = parser.parse_args()

rows = []
for path in sorted(Path('countries').glob('*.geo.json')):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    for feature in data['features']:
        alts = feature['properties'].get('alts', [])
        rows.append({
            'id': feature.get('id', path.name.replace('.geo.json', '')),
            'game_name': feature['properties'].get('game_name', ''),
            'continent': feature['properties'].get('continent', 'Other'),
            'alts': '|'.join(alts),
        })

rows.sort(key=lambda r: (r['continent'], r['id']))

with open(args.out, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['id', 'continent', 'game_name', 'alts'])
    writer.writeheader()
    writer.writerows(rows)

print(f"Written {len(rows)} countries to {args.out}")
