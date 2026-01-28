/**
 * BeatWave Algorithm Module
 * Handles recommendations, rankings, and personalization
 */

class BeatWaveModule {
    constructor() {
        this.API_BASE = '/.netlify/functions';
        this.cache = {};
        this.userHistory = JSON.parse(localStorage.getItem('soundwave_history') || '[]');
        this.userLikes = new Set(JSON.parse(localStorage.getItem('soundwave_likedTracks') || '[]'));
    }

    /**
     * Get trending tracks
     */
    async getTrending() {
        return this.getRecommendations('trending');
    }

    /**
     * Get new tracks
     */
    async getNew() {
        return this.getRecommendations('new');
    }

    /**
     * Get personalized recommendations
     */
    async getForYou() {
        return this.getRecommendations('foryou');
    }

    /**
     * Fetch recommendations
     */
    async getRecommendations(type) {
        try {
            const cacheKey = `rec_${type}`;
            if (this.cache[cacheKey] && Date.now() - this.cache[cacheKey].time < 60000) {
                return this.cache[cacheKey].data;
            }

            const response = await fetch(`${this.API_BASE}/recommendations?type=${type}`);
            const data = await response.json();

            this.cache[cacheKey] = {
                data: data.tracks || [],
                time: Date.now()
            };

            return data.tracks || [];
        } catch (error) {
            console.error('Error getting recommendations:', error);
            return [];
        }
    }

    /**
     * Record play in history
     */
    recordPlay(trackId, trackTitle, trackArtist) {
        const item = {
            id: trackId,
            title: trackTitle,
            artist: trackArtist,
            timestamp: new Date().toISOString(),
            playedAt: Date.now()
        };

        this.userHistory.unshift(item);
        
        // Keep only last 100 plays
        if (this.userHistory.length > 100) {
            this.userHistory = this.userHistory.slice(0, 100);
        }

        localStorage.setItem('soundwave_history', JSON.stringify(this.userHistory));
    }

    /**
     * Get user's play history
     */
    getHistory(limit = 20) {
        return this.userHistory.slice(0, limit);
    }

    /**
     * Get user's liked tracks
     */
    getLikes(allTracks) {
        if (!allTracks) return [];
        return allTracks.filter(t => this.userLikes.has(t.id));
    }

    /**
     * Calculate track score for ranking
     */
    calculateScore(track) {
        let score = 0;

        // Plays (40%)
        score += (track.plays || 0) * 0.4;

        // Likes (30%)
        score += (track.likes || 0) * 0.3;

        // Recency (20%)
        const daysSinceCreated = (Date.now() - new Date(track.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 10 - daysSinceCreated);
        score += recencyScore * 0.2;

        // Comments (10%)
        score += (track.comments || 0) * 0.1;

        return score;
    }

    /**
     * Get similar tracks based on genre
     */
    getSimilarTracks(trackGenre, allTracks, limit = 5) {
        return allTracks
            .filter(t => t.genre === trackGenre)
            .sort((a, b) => this.calculateScore(b) - this.calculateScore(a))
            .slice(0, limit);
    }

    /**
     * Search with filtering
     */
    search(tracks, query, filters = {}) {
        const lowerQuery = query.toLowerCase();

        let results = tracks.filter(t => {
            const matchTitle = t.title.toLowerCase().includes(lowerQuery);
            const matchArtist = t.artist.toLowerCase().includes(lowerQuery);
            const matchGenre = (filters.genre && t.genre === filters.genre) || !filters.genre;

            return (matchTitle || matchArtist) && matchGenre;
        });

        // Sort by relevance
        results.sort((a, b) => {
            const aTitle = a.title.toLowerCase().indexOf(lowerQuery);
            const bTitle = b.title.toLowerCase().indexOf(lowerQuery);
            return aTitle - bTitle;
        });

        return results;
    }

    /**
     * Get trending by genre
     */
    getTrendingByGenre(genre, allTracks, limit = 10) {
        return allTracks
            .filter(t => t.genre === genre)
            .sort((a, b) => (b.plays || 0) - (a.plays || 0))
            .slice(0, limit);
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.userHistory = [];
        localStorage.setItem('soundwave_history', JSON.stringify([]));
    }

    /**
     * Get listening stats
     */
    getStats() {
        const totalPlays = this.userHistory.length;
        const artists = {};
        const genres = {};

        this.userHistory.forEach(track => {
            artists[track.artist] = (artists[track.artist] || 0) + 1;
        });

        return {
            totalPlays,
            topArtists: Object.entries(artists)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            likedCount: this.userLikes.size
        };
    }
}

// Create global instance
const beatWaveModule = new BeatWaveModule();

// Export for use
window.beatWaveModule = beatWaveModule;