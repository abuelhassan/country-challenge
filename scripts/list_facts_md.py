#!/usr/bin/env python3
"""
Read all country GeoJSON files from countries/ and write a Markdown file
listing every country that has facts, grouped by continent.

Usage:
    python scripts/list_facts_md.py [--out country-facts.md]
"""

import json
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--out', default='country-facts.md')
args = parser.parse_args()

rows = []
for path in sorted(Path('countries').glob('*.geo.json')):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    for feature in data['features']:
        facts = feature['properties'].get('facts')
        if not facts:
            continue
        rows.append({
            'game_name': feature['properties'].get('game_name', path.stem),
            'continent': feature['properties'].get('continent', 'Other'),
            'facts': facts,
        })

rows.sort(key=lambda r: (r['continent'], r['game_name']))

lines = [f'# Country Facts ({len(rows)} countries)\n']
current_continent = None
for row in rows:
    if row['continent'] != current_continent:
        current_continent = row['continent']
        lines.append(f'\n## {current_continent}\n')
    lines.append(f"\n### {row['game_name']}\n")
    for fact in row['facts']:
        lines.append(f'- {fact}')
    lines.append('')

Path(args.out).write_text('\n'.join(lines), encoding='utf-8')
print(f"Written {len(rows)} countries with facts to {args.out}")