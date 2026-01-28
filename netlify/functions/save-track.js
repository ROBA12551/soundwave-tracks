// Save Track Metadata
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

function generateTrackId() {
    return 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function saveMetadata(metadata) {
    try {
        const trackId = metadata.trackId || generateTrackId();
        const path = `tracks/${trackId}.json`;
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

        const jsonStr = JSON.stringify(metadata, null, 2);
        const base64 = Buffer.from(jsonStr).toString('base64');

        let sha = null;
        try {
            const getResp = await fetch(url, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
            if (getResp.ok) {
                const data = await getResp.json();
                sha = data.sha;
            }
        } catch (e) {}

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Add track ${trackId}`,
                content: base64,
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        if (!response.ok) {
            throw new Error(`GitHub ${response.status}`);
        }

        return { success: true, trackId };
    } catch (error) {
        console.error('Save error:', error.message);
        return { success: false, error: error.message };
    }
}

exports.handler = async (event) => {
    console.log('=== Save Track ===');

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '{}' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        if (!GITHUB_TOKEN) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'No token' })
            };
        }

        let metadata = {};
        try {
            metadata = JSON.parse(event.body || '{}');
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' })
            };
        }

        if (!metadata.title || !metadata.artist || !metadata.audioUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing fields' })
            };
        }

        const trackId = generateTrackId();
        metadata.id = trackId;
        metadata.createdAt = metadata.createdAt || new Date().toISOString();
        metadata.plays = 0;
        metadata.likes = 0;
        metadata.comments = 0;

        const result = await saveMetadata(metadata);

        if (result.success) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    trackId: result.trackId,
                    metadata
                })
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: result.error })
            };
        }
    } catch (error) {
        console.error('Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};