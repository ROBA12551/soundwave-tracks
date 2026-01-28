const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

// すべてのトラックを取得
async function getAllTracks() {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks`;
        const response = await fetch(`${GITHUB_API}/${path}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3'
            }
        });

        if (!response.ok) return [];

        const files = await response.json();
        const tracks = [];

        for (const file of files) {
            if (file.name.endsWith('.json')) {
                const fileResponse = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/tracks/${file.name}`, {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3.raw'
                    }
                });

                if (fileResponse.ok) {
                    const track = await fileResponse.json();
                    tracks.push(track);
                }
            }
        }

        return tracks;
    } catch (error) {
        console.error('Error fetching all tracks:', error);
        return [];
    }
}

// すべてのユーザーを取得
async function getAllUsers() {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/users`;
        const response = await fetch(`${GITHUB_API}/${path}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3'
            }
        });

        if (!response.ok) return [];

        const files = await response.json();
        const users = [];

        for (const file of files) {
            if (file.name.endsWith('.json')) {
                const fileResponse = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/users/${file.name}`, {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3.raw'
                    }
                });

                if (fileResponse.ok) {
                    const user = await fileResponse.json();
                    users.push(user);
                }
            }
        }

        return users;
    } catch (error) {
        console.error('Error fetching all users:', error);
        return [];
    }
}

// ユーザープロフィール取得
async function getUserProfile(username) {
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
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// ユーザープロフィール保存
async function saveUserProfile(username, data) {
    try {
        const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/users/${username}.json`;

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

        const response = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/users/${username}.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update profile ${username}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Error saving user profile:', error);
        return false;
    }
}

exports.handler = async (event) => {
    const path = event.path;
    const method = event.httpMethod;

    try {
        if (path.includes('/search')) {
            return await handleSearch(event);
        } else if (path.includes('/artists')) {
            return await handleGetArtists(event);
        } else if (path.includes('/follow')) {
            return await handleFollow(event);
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Not found' })
            };
        }
    } catch (error) {
        console.error('Search error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// 検索ハンドラー
async function handleSearch(event) {
    const params = event.queryStringParameters || {};
    const query = (params.q || '').toLowerCase();

    if (!query) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing search query' })
        };
    }

    const tracks = await getAllTracks();

    const results = tracks.filter(track => {
        return track.title.toLowerCase().includes(query) ||
               track.artist.toLowerCase().includes(query) ||
               (track.description && track.description.toLowerCase().includes(query)) ||
               track.genre.toLowerCase().includes(query);
    });

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            tracks: results.slice(0, 20)
        })
    };
}

// アーティスト一覧ハンドラー
async function handleGetArtists(event) {
    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit) || 12;

    const users = await getAllUsers();
    const tracks = await getAllTracks();

    // アーティスト情報を構築
    const artists = users.map(user => {
        const userTracks = tracks.filter(t => t.artist === user.username);
        const totalPlays = userTracks.reduce((sum, t) => sum + (t.plays || 0), 0);

        return {
            name: user.username,
            email: user.email,
            followers: (user.followers || []).length,
            following: (user.following || []).length,
            tracksCount: userTracks.length,
            totalPlays,
            createdAt: user.createdAt
        };
    });

    // フォロワー数でソート
    artists.sort((a, b) => b.followers - a.followers);

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            artists: artists.slice(0, limit)
        })
    };
}

// フォロー/アンフォロー
async function handleFollow(event) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { username, followUsername } = body;

        if (!username || !followUsername) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        const userProfile = await getUserProfile(username);
        const followProfile = await getUserProfile(followUsername);

        if (!userProfile || !followProfile) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        // トグルフォロー
        if (!userProfile.following) userProfile.following = [];
        if (!followProfile.followers) followProfile.followers = [];

        const isFollowing = userProfile.following.includes(followUsername);

        if (isFollowing) {
            userProfile.following = userProfile.following.filter(u => u !== followUsername);
            followProfile.followers = followProfile.followers.filter(u => u !== username);
        } else {
            userProfile.following.push(followUsername);
            followProfile.followers.push(username);
        }

        await saveUserProfile(username, userProfile);
        await saveUserProfile(followUsername, followProfile);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                following: !isFollowing
            })
        };
    } catch (error) {
        console.error('Error handling follow:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}
