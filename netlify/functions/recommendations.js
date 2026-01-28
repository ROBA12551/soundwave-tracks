// Netlify Function - Recommendations (Trending, New, For You)

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

async function getAllTracks() {
    try {
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks`;
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!response.ok) return [];

        const files = await response.json();
        if (!Array.isArray(files)) return [];

        const tracks = [];
        for (const file of files) {
            if (file.name.endsWith('.json')) {
                try {
                    const fileResp = await fetch(file.url, {
                        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
                    });
                    const fileData = await fileResp.json();
                    const track = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
                    tracks.push(track);
                } catch (e) {}
            }
        }

        return tracks;
    } catch (error) {
        console.error('Error getting tracks:', error.message);
        return [];
    }
}

exports.handler = async (event) => {
    console.log('=== Recommendations ===');

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    try {
        const params = event.queryStringParameters || {};
        const type = params.type || 'trending'; // trending, new, foryou

        const tracks = await getAllTracks();
        if (!tracks || tracks.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ tracks: [] })
            };
        }

        let result = [];

        if (type === 'trending') {
            // Sort by plays (most played)
            result = tracks
                .sort((a, b) => (b.plays || 0) - (a.plays || 0))
                .slice(0, 20);
        } else if (type === 'new') {
            // Sort by creation date (newest)
            result = tracks
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 20);
        } else if (type === 'foryou') {
            // Mix of trending + new + likes
            const trending = tracks
                .sort((a, b) => (b.plays || 0) - (a.plays || 0))
                .slice(0, 10);
            
            const new_tracks = tracks
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 10);

            const liked = tracks
                .filter(t => (t.likes || 0) > 5)
                .sort((a, b) => (b.likes || 0) - (a.likes || 0))
                .slice(0, 10);

            result = [...trending, ...new_tracks, ...liked];
            // Remove duplicates
            result = result.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i).slice(0, 20);
        }

        console.log('Returned tracks:', result.length);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ tracks: result })
        };

    } catch (error) {
        console.error('Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};