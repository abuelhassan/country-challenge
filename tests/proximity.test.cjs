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
        version: 2,
        ids: ['a', 'b', 'c', 'd', 'island', 'island2'],
        distancesKm: [
            [0, 1000, 0, 100, 50, 60],
            [1000, 0, 800, 1500, 900, 850],
            [0, 800, 0, 700, 250, 260],
            [100, 1500, 700, 0, 500, 510],
            [50, 900, 250, 500, 0, 10],
            [60, 850, 260, 510, 10, 0],
        ],
    }, ['a', 'b', 'c', 'd', 'island', 'island2']);
}

const mapDistance = (a, b) => data.distancesKm[data.ids.indexOf(hashId(a))][data.ids.indexOf(hashId(b))];

test('the first correct country adds zero penalty', () => {
    const scorer = fixture();
    const result = scorer.record('a');
    assert.equal(result.kind, 'first');
    assert.equal(result.neighborId, null);
    assert.equal(result.distanceKm, 0);
    assert.equal(result.penalty, 0);
    assert.equal(result.total, 0);
});

test('penalty uses the closest previous guess rather than the last guess', () => {
    const scorer = fixture();
    scorer.record('a');
    assert.equal(scorer.record('b').penalty, 10);
    const result = scorer.record('d');
    assert.equal(result.neighborId, 'a');
    assert.equal(result.distanceKm, 100);
    assert.equal(result.penalty, 1);
    assert.equal(result.total, 11);
});

test('unguessed countries cannot reduce the distance', () => {
    const scorer = fixture();
    scorer.record('b');
    const result = scorer.record('d');
    assert.equal(result.neighborId, 'b');
    assert.equal(result.distanceKm, 1500);
    assert.equal(result.penalty, 15);
});

test('a touching earlier country naturally produces zero penalty', () => {
    const scorer = fixture();
    scorer.record('a');
    scorer.record('b');
    const result = scorer.record('c');
    assert.equal(result.neighborId, 'a');
    assert.equal(result.distanceKm, 0);
    assert.equal(result.penalty, 0);
    assert.equal(result.total, 10);
});

test('a closer island is used even when a mainland country has been guessed', () => {
    const scorer = fixture();
    scorer.record('a');
    assert.equal(scorer.record('island2').penalty, 0.6);
    const result = scorer.record('island');
    assert.equal(result.neighborId, 'island2');
    assert.equal(result.distanceKm, 10);
    assert.equal(result.penalty, 0.1);
    assert.equal(result.total, 0.7);
});

test('island and mainland pairs use the same distance formula in both directions', () => {
    for (const [start, next, expected] of [['island', 'island2', 0.1], ['island', 'a', 0.5]]) {
        for (const [a, b] of [[start, next], [next, start]]) {
            const scorer = fixture();
            scorer.record(a);
            assert.equal(scorer.record(b).penalty, expected);
        }
    }
});

test('invalid and duplicate guesses do not change the score or candidate countries', () => {
    const scorer = fixture();
    scorer.record('a');
    scorer.record('b');
    assert.equal(scorer.record('unknown'), null);
    assert.equal(scorer.record('a'), null);
    assert.equal(scorer.total, 10);
    assert.deepEqual([...scorer.guessed], ['a', 'b']);
});

test('reset clears the score and guesses; later answers do not alter earlier awards', () => {
    const scorer = fixture();
    scorer.record('b');
    const award = scorer.record('a');
    scorer.record('c');
    assert.equal(award.penalty, 10);
    assert.equal(scorer.total, 10);
    scorer.reset();
    assert.equal(scorer.total, 0);
    assert.equal(scorer.guessed.size, 0);
    assert.equal(scorer.record('d').kind, 'first');
});

test('equal distances select the earliest guessed neighbor consistently', () => {
    const tied = new ProximityScorer({version: 2, ids: ['a', 'b', 'c'], distancesKm: [[0, 20, 10], [20, 0, 10], [10, 10, 0]]}, ['a', 'b', 'c']);
    tied.record('b');
    tied.record('a');
    assert.equal(tied.record('c').neighborId, 'b');
});

