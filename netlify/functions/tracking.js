const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

// トラックメタデータを取得
async function getTrackMetadata(trackId) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/${trackId}.json`;
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
        console.error('Error fetching track metadata:', error);
        return null;
    }
}

// トラックメタデータを保存
async function saveTrackMetadata(trackId, data) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/${trackId}.json`;

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

        const response = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/${trackId}.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update track plays ${trackId}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Error saving track metadata:', error);
        return false;
    }
}

// プレイ統計を取得
async function getPlayStats(trackId) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/stats/${trackId}.json`;
        const response = await fetch(`${GITHUB_API}/${path}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (response.ok) {
            return await response.json();
        }
        return {
            trackId,
            plays: [],
            uniquePlayers: new Set()
        };
    } catch (error) {
        console.error('Error fetching play stats:', error);
        return {
            trackId,
            plays: [],
            uniquePlayers: new Set()
        };
    }
}

// プレイ統計を保存
async function savePlayStats(trackId, data) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/stats/${trackId}.json`;

        // Setを配列に変換
        const dataToSave = {
            ...data,
            uniquePlayers: Array.from(data.uniquePlayers || [])
        };

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

        const response = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/stats/${trackId}.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update play stats for ${trackId}`,
                content: Buffer.from(JSON.stringify(dataToSave, null, 2)).toString('base64'),
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Error saving play stats:', error);
        return false;
    }
}

exports.handler = async (event) => {
    const path = event.path;
    const method = event.httpMethod;

    try {
        if (path.includes('/play')) {
            return await handlePlayCount(event);
        } else if (path.includes('/like')) {
            return await handleLike(event);
        } else if (path.includes('/stats')) {
            return await handleGetStats(event);
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Not found' })
            };
        }
    } catch (error) {
        console.error('Tracking error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// 再生数カウント
async function handlePlayCount(event) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const trackId = event.path.split('/')[event.path.split('/').length - 2];
        const { username } = body;

        if (!trackId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing trackId' })
            };
        }

        // トラックメタデータを取得・更新
        const track = await getTrackMetadata(trackId);
        if (!track) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Track not found' })
            };
        }

        // プレイ統計を取得・更新
        const stats = await getPlayStats(trackId);
        if (!stats.uniquePlayers) stats.uniquePlayers = [];

        // 重複チェック（同じユーザーからの再生を制限）
        const today = new Date().toISOString().split('T')[0];
        const playKey = `${username}-${today}`;

        const hasPlayedToday = stats.plays.some(p => p.key === playKey);

        if (!hasPlayedToday) {
            track.plays = (track.plays || 0) + 1;
            stats.plays.push({
                key: playKey,
                username: username || 'anonymous',
                timestamp: new Date().toISOString()
            });

            if (username && !stats.uniquePlayers.includes(username)) {
                stats.uniquePlayers.push(username);
            }

            // 古いエントリを削除（30日以上前）
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            stats.plays = stats.plays.filter(p => new Date(p.timestamp) > thirtyDaysAgo);

            await saveTrackMetadata(trackId, track);
            await savePlayStats(trackId, stats);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                plays: track.plays,
                uniquePlayers: stats.uniquePlayers.length
            })
        };
    } catch (error) {
        console.error('Error handling play count:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

// いいね処理
async function handleLike(event) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const trackId = event.path.split('/')[event.path.split('/').length - 2];
        const { username, liked } = body;

        if (!trackId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing trackId' })
            };
        }

        const track = await getTrackMetadata(trackId);
        if (!track) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Track not found' })
            };
        }

        if (liked) {
            track.likes = (track.likes || 0) + 1;
        } else {
            track.likes = Math.max(0, (track.likes || 0) - 1);
        }

        await saveTrackMetadata(trackId, track);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                likes: track.likes
            })
        };
    } catch (error) {
        console.error('Error handling like:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

// 統計取得
async function handleGetStats(event) {
    try {
        const params = event.queryStringParameters || {};
        const trackId = params.trackId;

        if (!trackId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing trackId' })
            };
        }

        const stats = await getPlayStats(trackId);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(stats)
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}
