---
name: merge-geojson
description: Rebuild countries_merged.geojson from all files in countries/
disable-model-invocation: true
allowed-tools: Bash(python *)
argument-hint: [--out output.geojson]
---

Run `python scripts/merge_geojson.py $ARGUMENTS` from the repo root.