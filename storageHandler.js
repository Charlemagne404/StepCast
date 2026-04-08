export class LocalStorageHandler {
    constructor() {}

    getStoredWalks() {
        try {
            const walks = JSON.parse(localStorage.getItem('walks'));
            return Array.isArray(walks) ? walks : [];
        } catch (error) {
            console.error('Failed to parse saved walks:', error);
            return [];
        }
    }

    saveWalkToLocalStorage(walk) {
        const walks = this.getStoredWalks();
        walks.push(walk);
        localStorage.setItem('walks', JSON.stringify(walks));
    }

    removeWalkFromLocalStorage(walk) {
        const walks = this.getStoredWalks().filter((storedWalk) => storedWalk.id !== walk.id);
        localStorage.setItem('walks', JSON.stringify(walks));
    }

    retrieveWalksFromLocalStorage() {
        return this.getStoredWalks();
    }

    clearLocalStorage() {
        localStorage.setItem('walks', JSON.stringify([]));
    }
}
