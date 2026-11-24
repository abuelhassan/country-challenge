#!/usr/bin/env node
// Generate scoring data from the same simplified geometry used by the map.
// Run after merge_geojson.py: node scripts/build_proximity.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const EARTH_RADIUS_KM = 6371.0088;
const EPSILON = 1e-10;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(...a);
const unit = a => { const n = length(a); return a.map(x => x / n); };
const angle = (a, b) => Math.atan2(length(cross(a, b)), dot(a, b));

function vector([lon, lat]) {
    lon *= Math.PI / 180;
    lat *= Math.PI / 180;
    return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

function onArc(p, segment) {
    return dot(p, segment.startTangent) >= -EPSILON && dot(p, segment.endTangent) >= -EPSILON;
}

function pointArcDistance(p, segment) {
    const height = dot(p, segment.normal);
    const projected = p.map((x, i) => x - height * segment.normal[i]);
    if (length(projected) > EPSILON && onArc(projected, segment)) {
        return Math.asin(Math.min(1, Math.abs(height)));
    }
    return Math.min(angle(p, segment.a), angle(p, segment.b));
}

function geometryShape(geometry) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) throw new Error('Unsupported geometry');
    const points = [], segments = [];
    for (const polygon of polygons) {
        for (const ring of polygon) {
            const vertices = ring.map(vector);
            for (let i = 1; i < vertices.length; i++) {
                const a = vertices[i - 1], b = vertices[i], normal = cross(a, b);
                if (length(normal) < EPSILON) continue; // duplicates, including date-line seam points
                const n = unit(normal);
                points.push(a);
                segments.push({a, b, normal: n, startTangent: cross(n, a), endTangent: cross(b, n)});
            }
        }
    }
    if (!segments.length) throw new Error('Empty country geometry');
    return {points, segments};
}

function boundaryDistance(a, b) {
    let minimum = Infinity;
    // On minor great-circle arcs a minimum lies at an endpoint projection,
    // unless the arcs intersect. Work in 3D to handle the date line naturally.
    for (const p of a.points) for (const s of b.segments) {
        minimum = Math.min(minimum, pointArcDistance(p, s));
        if (minimum < EPSILON) return 0;
    }
    for (const p of b.points) for (const s of a.segments) {
        minimum = Math.min(minimum, pointArcDistance(p, s));
        if (minimum < EPSILON) return 0;
    }
    for (const s of a.segments) for (const t of b.segments) {
        const intersection = cross(s.normal, t.normal);
        if (length(intersection) < EPSILON) continue;
        const p = unit(intersection);
        if ((onArc(p, s) && onArc(p, t)) ||
            (onArc(p.map(x => -x), s) && onArc(p.map(x => -x), t))) return 0;
    }
    return minimum * EARTH_RADIUS_KM;
}

const hashId = iso => crypto.createHash('md5').update(iso).digest('hex').slice(0, 8);
const pairKey = (a, b) => [a, b].sort().join(':');

function build(world, config) {
    const features = world.features.filter(f => f.properties.game_name);
    const ids = features.map(f => f.id);
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate country IDs');
    if (!Array.isArray(config.landBorderCorrections)) throw new Error('Invalid land border corrections');
    const known = new Set(ids);
    const explicitBorders = new Set();
    for (const pair of config.landBorderCorrections) {
        if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] ||
            pair.some(iso => typeof iso !== 'string' || !known.has(hashId(iso)))) {
            throw new Error('Invalid land border correction');
        }
        explicitBorders.add(pairKey(...pair.map(hashId)));
    }
    const shapes = features.map(f => geometryShape(f.geometry));
    const distancesKm = ids.map(() => ids.map(() => 0));
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const km = explicitBorders.has(pairKey(ids[i], ids[j])) ? 0 : boundaryDistance(shapes[i], shapes[j]);
            distancesKm[i][j] = distancesKm[j][i] = Math.round(km * 1000) / 1000;
        }
    }
    return {version: 2, ids, distancesKm};
}

if (require.main === module) {
    const root = path.resolve(__dirname, '..');
    const source = fs.readFileSync(path.join(root, 'countries_merged.geojson'));
    const configSource = fs.readFileSync(path.join(__dirname, 'proximity-config.json'));
    const data = build(JSON.parse(source), JSON.parse(configSource));
    data.sourceSha256 = crypto.createHash('sha256').update(source).digest('hex');
    data.configSha256 = crypto.createHash('sha256').update(configSource).digest('hex');
    fs.writeFileSync(path.join(root, 'proximity.json'), JSON.stringify(data) + '\n');
    console.log(`Generated distances for ${data.ids.length} countries.`);
}

module.exports = {vector, geometryShape, boundaryDistance, build, hashId};
