# Country Challenge ideas

Remaining user experience and feature ideas, ordered roughly by priority.

## Clear loading and error states

- Show loading progress while the map is being prepared.
- Display a visible error and Retry button if the map cannot load.

## Reliable round timing

- Calculate remaining time from a deadline so delayed browser callbacks do not extend the round.
- Check the deadline before accepting answers, including after returning from another tab.

## In-game instructions

- Explain that players submit answers with Enter and the timer starts with the first correct answer.
- Explain the yellow map dots and map navigation.
- Document which countries and territories are included in the game's answer set.

## Accessibility

- Label the answer field and announce answer feedback to screen readers.
- Keep unsuccessful-answer feedback available long enough to read and correct.
- Respect reduced-motion preferences for animations and confetti.
- Provide keyboard-accessible map controls and text-based results.

## Post-game review

- Show a searchable list of missed countries alongside the score.
- Let players select a missed country to locate it on the map.
- Show results by continent without crowding the map with every missed label at once.

## Shorter and regional challenges

- Offer a five-minute timed round for shorter sessions.
- Offer timed continent-only challenges with an appropriate map view and country total.

## Saved rounds and personal records

- Save an unfinished round locally so a refresh does not erase progress.
- Restore the original deadline when resuming a timed round.
- Store personal bests and recent results locally, separately for each challenge type.

## Map navigation

- Add zoom-in, zoom-out, and Reset view buttons.
- Let players select a guessed country in the sidebar to locate it on the map.
- Make small countries easier to inspect with touch-friendly markers and regional views.

## Country facts

- Expand the existing spotlight beyond the 15 countries that currently have facts.
- Let players browse country facts during post-game review.
- Include sources and review dates for facts that can change over time.

## Future island handling

- Improve island adjacency by considering both nearby land areas and nearby islands, rather than connecting each island only to its closest land.

## Other scoring variations

- **Continent completion bonuses:** Award extra points whenever a player names every country in a continent.
- **Area-based scoring:** Score players by the total land area of the countries they name correctly, and show the share of the game's total land area they have covered.
- **Surprise bonuses:** Award unexpected extra points for special milestones or answer patterns, such as starting with Egypt, finishing with Vanuatu, or naming every island country. Reveal the reason for each bonus so players can enjoy discovering these achievements.

## Implemented

- **Bering Strait connection:** The USA and Russia count as neighbors for proximity scoring, providing a free connection between the Americas and Eurasia in both directions. This also applies when the counterpart was an earlier guess rather than the last one.
- **Proximity penalty:** Starts at zero. The first correct country and neighbors of any previous correct answer are free. Otherwise, add the approximate border/coastline distance from the last correct answer in kilometers divided by 100. Each island country has one precalculated closest-mainland connection, free in both directions. Invalid and duplicate guesses do not affect the penalty or the last successful guess; replay resets both. Country count and proximity penalty are displayed separately. The broader island-handling idea above remains unimplemented.
