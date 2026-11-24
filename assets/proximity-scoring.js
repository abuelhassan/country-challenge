/* Shared by the browser and Node's scoring tests. */
class ProximityScorer {
    constructor(data, countryIds) {
        if (data?.version !== 2 || !Array.isArray(data.ids) || !Array.isArray(countryIds) ||
            data.ids.length !== countryIds.length || new Set(data.ids).size !== data.ids.length ||
            new Set(countryIds).size !== countryIds.length || countryIds.some(id => !data.ids.includes(id))) {
            throw new Error('Proximity data does not match the map');
        }
        this.index = new Map(data.ids.map((id, i) => [id, i]));
        if (!Array.isArray(data.distancesKm) || data.distancesKm.length !== data.ids.length) {
            throw new Error('Incomplete proximity data');
        }
        for (let i = 0; i < data.ids.length; i++) {
            const row = data.distancesKm[i];
            if (!Array.isArray(row) || row.length !== data.ids.length ||
                row.some(d => !Number.isFinite(d) || d < 0) || row[i] !== 0) {
                throw new Error('Invalid proximity data');
            }
        }
        for (let i = 0; i < data.ids.length; i++) {
            for (let j = i + 1; j < data.ids.length; j++) {
                if (data.distancesKm[i][j] !== data.distancesKm[j][i]) throw new Error('Invalid proximity data');
            }
        }
        this.distancesKm = data.distancesKm;
        this.reset();
    }

    reset() {
        this.guessed = new Set();
        this.total = 0;
    }

    record(id) {
        if (!this.index.has(id) || this.guessed.has(id)) return null;
        const result = {countryId: id, neighborId: null, kind: 'first', distanceKm: 0, penalty: 0};
        const row = this.distancesKm[this.index.get(id)];
        // Measure before adding this country, so it cannot match itself.
        // Equal distances keep the earliest guessed neighbor for stable feedback.
        for (const previous of this.guessed) {
            const distanceKm = row[this.index.get(previous)];
            if (result.neighborId === null || distanceKm < result.distanceKm) {
                result.neighborId = previous;
                result.distanceKm = distanceKm;
            }
        }
        if (result.neighborId !== null) {
            result.kind = 'distance';
            result.penalty = result.distanceKm / 100;
        }
        this.total += result.penalty;
        this.guessed.add(id);
        return {...result, total: this.total};
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = {ProximityScorer};
