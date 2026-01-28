// Netlify Function: User Profile Management

const GITHUB_API = 'https://api.github.com';
const GITHUB_OWNER = 'ROBA12551';
const GITHUB_REPO = 'soundwave-tracks';
const GITHUB_BRANCH = 'main';

exports.handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS'
    };

    console.log('=== Profile Function ===');
    console.log('Method:', event.httpMethod);
    console.log('GitHub Token available:', !!process.env.GITHUB_TOKEN);
    console.log('Query params:', event.queryStringParameters);

    try {
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ok: true })
            };
        }

        // Handle GET (fetch profile)
        if (event.httpMethod === 'GET') {
            const username = event.queryStringParameters?.username;
            console.log('GET profile for:', username);

            if (!username) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Username is required'
                    })
                };
            }

            try {
                const profile = await getProfileFromGitHub(username);
                console.log('✅ Profile retrieved:', profile?.displayName || profile?.username);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        user: profile
                    })
                };
            } catch (profileError) {
                console.error('❌ Error getting profile:', profileError.message);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Failed to fetch profile: ' + profileError.message
                    })
                };
            }
        }

        // Handle PUT (update profile)
        if (event.httpMethod === 'PUT') {
            console.log('PUT request received');

            if (!process.env.GITHUB_TOKEN) {
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
                body = JSON.parse(event.body || '{}');
                console.log('Parsed body:', { username: body.username, displayName: body.displayName });
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Invalid JSON'
                    })
                };
            }

            const { username, displayName, bio, avatar_url } = body;
            console.log('Update data:', { username, displayName });

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

            // Get existing user or create default
            let existingUser = await getFullUserFromGitHub(username);
            
            if (!existingUser) {
                console.log('User profile not found, creating new one for:', username);
                existingUser = {
                    username: username,
                    displayName: displayName || username,
                    bio: '',
                    avatar_url: '',
                    followers: 0,
                    following: 0,
                    verified: false,
                    createdAt: new Date().toISOString()
                };
            } else {
                console.log('User found, updating...');
            }

            // Update profile fields
            const updatedUser = {
                ...existingUser,
                displayName: displayName || existingUser.displayName || existingUser.username || '',
                bio: bio || existingUser.bio || '',
                avatar_url: avatar_url || existingUser.avatar_url || '',
                updatedAt: new Date().toISOString()
            };

            const saved = await saveUserToGitHub(username, updatedUser);

            if (saved) {
                console.log('✅ Profile saved');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        message: 'Profile updated'
                    })
                };
            } else {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Failed to save'
                    })
                };
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('❌ Handler error:', error.message);
        console.error('Stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Server error'
            })
        };
    }
};

async function getProfileFromGitHub(username) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.log('No token, returning default profile');
            return getDefaultProfile(username);
        }

        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/profiles/${username}.json`;
        console.log('Fetching from:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        console.log('GitHub response:', response.status);

        if (!response.ok) {
            console.log('Profile not found (404), returning default');
            return getDefaultProfile(username);
        }

        const data = await response.json();
        const user = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));

        return {
            username: user.username,
            displayName: user.displayName || user.username,
            bio: user.bio || '',
            avatar_url: user.avatar_url || '',
            followers: user.followers || 0,
            following: user.following || 0,
            verified: user.verified || false,
            createdAt: user.createdAt
        };

    } catch (error) {
        console.error('Error getting profile:', error.message);
        return getDefaultProfile(username);
    }
}

async function getFullUserFromGitHub(username) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.log('No token available');
            return null;
        }

        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/profiles/${username}.json`;
        console.log('Getting full user from:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            console.log('Profile not found:', response.status);
            return null;
        }

        const data = await response.json();
        
        try {
            const jsonString = Buffer.from(data.content, 'base64').toString('utf-8');
            const user = JSON.parse(jsonString);
            
            user._sha = data.sha;
            user._url = url;
            
            return user;
        } catch (decodeError) {
            console.error('Error decoding profile:', decodeError.message);
            return null;
        }

    } catch (error) {
        console.error('Error getting full user:', error.message);
        return null;
    }
}

async function saveUserToGitHub(username, user) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.error('No GitHub token');
            return false;
        }

        let url = user._url;
        let sha = user._sha;

        if (!url) {
            url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/profiles/${username}.json`;
            console.log('Creating new profile URL');
        }

        // Handle avatar image if Base64
        let avatarUrl = user.avatar_url || '';
        if (user.avatar_url && user.avatar_url.startsWith('data:image')) {
            console.log('Saving avatar image...');
            
            try {
                const mimeMatch = user.avatar_url.match(/data:image\/(.*?);/);
                const imageType = mimeMatch ? mimeMatch[1] : 'jpeg';
                const base64Data = user.avatar_url.split(',')[1];

                const imagePath = `profiles/avatars/${username}.${imageType}`;
                const imageUrl = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${imagePath}`;

                console.log('Saving avatar to:', imagePath);

                let imageSha = null;
                try {
                    const getImageResponse = await fetch(imageUrl, {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (getImageResponse.ok) {
                        const imageData = await getImageResponse.json();
                        imageSha = imageData.sha;
                        console.log('Found existing avatar');
                    }
                } catch (e) {
                    console.log('No existing avatar');
                }

                const uploadImageResponse = await fetch(imageUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Upload avatar: ${username}`,
                        content: base64Data,
                        branch: GITHUB_BRANCH,
                        ...(imageSha && { sha: imageSha })
                    })
                });

                if (uploadImageResponse.ok) {
                    const imageResult = await uploadImageResponse.json();
                    avatarUrl = imageResult.content.download_url;
                    console.log('✅ Avatar uploaded:', avatarUrl);
                } else {
                    console.warn('⚠️ Avatar upload failed:', uploadImageResponse.status);
                    avatarUrl = '';
                }
            } catch (imageError) {
                console.error('Error with avatar:', imageError.message);
                avatarUrl = '';
            }
        }

        const userToSave = { ...user };
        delete userToSave._sha;
        delete userToSave._url;
        userToSave.avatar_url = avatarUrl;

        const jsonString = JSON.stringify(userToSave, null, 2);
        const content = Buffer.from(jsonString).toString('base64');

        console.log('Saving profile to:', url);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update profile: ${username}`,
                content: content,
                branch: GITHUB_BRANCH,
                ...(sha && { sha })
            })
        });

        console.log('GitHub response:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub error:', response.status);
            console.error('Error details:', errorText.substring(0, 300));
            return false;
        }

        console.log('✅ Profile saved');
        return true;

    } catch (error) {
        console.error('Error saving profile:', error.message);
        return false;
    }
}

function getDefaultProfile(username) {
    return {
        username: username,
        displayName: username,
        bio: '',
        avatar_url: '',
        followers: 0,
        following: 0,
        verified: false
    };
}