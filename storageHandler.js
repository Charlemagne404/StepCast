export class LocalStorageHandler {
    constructor() {}

    sanitizeWalk(walk) {
        const points = Array.isArray(walk?.points)
            ? walk.points
                .map((point) => ({
                    lat: Number(point?.lat),
                    lng: Number(point?.lng),
                }))
                .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
            : [];

        return {
            id: String(walk?.id || walk?.clientId || '').trim(),
            clientId: String(walk?.clientId || walk?.id || '').trim(),
            podcastName: String(walk?.podcastName || '').trim(),
            podcastIndex: Number.isFinite(Number(walk?.podcastIndex)) ? Number(walk.podcastIndex) : -1,
            podcast: walk?.podcast && typeof walk.podcast === 'object' ? walk.podcast : null,
            podcastFetchAdress: String(walk?.podcastFetchAdress || ''),
            points,
            date: walk?.date || new Date().toISOString(),
            updatedAt: walk?.updatedAt || '',
        };
    }

    persistWalks(walks) {
        const sanitizedWalks = walks
            .map((walk) => this.sanitizeWalk(walk))
            .filter((walk) => walk.id && walk.podcastName && walk.points.length > 0);

        localStorage.setItem('walks', JSON.stringify(sanitizedWalks));
        return sanitizedWalks;
    }

    getStoredWalks() {
        try {
            const walks = JSON.parse(localStorage.getItem('walks'));
            return Array.isArray(walks)
                ? walks.map((walk) => this.sanitizeWalk(walk)).filter((walk) => walk.id)
                : [];
        } catch (error) {
            console.error('Failed to parse saved walks:', error);
            return [];
        }
    }

    saveWalkToLocalStorage(walk) {
        const walks = this.getStoredWalks();
        walks.push(this.sanitizeWalk(walk));
        this.persistWalks(walks);
    }

    upsertWalkInLocalStorage(walk) {
        const nextWalk = this.sanitizeWalk(walk);
        const walks = this.getStoredWalks();
        const existingIndex = walks.findIndex((storedWalk) => storedWalk.id === nextWalk.id);

        if (existingIndex >= 0) {
            walks[existingIndex] = {
                ...walks[existingIndex],
                ...nextWalk,
            };
        } else {
            walks.push(nextWalk);
        }

        this.persistWalks(walks);
        return nextWalk;
    }

    mergeWalksIntoLocalStorage(walksToMerge) {
        const mergedById = new Map();

        for (const walk of this.getStoredWalks()) {
            mergedById.set(walk.id, walk);
        }

        for (const walk of walksToMerge) {
            const nextWalk = this.sanitizeWalk(walk);
            if (nextWalk.id) {
                mergedById.set(nextWalk.id, {
                    ...(mergedById.get(nextWalk.id) || {}),
                    ...nextWalk,
                });
            }
        }

        return this.persistWalks(Array.from(mergedById.values()));
    }

    removeWalkFromLocalStorage(walk) {
        const walks = this.getStoredWalks().filter((storedWalk) => storedWalk.id !== walk.id);
        this.persistWalks(walks);
    }

    retrieveWalksFromLocalStorage() {
        return this.getStoredWalks();
    }

    clearLocalStorage() {
        this.persistWalks([]);
    }
}
