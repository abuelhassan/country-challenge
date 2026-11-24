# Country Challenge

A geography game where you have 15 minutes to name as many countries as possible. Type a country name and press Enter — if it's correct, it lights up on the map.

The sidebar also tracks your **proximity penalty** (lower is better):

- Your first correct country is free.
- A country bordering any previous correct answer is free.
- Otherwise, the penalty increases by the distance from your **last** correct answer in kilometers, divided by 100.
- Each island country has one precalculated closest-mainland neighbor. This connection is free in either direction. No extra island-to-island links are added.
- The USA and Russia count as neighbors across the Bering Strait. Guessing either after the other adds no penalty, even if other countries were guessed in between. Other intercontinental jumps follow the usual rules.

Distances are approximate shortest border/coastline distances on the game's simplified map, including all mapped parts of each country. Australia counts as mainland; the island-country list is maintained in `scripts/proximity-config.json`. The penalty is accumulated without a cap and displayed to one decimal place. Wrong and duplicate guesses do not change it.

![Screenshot](assets/game-preview.png)

## Try it online

Play directly at **https://abuelhassan.github.io/country-challenge/** — no setup needed.

## How to run locally

**Option 1 — Python** (no install needed if Python is available):
```bash
python3 -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080) in your browser.

**Option 2 — Node.js** (no install needed if Node.js is available):
```bash
npx serve .
```
Then open the URL shown in the terminal.

## Regenerating scoring data

After changing country geometry, regenerate the merged map using the existing workflow, then run:

```bash
node scripts/build_proximity.cjs
node --test tests/proximity.test.cjs
```

The generator writes `proximity.json`, containing country distances, land neighbors, each island's closest-mainland link, and explicitly configured free crossings. Crossings preserve the geographic distance and are not recorded as land borders. It uses only Node's built-in modules. Rebuild it after changing `scripts/proximity-config.json` too. The tests check that the generated data matches both inputs.
