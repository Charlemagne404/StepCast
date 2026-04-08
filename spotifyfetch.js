const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

async function getPodcastCover(podcastName) {
    const query = String(podcastName || '').trim();
    if (!query) {
        return '';
    }

    const response = await fetch(
        `${ITUNES_SEARCH_URL}?media=podcast&entity=podcast&limit=1&term=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
        throw new Error(`Podcast search failed with status ${response.status}`);
    }

    const data = await response.json();
    const firstResult = Array.isArray(data.results) ? data.results[0] : null;
    return firstResult?.artworkUrl600 || firstResult?.artworkUrl100 || '';
}

export async function searchPodcast(podcastName) {
    try {
        return await getPodcastCover(podcastName);
    } catch (error) {
        console.error('Podcast lookup failed:', error);
        return "";
    }
}
