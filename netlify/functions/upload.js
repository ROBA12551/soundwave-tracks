// Netlify Function - Upload with Base64

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

function generateTrackId() {
    return 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function uploadToGitHub(path, base64Content) {
    try {
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

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
                message: `Upload ${path}`,
                content: base64Content,
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        if (!response.ok) {
            throw new Error(`GitHub ${response.status}`);
        }

        const result = await response.json();
        return { success: true, url: result.content.download_url };
    } catch (error) {
        console.error('Upload error:', error.message);
        return { success: false, error: error.message };
    }
}

exports.handler = async (event) => {
    console.log('=== Upload Handler ===');
    console.log('Method:', event.httpMethod);

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        if (!GITHUB_TOKEN) {
            console.error('No token');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'GitHub token not configured' })
            };
        }

        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            console.error('JSON parse error:', e.message);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' })
            };
        }

        const {
            title,
            artist,
            genre,
            description,
            language,
            externalUrl,
            audioBase64,
            coverBase64
        } = body;

        // Validation
        if (!title || !artist || !genre) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing: title, artist, genre' })
            };
        }

        if (!audioBase64) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing audio file' })
            };
        }

        const trackId = generateTrackId();
        console.log('TrackID:', trackId);

        // Upload audio
        console.log('Uploading audio...');
        const audioPath = `uploads/${trackId}.mp3`;
        const audioResult = await uploadToGitHub(audioPath, audioBase64);

        if (!audioResult.success) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Audio upload failed' })
            };
        }

        console.log('✅ Audio uploaded');

        // Upload cover if provided
        let coverUrl = '';
        if (coverBase64) {
            console.log('Uploading cover...');
            const coverPath = `covers/${trackId}.jpg`;
            const coverResult = await uploadToGitHub(coverPath, coverBase64);
            if (coverResult.success) {
                coverUrl = coverResult.url;
                console.log('✅ Cover uploaded');
            }
        }

        // Save metadata
        console.log('Saving metadata...');
        const metadata = {
            id: trackId,
            title,
            artist,
            description: description || '',
            genre,
            language: language || 'english',
            audioUrl: audioResult.url,
            coverUrl: coverUrl || '',
            externalUrl: externalUrl || '',
            createdAt: new Date().toISOString(),
            plays: 0,
            likes: 0,
            comments: 0
        };

        const metaPath = `tracks/${trackId}.json`;
        const metaBase64 = Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64');

        const metaResult = await uploadToGitHub(metaPath, metaBase64);
        if (!metaResult.success) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Metadata save failed' })
            };
        }

        console.log('✅ Track uploaded successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                trackId,
                metadata
            })
        };

    } catch (error) {
        console.error('Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};