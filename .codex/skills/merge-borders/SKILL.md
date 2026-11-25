---
name: merge-borders
description: Merge two adjacent countries by dissolving their shared border
disable-model-invocation: true
allowed-tools: Bash(python *)
argument-hint: <ID1> <ID2>
---

Run `python scripts/merge_borders.py $ARGUMENTS` from the repo root. Saves merged geometry under ID1 and deletes ID2.