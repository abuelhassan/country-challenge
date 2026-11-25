---
name: list-facts
description: Generate a Markdown file listing all countries that have facts, grouped by continent
disable-model-invocation: true
allowed-tools: Bash(python *)
argument-hint: [--out country-facts.md]
---

Run `python scripts/list_facts_md.py $ARGUMENTS` from the repo root.