test('fractional penalties are accumulated without early rounding', () => {
    const scorer = new ProximityScorer({version: 2, ids: ['a', 'b', 'c'], distancesKm: [[0, 12.345, 40], [12.345, 0, 23.456], [40, 23.456, 0]]}, ['a', 'b', 'c']);
    scorer.record('a');
    const first = scorer.record('b');
    const second = scorer.record('c');
    assert.equal(first.penalty, 12.345 / 100);
    assert.equal(second.penalty, 23.456 / 100);
    assert.equal(second.total, 12.345 / 100 + 23.456 / 100);
});

test('obsolete data and malformed distance matrices are rejected', () => {
    assert.throws(() => new ProximityScorer(data, ['unknown']), /does not match/);
    assert.throws(() => new ProximityScorer({...data, version: 1}, data.ids), /does not match/);
    for (const change of [
        d => { d.distancesKm = []; },
        d => { d.distancesKm[0].pop(); },
        d => { d.distancesKm[0][1] = null; },
        d => { d.distancesKm[0][1] = -1; },
        d => { d.distancesKm[0][1] = Infinity; },
        d => { d.distancesKm[0][0] = 1; },
        d => { d.distancesKm[0][1] += 1; },
    ]) {
        const invalid = structuredClone(data);
        change(invalid);
        assert.throws(() => new ProximityScorer(invalid, data.ids), /proximity data/);
    }
});

test('generated distance-only data matches the map and geographic corrections', () => {
    const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    assert.equal(data.sourceSha256, digest('countries_merged.geojson'));
    assert.equal(data.configSha256, digest('scripts/proximity-config.json'));
    assert.deepEqual(Object.keys(data).sort(), ['configSha256', 'distancesKm', 'ids', 'sourceSha256', 'version']);
    const world = JSON.parse(fs.readFileSync(path.join(root, 'countries_merged.geojson'), 'utf8'));
    const ids = world.features.filter(f => f.properties.game_name).map(f => f.id);
    const scorer = new ProximityScorer(data, ids);
    for (let i = 0; i < ids.length; i++) {
        assert.equal(data.distancesKm[i][i], 0);
        for (let j = 0; j < ids.length; j++) {
            assert.equal(data.distancesKm[i][j], data.distancesKm[j][i]);
            assert.ok(data.distancesKm[i][j] >= 0 && data.distancesKm[i][j] <= 20016);
        }
        assert.ok(scorer.record(ids[i]));
    }
    assert.equal(scorer.guessed.size, 196);
    assert.ok(Number.isFinite(scorer.total));
    for (const [a, b] of config.landBorderCorrections) assert.equal(mapDistance(a, b), 0);
});

test('real map: a previous island can be closer than the last guessed mainland country', () => {
    const scorer = new ProximityScorer(data, data.ids);
    scorer.record(hashId('FJI'));
    assert.ok(scorer.record(hashId('AUS')).penalty > 0);
    const result = scorer.record(hashId('TON'));
    assert.equal(result.neighborId, hashId('FJI'));
    assert.equal(result.penalty, mapDistance('FJI', 'TON') / 100);
    assert.ok(result.penalty > 0);
    assert.ok(result.distanceKm < mapDistance('AUS', 'TON'));
});

test('real map: a previous shared border adds zero after a distant guess', () => {
    const scorer = new ProximityScorer(data, data.ids);
    scorer.record(hashId('EGY'));
    assert.ok(scorer.record(hashId('JPN')).penalty > 80);
    const result = scorer.record(hashId('LBY'));
    assert.equal(result.neighborId, hashId('EGY'));
    assert.equal(result.distanceKm, 0);
    assert.equal(result.penalty, 0);
});

test('Bering Strait follows the distance formula in both directions', () => {
    for (const [a, b] of [['USA', 'RUS'], ['RUS', 'USA']]) {
        const scorer = new ProximityScorer(data, data.ids);
        scorer.record(hashId(a));
        const result = scorer.record(hashId(b));
        assert.equal(result.neighborId, hashId(a));
        assert.equal(result.penalty, mapDistance(a, b) / 100);
        assert.ok(result.penalty > 0);
    }
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
