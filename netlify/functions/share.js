// functions/share.js
// URL routing and dynamic SEO metadata generation

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_API = 'https://api.github.com';
const SITE_URL = process.env.SITE_URL || 'https://soundwave.buzz';

async function getTrackData(trackId) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/index.json`;
        const response = await fetch(`${GITHUB_API}/${path}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.tracks?.find(t => t.id === trackId) || null;
        }
        return null;
    } catch (error) {
        console.error('Error fetching track:', error);
        return null;
    }
}

async function getArtistData(username) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/users/${username}.json`;
        const response = await fetch(`${GITHUB_API}/${path}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error fetching artist:', error);
        return null;
    }
}

function formatDuration(seconds) {
    if (!seconds) return 'PT0S';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `PT${mins}M${secs}S`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function generateTrackMetadata(track) {
    const title = `${track.title} by ${track.artist} - SoundWave | Free Music Streaming`;
    const description = `Listen to "${track.title}" by ${track.artist} on SoundWave. Free streaming of ${track.genre} music. ${track.description || 'Discover amazing independent artists.'}`;
    
    const url = `${SITE_URL}/track/${track.id}`;
    const imageUrl = track.cover || `${SITE_URL}/og-image-track.jpg`;

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "MusicRecording",
        "name": track.title,
        "description": track.description || "Independent music track",
        "url": url,
        "byArtist": {
            "@type": "Person",
            "name": track.artist,
            "url": `${SITE_URL}/artist/@${track.artist}`
        },
        "duration": formatDuration(track.duration),
        "genre": track.genre,
        "datePublished": track.createdAt,
        "image": imageUrl,
        "audio": {
            "@type": "AudioObject",
            "url": track.audioUrl,
            "encodingFormat": "audio/mpeg"
        },
        "inAlbum": {
            "@type": "MusicAlbum",
            "name": "SoundWave",
            "url": SITE_URL
        },
        "interactionStatistic": [
            {
                "@type": "InteractionCounter",
                "interactionType": "http://schema.org/PlayAction",
                "userInteractionCount": track.plays || 0
            },
            {
                "@type": "InteractionCounter",
                "interactionType": "http://schema.org/LikeAction",
                "userInteractionCount": track.likes || 0
            }
        ]
    };

    return {
        title,
        description,
        url,
        imageUrl,
        structuredData
    };
}

function generateArtistMetadata(artist, trackCount = 0, totalPlays = 0) {
    const title = `${artist.username} - Music Artist on SoundWave | Listen to ${trackCount} Free Tracks`;
    const description = `Listen to ${artist.username} on SoundWave. ${trackCount} tracks, ${(artist.followers || []).length} followers. Genre: ${artist.primaryGenre || 'Various'}. ${artist.bio || 'Independent artist on SoundWave.'}`;
    
    const url = `${SITE_URL}/artist/@${artist.username}`;
    const imageUrl = artist.avatar_url || `${SITE_URL}/og-image-artist.jpg`;

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "MusicGroup",
        "name": artist.username,
        "description": artist.bio || "Independent music artist",
        "url": url,
        "image": imageUrl,
        "genre": artist.primaryGenre || "Various",
        "foundingDate": artist.createdAt,
        "sameAs": artist.socialLinks || [],
        "interactionStatistic": [
            {
                "@type": "InteractionCounter",
                "interactionType": "http://schema.org/FollowAction",
                "userInteractionCount": (artist.followers || []).length
            },
            {
                "@type": "InteractionCounter",
                "interactionType": "http://schema.org/PlayAction",
                "userInteractionCount": totalPlays
            }
        ]
    };

    return {
        title,
        description,
        url,
        imageUrl,
        structuredData
    };
}

exports.handler = async (event) => {
    const path = event.path;
    const method = event.httpMethod;

    try {
        if (path.includes('/share/track')) {
            return await handleTrackShare(event);
        } else if (path.includes('/share/artist')) {
            return await handleArtistShare(event);
        } else if (path.includes('/og-image')) {
            return await generateOGImage(event);
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Not found' })
            };
        }
    } catch (error) {
        console.error('Share error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function handleTrackShare(event) {
    const params = event.queryStringParameters || {};
    const trackId = params.trackId || event.path.split('/').pop();

    if (!trackId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing trackId' })
        };
    }

    const track = await getTrackData(trackId);

    if (!track) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Track not found' })
        };
    }

    const metadata = generateTrackMetadata(track);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            track: {
                id: track.id,
                title: track.title,
                artist: track.artist,
                description: track.description,
                genre: track.genre,
                cover: track.cover,
                plays: track.plays || 0,
                likes: track.likes || 0,
                duration: track.duration
            },
            metadata: {
                title: metadata.title,
                description: metadata.description,
                url: metadata.url,
                imageUrl: metadata.imageUrl
            },
            structuredData: metadata.structuredData
        })
    };
}

async function handleArtistShare(event) {
    const params = event.queryStringParameters || {};
    const username = params.username || event.path.split('/').pop();

    if (!username) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing username' })
        };
    }

    const artist = await getArtistData(username);

    if (!artist) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Artist not found' })
        };
    }

    // Get artist tracks count
    let trackCount = 0;
    let totalPlays = 0;
    try {
        const tracksPath = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/index.json`;
        const tracksResponse = await fetch(`${GITHUB_API}/${tracksPath}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (tracksResponse.ok) {
            const tracksData = await tracksResponse.json();
            const artistTracks = tracksData.tracks?.filter(t => t.artist === username) || [];
            trackCount = artistTracks.length;
            totalPlays = artistTracks.reduce((sum, t) => sum + (t.plays || 0), 0);
        }
    } catch (e) {
        console.warn('Could not fetch artist tracks');
    }

    const metadata = generateArtistMetadata(artist, trackCount, totalPlays);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            artist: {
                username: artist.username,
                email: artist.email,
                bio: artist.bio || '',
                verified: artist.verified || false,
                followers: (artist.followers || []).length,
                following: (artist.following || []).length,
                tracksCount: trackCount,
                totalPlays
            },
            metadata: {
                title: metadata.title,
                description: metadata.description,
                url: metadata.url,
                imageUrl: metadata.imageUrl
            },
            structuredData: metadata.structuredData
        })
    };
}

async function generateOGImage(event) {
    // This would require an image generation service like imgix or custom serverless image generation
    // For now, return a redirect to a placeholder
    const type = event.queryStringParameters?.type || 'track';
    
    return {
        statusCode: 302,
        headers: {
            'Location': `${SITE_URL}/images/og-${type}.jpg`
        }
    };
}

// Additional helper for URL generation
exports.getShareURL = (type, id) => {
    if (type === 'track') {
        return `${SITE_URL}/track/${id}`;
    } else if (type === 'artist') {
        return `${SITE_URL}/artist/@${id}`;
    }
    return SITE_URL;
};