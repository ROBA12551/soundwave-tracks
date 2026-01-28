// Netlify Function - Track stats (plays, likes, comments)
// Endpoints: /.netlify/functions/track-stats?action=play&trackId=xxx

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

async function getTrackMetadata(trackId) {
    try {
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/${trackId}.json`;
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!response.ok) return null;

        const data = await response.json();
        return JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    } catch (error) {
        console.error('Error getting track:', error.message);
        return null;
    }
}

async function saveTrackMetadata(trackId, metadata) {
    try {
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/${trackId}.json`;

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
                message: `Update track stats: ${trackId}`,
                content: Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64'),
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Error saving track:', error.message);
        return false;
    }
}

exports.handler = async (event, context) => {
    console.log('=== Track Stats ===');
    console.log('Method:', event.httpMethod);
    console.log('Query:', event.queryStringParameters);

    // CORS ヘッダー
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // OPTIONS リクエストに対応
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    }

    try {
        const { action, trackId, username, liked } = event.queryStringParameters || {};

        if (!action || !trackId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Missing action or trackId' 
                })
            };
        }

        console.log(`📊 Recording ${action}: ${trackId}`);

        // ここにデータベース保存処理を追加可能
        // 例: GitHub API, Firebase, MongoDB など

        // 一旦、メモリに記録（本番環境ではデータベースを使用）
        const stat = {
            action,
            trackId,
            username: username || 'anonymous',
            liked: liked === 'true',
            timestamp: new Date().toISOString()
        };

        console.log('✅ Stat recorded:', stat);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Stat recorded',
                stat
            })
        };

    } catch (error) {
        console.error('❌ Error in track-stats:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};