// Netlify Function: Get and Save tracks

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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    // ★ GET リクエスト: トラックを取得
    if (event.httpMethod === 'GET') {
        return handleGetTracks(headers);
    }

    // ★ POST リクエスト: トラックを保存
    if (event.httpMethod === 'POST') {
        return handlePostTracks(event, headers);
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};

// GET: トラックを取得
async function handleGetTracks(headers) {
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
        console.error('Get tracks error:', error.message);
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
}

// ★ POST: トラックを保存
async function handlePostTracks(event, headers) {
    try {
        if (!GITHUB_TOKEN) {
            console.error('No GITHUB_TOKEN');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'GitHub token not configured'
                })
            };
        }

        let body;
        try {
            body = JSON.parse(event.body);
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid JSON'
                })
            };
        }

        const { tracks } = body;

        if (!Array.isArray(tracks)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Tracks must be an array'
                })
            };
        }

        console.log(`Saving ${tracks.length} tracks to GitHub...`);

        // ★ 各トラックを GitHub に保存
        for (const track of tracks) {
            try {
                const trackId = track.id || `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const fileName = `${trackId}.json`;
                const filePath = `tracks/${fileName}`;

                const trackContent = JSON.stringify(track, null, 2);
                const encodedContent = Buffer.from(trackContent).toString('base64');

                // GitHub API で ファイルを作成/更新
                const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

                // ★ 既存ファイルの SHA を取得（更新時に必要）
                let sha = null;
                try {
                    const getResponse = await fetch(url, {
                        headers: {
                            'Authorization': `token ${GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });

                    if (getResponse.ok) {
                        const existingFile = await getResponse.json();
                        sha = existingFile.sha;
                        console.log(`Updating existing track: ${trackId}`);
                    }
                } catch (e) {
                    console.log(`Creating new track: ${trackId}`);
                }

                // ★ ファイルを作成/更新
                const putBody = {
                    message: `Update track: ${track.title || trackId}`,
                    content: encodedContent,
                    branch: 'main'
                };

                if (sha) {
                    putBody.sha = sha;
                }

                const putResponse = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(putBody)
                });

                if (!putResponse.ok) {
                    const errorText = await putResponse.text();
                    console.error(`Failed to save track ${trackId}:`, putResponse.status, errorText.substring(0, 200));
                } else {
                    console.log(`✅ Saved track: ${trackId}`);
                }

            } catch (error) {
                console.error('Error saving individual track:', error.message);
                // Continue with next track
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Saved ${tracks.length} tracks`,
                count: tracks.length
            })
        };

    } catch (error) {
        console.error('Post tracks error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
}