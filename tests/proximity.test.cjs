const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ProximityScorer} = require('../assets/proximity-scoring.js');
const {geometryShape, boundaryDistance, hashId} = require('../scripts/build_proximity.cjs');
const data = require('../proximity.json');
const config = require('../scripts/proximity-config.json');
const root = path.resolve(__dirname, '..');

function fixture() {
    return new ProximityScorer({
        version: 1,
        ids: ['a', 'b', 'c', 'd', 'island', 'island2'],
        distancesKm: [
            [0, 1000, 0, 100, 50, 60],
            [1000, 0, 800, 1500, 900, 850],
            [0, 800, 0, 700, 250, 260],
            [100, 1500, 700, 0, 500, 510],
            [50, 900, 250, 500, 0, 10],
            [60, 850, 260, 510, 10, 0],
        ],
        landNeighbors: [['c'], [], ['a'], [], [], []],
        islandLinks: [
            {island: 'island', mainland: 'a', distanceKm: 50},
            {island: 'island2', mainland: 'a', distanceKm: 60},
        ],
    }, ['a', 'b', 'c', 'd', 'island', 'island2']);
}

test('first guess is free; distance uses last guess, not nearest previous country', () => {
    const scorer = fixture();
    assert.equal(scorer.record('a').penalty, 0);
    assert.equal(scorer.record('b').penalty, 10);
    const result = scorer.record('d');
    assert.equal(result.fromId, 'b');
    assert.equal(result.distanceKm, 1500);
    assert.equal(result.penalty, 15);
    assert.equal(result.total, 25);
});

test('any previous border is free and a free move becomes the next origin', () => {
    const scorer = fixture();
    scorer.record('a');
    scorer.record('b');
    const free = scorer.record('c');
    assert.equal(free.kind, 'border');
    assert.equal(free.neighborId, 'a');
    assert.equal(free.total, 10);
    assert.equal(scorer.record('d').penalty, 7);
});

test('island links are symmetric and can match any earlier guess', () => {
    const scorer = fixture();
    scorer.record('a');
    scorer.record('b');
    const result = scorer.record('island');
    assert.equal(result.kind, 'island');
    assert.equal(result.neighborId, 'a');
    assert.equal(result.penalty, 0);
    scorer.reset();
    scorer.record('island');
    assert.equal(scorer.record('a').penalty, 0);
});

test('nearby islands do not receive extra virtual neighbors', () => {
    const scorer = fixture();
    scorer.record('island');
    const result = scorer.record('island2');
    assert.equal(result.kind, 'distance');
    assert.equal(result.penalty, 0.1);
});

test('invalid and duplicate answers do not change the origin or score', () => {
    const scorer = fixture();
    scorer.record('a');
    scorer.record('b');
    assert.equal(scorer.record('unknown'), null);
    assert.equal(scorer.record('a'), null);
    assert.equal(scorer.lastId, 'b');
    assert.equal(scorer.total, 10);
    assert.equal(scorer.guessed.size, 2);
});

test('reset clears the score and origin; previous awards stay fixed', () => {
    const scorer = fixture();
    scorer.record('b');
    const award = scorer.record('a');
    scorer.record('c');
    assert.equal(award.penalty, 10);
    assert.equal(scorer.total, 10);
    scorer.reset();
    assert.equal(scorer.total, 0);
    assert.equal(scorer.lastId, null);
    assert.equal(scorer.guessed.size, 0);
    assert.equal(scorer.record('d').kind, 'first');
});

test('scoring data must match the playable countries', () => {
    assert.throws(() => new ProximityScorer(data, ['unknown']), /does not match/);
    const invalid = structuredClone(data);
    invalid.distancesKm[0][1] = null;
    assert.throws(() => new ProximityScorer(invalid, data.ids), /Invalid proximity/);
});

test('generated data matches the map and island configuration', () => {
    const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    assert.equal(data.sourceSha256, digest('countries_merged.geojson'));
    assert.equal(data.configSha256, digest('scripts/proximity-config.json'));
    const world = JSON.parse(fs.readFileSync(path.join(root, 'countries_merged.geojson'), 'utf8'));
    const ids = world.features.filter(f => f.properties.game_name).map(f => f.id);
    const scorer = new ProximityScorer(data, ids);
    for (let i = 0; i < ids.length; i++) {
        assert.equal(data.distancesKm[i][i], 0);
        for (let j = 0; j < ids.length; j++) {
            assert.equal(data.distancesKm[i][j], data.distancesKm[j][i]);
            assert.ok(data.distancesKm[i][j] >= 0 && data.distancesKm[i][j] <= 20016);
            assert.equal(data.landNeighbors[i].includes(ids[j]), data.landNeighbors[j].includes(ids[i]));
        }
        assert.ok(scorer.record(ids[i]));
    }
    assert.equal(scorer.guessed.size, 196);
    assert.ok(Number.isFinite(scorer.total));
});

test('every configured island has exactly one closest-mainland link', () => {
    const islands = new Set(config.islandCountries.map(hashId));
    assert.equal(data.islandLinks.length, islands.size);
    assert.equal(new Set(data.islandLinks.map(l => l.island)).size, islands.size);
    for (const link of data.islandLinks) {
        assert.ok(islands.has(link.island));
        assert.ok(!islands.has(link.mainland));
        const row = data.distancesKm[data.ids.indexOf(link.island)];
        const minimum = Math.min(...row.filter((_, i) => !islands.has(data.ids[i])));
        assert.equal(link.distanceKm, minimum);
        assert.equal(row[data.ids.indexOf(link.mainland)], minimum);
    }
});

test('real map: older neighbor waives penalty after a distant guess', () => {
    const scorer = new ProximityScorer(data, data.ids);
    scorer.record(hashId('EGY'));
    assert.ok(scorer.record(hashId('JPN')).penalty > 0);
    const result = scorer.record(hashId('LBY'));
    assert.equal(result.kind, 'border');
    assert.equal(result.neighborId, hashId('EGY'));
    assert.equal(result.penalty, 0);
});

test('long jumps are not capped and fractional penalties are retained', () => {
    const scorer = new ProximityScorer(data, data.ids);
    scorer.record(hashId('EGY'));
    const result = scorer.record(hashId('JPN'));
    assert.ok(result.penalty > 80);
    assert.equal(result.penalty, result.distanceKm / 100);
});

const polygon = coordinates => geometryShape({type: 'Polygon', coordinates: [coordinates]});
test('spherical boundary distance handles borders, crossing edges and the date line', () => {
    const a = polygon([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
    const touching = polygon([[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]);
    assert.equal(boundaryDistance(a, touching), 0);
    const crossing = polygon([[0.5, -1], [1.5, -1], [1.5, 0.5], [0.5, 0.5], [0.5, -1]]);
    assert.equal(boundaryDistance(a, crossing), 0);
    const west = polygon([[178, 0], [179, 0], [179, 1], [178, 1], [178, 0]]);
    const east = polygon([[-179, 0], [-178, 0], [-178, 1], [-179, 1], [-179, 0]]);
    const distance = boundaryDistance(west, east);
    assert.ok(distance > 222 && distance < 223);
    assert.equal(distance, boundaryDistance(east, west));
});

test('distance reaches the middle of an edge rather than just sampled vertices', () => {
    const a = polygon([[-5, 0], [5, 0], [5, -1], [-5, -1], [-5, 0]]);
    const b = polygon([[0, 1], [0.1, 1], [0.1, 2], [0, 2], [0, 1]]);
    const distance = boundaryDistance(a, b);
    assert.ok(Math.abs(distance - 111.195) < 0.01);
});
