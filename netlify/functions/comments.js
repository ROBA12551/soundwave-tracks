const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

// コメントファイルを取得
async function getComments(trackId) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/comments/${trackId}.json`;
        const response = await fetch(`${GITHUB_API}/${path}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (response.ok) {
            return await response.json();
        }
        return { comments: [] };
    } catch (error) {
        console.error('Error fetching comments:', error);
        return { comments: [] };
    }
}

// コメントを保存
async function saveComments(trackId, data) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/comments/${trackId}.json`;

        let sha = null;
        try {
            const getResponse = await fetch(`${GITHUB_API}/${path}`, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                }
            });
            if (getResponse.ok) {
                const getJson = await getResponse.json();
                sha = getJson.sha;
            }
        } catch (e) {}

        const response = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/comments/${trackId}.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update comments for track ${trackId}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Error saving comments:', error);
        return false;
    }
}

exports.handler = async (event) => {
    const method = event.httpMethod;

    try {
        if (method === 'GET') {
            return await handleGetComments(event);
        } else if (method === 'POST') {
            return await handlePostComment(event);
        } else {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
    } catch (error) {
        console.error('Comments error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// GETハンドラー
async function handleGetComments(event) {
    const params = event.queryStringParameters || {};
    const trackId = params.trackId;

    if (!trackId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing trackId' })
        };
    }

    const data = await getComments(trackId);

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data)
    };
}

// POSTハンドラー
async function handlePostComment(event) {
    try {
        const body = JSON.parse(event.body || '{}');
        const { trackId, username, text, timestamp } = body;

        if (!trackId || !username || !text) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        const data = await getComments(trackId);

        // Add new comment
        data.comments.push({
            id: `${Date.now()}-${Math.random()}`,
            username,
            text,
            timestamp: timestamp || new Date().toISOString(),
            likes: 0
        });

        const success = await saveComments(trackId, data);

        return {
            statusCode: success ? 201 : 500,
            body: JSON.stringify({
                success,
                comments: success ? data.comments : null
            })
        };
    } catch (error) {
        console.error('Error posting comment:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}
