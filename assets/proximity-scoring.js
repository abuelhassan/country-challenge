/* Shared by the browser and Node's scoring tests. */
class ProximityScorer {
    constructor(data, countryIds) {
        if (data.version !== 1 || !Array.isArray(data.ids) || data.ids.length !== countryIds.length ||
            new Set(data.ids).size !== data.ids.length || countryIds.some(id => !data.ids.includes(id))) {
            throw new Error('Proximity data does not match the map');
        }
        this.index = new Map(data.ids.map((id, i) => [id, i]));
        const known = id => this.index.has(id);
        if (data.distancesKm?.length !== data.ids.length || data.landNeighbors?.length !== data.ids.length ||
            !Array.isArray(data.islandLinks)) throw new Error('Incomplete proximity data');
        for (let i = 0; i < data.ids.length; i++) {
            const row = data.distancesKm[i];
            if (!Array.isArray(row) || row.length !== data.ids.length || row.some(d => !Number.isFinite(d) || d < 0) || row[i] !== 0 ||
                !Array.isArray(data.landNeighbors[i]) || data.landNeighbors[i].some(id => !known(id))) {
                throw new Error('Invalid proximity data');
            }
        }
        this.distancesKm = data.distancesKm;
        this.landNeighbors = new Map(data.ids.map((id, i) => [id, new Set(data.landNeighbors[i])]));
        this.islandNeighbors = new Map(data.ids.map(id => [id, new Set()]));
        for (const {island, mainland, distanceKm} of data.islandLinks) {
            if (!known(island) || !known(mainland) || island === mainland || !Number.isFinite(distanceKm) || distanceKm < 0) {
                throw new Error('Invalid island link');
            }
            this.islandNeighbors.get(island).add(mainland);
            this.islandNeighbors.get(mainland).add(island);
        }
        this.reset();
    }

    reset() {
        this.guessed = new Set();
        this.lastId = null;
        this.total = 0;
    }

    record(id) {
        if (!this.index.has(id) || this.guessed.has(id)) return null;
        const result = {countryId: id, fromId: this.lastId, neighborId: null, kind: 'first', distanceKm: 0, penalty: 0};
        if (this.lastId !== null) {
            const previous = [...this.guessed];
            const border = previous.find(other => this.landNeighbors.get(id).has(other));
            const island = previous.find(other => this.islandNeighbors.get(id).has(other));
            if (border !== undefined) {
                result.kind = 'border';
                result.neighborId = border;
            } else if (island !== undefined) {
                result.kind = 'island';
                result.neighborId = island;
            } else {
                result.kind = 'distance';
                result.distanceKm = this.distancesKm[this.index.get(this.lastId)][this.index.get(id)];
                result.penalty = result.distanceKm / 100;
            }
        }
        this.total += result.penalty;
        this.guessed.add(id);
        this.lastId = id;
        return {...result, total: this.total};
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = {ProximityScorer};
