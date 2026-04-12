# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Details

- **Security & Anti-Cheat:** Country names MUST NOT appear in `index.html`.
- **Obfuscation:** Country IDs in the GeoJSON are MD5-hashed (8-char) to prevent guessing via DOM inspection.
- **Data Structure:** `properties.alts` in the GeoJSON contains a JSON array of accepted alternative names.
