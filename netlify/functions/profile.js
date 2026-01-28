// Netlify Function: Save and Get profile

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_API = 'https://api.github.com';

exports.handler = async (event) => {
    console.log('=== Profile Function ===');
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

    // ★ GET リクエスト: プロフィール情報を取得
    if (event.httpMethod === 'GET') {
        return handleGetProfile(event, headers);
    }

    // ★ POST リクエスト: プロフィール情報を保存
    if (event.httpMethod === 'POST') {
        return handlePostProfile(event, headers);
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};

// ★ GET: プロフィール情報を取得
async function handleGetProfile(event, headers) {
    try {
        const username = event.queryStringParameters?.username;
        
        console.log('=== GET Profile Request ===');
        console.log('Username:', username);

        if (!username) {
            console.error('No username provided');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Username required'
                })
            };
        }

        // ★ 環境変数をチェック
        console.log('Checking env vars:');
        console.log('  GITHUB_TOKEN:', GITHUB_TOKEN ? '✅ set' : '❌ missing');
        console.log('  GITHUB_OWNER:', GITHUB_OWNER);
        console.log('  GITHUB_REPO:', GITHUB_REPO);

        if (!GITHUB_TOKEN) {
            console.error('No GITHUB_TOKEN configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'GitHub token not configured'
                })
            };
        }

        // ★ GitHub から profiles/username.json を取得
        const filePath = `profiles/${username}.json`;
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

        console.log('Fetching from GitHub:');
        console.log('  URL:', url);

        let response;
        try {
            response = await fetch(url, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
        } catch (fetchError) {
            console.error('Fetch error:', fetchError.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to fetch from GitHub: ' + fetchError.message
                })
            };
        }

        console.log('GitHub response status:', response.status);

        if (!response.ok) {
            if (response.status === 404) {
                console.log('Profile not found - returning default');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        profile: {
                            name: username,
                            email: '',
                            location: '',
                            bio: '',
                            avatarLetter: username.charAt(0).toUpperCase(),
                            avatarUrl: '',
                            verified: false,
                            followers: 0,
                            createdAt: new Date().toISOString()
                        }
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
                    error: 'Failed to fetch profile: ' + response.status
                })
            };
        }

        // ★ レスポンスをパース
        let fileData;
        try {
            fileData = await response.json();
        } catch (parseError) {
            console.error('JSON parse error:', parseError.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to parse GitHub response'
                })
            };
        }

        console.log('✅ File data received from GitHub');

        // ★ Base64 をデコード
        let profileJson;
        try {
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            profileJson = JSON.parse(content);
            console.log('✅ Profile decoded:', profileJson.name);
        } catch (decodeError) {
            console.error('Decode/parse error:', decodeError.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to decode profile'
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                profile: profileJson,
                sha: fileData.sha
            })
        };

    } catch (error) {
        console.error('Get profile error:', error.message, error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error: ' + error.message
            })
        };
    }
}

// ★ POST: プロフィール情報を保存
async function handlePostProfile(event, headers) {
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

        // ★ リクエストボディをデバッグ
        console.log('Request body:', event.body ? event.body.substring(0, 200) : 'empty');

        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Empty request body'
                })
            };
        }

        let body;
        try {
            body = JSON.parse(event.body);
        } catch (e) {
            console.error('JSON parse error:', e.message);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid JSON: ' + e.message
                })
            };
        }

        const { action, username, profile, sha } = body;

        console.log('Parsed action:', action, 'username:', username, 'has profile:', !!profile);

        if (action !== 'save') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid action: ' + action
                })
            };
        }

        if (!username) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Username required'
                })
            };
        }

        if (!profile || typeof profile !== 'object') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Profile must be an object'
                })
            };
        }

        console.log(`Saving profile for ${username}...`);

        // ★ プロフィール情報を GitHub に保存
        const filePath = `profiles/${username}.json`;
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

        // ★ 既存ファイルの SHA を取得（更新時に必要）
        let existingSha = sha;
        if (!existingSha) {
            try {
                const getResponse = await fetch(url, {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (getResponse.ok) {
                    const existingFile = await getResponse.json();
                    existingSha = existingFile.sha;
                    console.log(`Found existing profile, SHA: ${existingSha}`);
                }
            } catch (e) {
                console.log('No existing profile, creating new');
            }
        }

        // ★ プロフィール情報を整形
        const profileData = {
            name: profile.name,
            email: profile.email || '',
            location: profile.location || '',
            bio: profile.bio || '',
            avatarLetter: profile.avatarLetter || username.charAt(0).toUpperCase(),
            avatarUrl: profile.avatarUrl || '',  // ★ 画像 URL またはBase64
            verified: profile.verified || false,
            followers: profile.followers || 0,
            updatedAt: new Date().toISOString(),
            createdAt: profile.createdAt || new Date().toISOString()
        };

        const profileContent = JSON.stringify(profileData, null, 2);
        const encodedContent = Buffer.from(profileContent).toString('base64');

        // ★ GitHub に保存
        const putBody = {
            message: `Update profile: ${profile.name}`,
            content: encodedContent,
            branch: 'main'
        };

        if (existingSha) {
            putBody.sha = existingSha;
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

        console.log('PUT response status:', putResponse.status);

        if (!putResponse.ok) {
            const errorText = await putResponse.text();
            console.error('Failed to save profile:', putResponse.status, errorText.substring(0, 200));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Failed to save profile: ${putResponse.status}`
                })
            };
        }

        // ★ レスポンスをテキストで先に読んで、JSONか確認
        let putData;
        try {
            putData = await putResponse.json();
            console.log('✅ Saved profile:', username, 'SHA:', putData?.content?.sha?.substring(0, 8));
        } catch (e) {
            console.warn('⚠️ Could not parse PUT response as JSON:', e.message);
            // GitHub API が正常に保存した場合でも JSON がない場合がある
            putData = { content: { sha: 'unknown' } };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Profile saved for ${username}`,
                profile: profileData,
                sha: putData?.content?.sha || 'unknown'
            })
        };

    } catch (error) {
        console.error('Post profile error:', error.message);
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