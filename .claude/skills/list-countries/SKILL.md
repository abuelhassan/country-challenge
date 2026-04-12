---
name: list-countries
description: Regenerate countries_list.csv from all files in countries/
disable-model-invocation: true
allowed-tools: Bash(python *)
argument-hint: [--out output.csv]
---

Run `python scripts/list_countries_csv.py $ARGUMENTS` from the repo root.