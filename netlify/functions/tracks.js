// Netlify Function: Get all tracks

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_API = 'https://api.github.com';

exports.handler = async (event) => {
    console.log('=== Tracks Function ===');
    console.log('Method:', event.httpMethod);

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true })
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        if (!GITHUB_TOKEN) {
            console.error('No GITHUB_TOKEN');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'GitHub token not configured',
                    tracks: []
                })
            };
        }

        // Get all tracks from tracks/ folder
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks`;

        console.log('Fetching from:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        console.log('GitHub response status:', response.status);

        if (!response.ok) {
            if (response.status === 404) {
                console.log('Tracks folder not found - returning empty array');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        tracks: []
                    })
                };
            }

            const errorText = await response.text();
            console.error('GitHub error:', response.status, errorText.substring(0, 200));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to fetch tracks',
                    tracks: []
                })
            };
        }

        const files = await response.json();
        console.log('Found files:', files.length);

        if (!Array.isArray(files)) {
            console.error('Response is not an array');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    tracks: []
                })
            };
        }

        // Fetch all track metadata
        const tracks = [];

        for (const file of files) {
            if (file.name.endsWith('.json')) {
                try {
                    const fileResponse = await fetch(file.url, {
                        headers: {
                            'Authorization': `token ${GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });

                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json();
                        const trackJson = JSON.parse(
                            Buffer.from(fileData.content, 'base64').toString('utf-8')
                        );
                        tracks.push(trackJson);
                        console.log('Loaded track:', trackJson.id);
                    }
                } catch (error) {
                    console.error('Error loading track:', file.name, error.message);
                }
            }
        }

        console.log('✅ Total tracks loaded:', tracks.length);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                tracks: tracks
            })
        };

    } catch (error) {
        console.error('Tracks function error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                tracks: []
            })
        };
    }
};