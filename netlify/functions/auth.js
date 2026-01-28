// Netlify Function: Authentication with Flexible Encryption Key
const GITHUB_API = 'https://api.github.com';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

exports.handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true })
        };
    }

    // Handle GET (test)
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Auth API is working'
            })
        };
    }

    // Handle POST (auth request)
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { username, email, password, encryptedKey } = body;

            // If encryptedKey is provided, it's a login attempt
            if (encryptedKey) {
                return await handleLogin(username, password, encryptedKey);
            }

            // Otherwise, it's a signup attempt
            if (!username || !email || !password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Username, email, and password are required'
                    })
                };
            }

            // Check if email already exists
            const emailExists = await checkEmailExists(email);
            if (emailExists) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Email already registered'
                    })
                };
            }

            // Check if username already exists
            const userExists = await checkUserExists(username);
            if (userExists) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Username already taken'
                    })
                };
            }

            // Generate unique user ID
            const userId = generateUserId();

            // Generate Encryption Key (32 characters)
            const encryptionKey = generateEncryptionKey();

            // Hash password
            const passwordHash = hashPassword(password);

            // Create user object
            const user = {
                id: userId,
                username,
                email: email.toLowerCase(),
                password: passwordHash,
                encryptionKey: encryptionKey,
                createdAt: new Date().toISOString(),
                verified: false,
                followers: [],
                following: [],
                bio: '',
                avatar_url: '',
                banner_url: '',
                primaryGenre: '',
                location: ''
            };

            // Save user to GitHub
            const saved = await saveUserToGitHub(user);
            if (!saved) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Failed to create account'
                    })
                };
            }

            // Update users index
            await updateUsersIndex(user);

            console.log('User created:', {
                id: user.id,
                username: user.username,
                email: user.email,
                encryptionKeyLength: user.encryptionKey.length
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        createdAt: user.createdAt
                    },
                    encryptedKey: user.encryptionKey,
                    keyLength: user.encryptionKey.length,
                    message: 'Account created successfully. Please save your encryption key!'
                })
            };

        } catch (error) {
            console.error('Auth error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message || 'Internal server error'
                })
            };
        }
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};

/**
 * Handle login
 */
async function handleLogin(username, password, encryptedKey) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        };

        // Trim whitespace from encryption key
        const trimmedKey = encryptedKey.trim();

        if (!trimmedKey) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Encryption key is required'
                })
            };
        }

        console.log('Login attempt:', {
            username,
            keyLength: trimmedKey.length,
            keyPreview: trimmedKey.substring(0, 5) + '...'
        });

        // Get user from GitHub
        const user = await getUserFromGitHub(username);
        if (!user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid username or password'
                })
            };
        }

        console.log('User found:', {
            username: user.username,
            storedKeyLength: user.encryptionKey.length,
            storedKeyPreview: user.encryptionKey.substring(0, 5) + '...'
        });

        // Verify password
        if (!verifyPassword(password, user.password)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid username or password'
                })
            };
        }

        // Verify encryption key (exact match)
        if (trimmedKey !== user.encryptionKey) {
            console.log('Key mismatch:', {
                provided: trimmedKey,
                stored: user.encryptionKey,
                match: trimmedKey === user.encryptionKey
            });

            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid encryption key'
                })
            };
        }

        console.log('User logged in:', username);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    createdAt: user.createdAt
                },
                message: 'Login successful'
            })
        };

    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Login failed: ' + error.message
            })
        };
    }
}

/**
 * Get user from GitHub
 */
async function getUserFromGitHub(username) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return null;

        const filePath = `users/${username}.json`;
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return JSON.parse(content);

    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

/**
 * Check if email already exists
 */
async function checkEmailExists(email) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return false;

        const usersIndex = await getFileFromGitHub('users/index.json', token);
        if (!usersIndex) return false;

        const emailLower = email.toLowerCase();
        return usersIndex.emails && usersIndex.emails.includes(emailLower);

    } catch (error) {
        console.error('Error checking email:', error);
        return false;
    }
}

/**
 * Check if username already exists
 */
async function checkUserExists(username) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return false;

        const filePath = `users/${username}.json`;
        const response = await fetch(
            `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        return response.status === 200;

    } catch (error) {
        console.error('Error checking user:', error);
        return false;
    }
}

/**
 * Save user to GitHub
 */
async function saveUserToGitHub(user) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.error('No GitHub token');
            return false;
        }

        const filePath = `users/${user.username}.json`;
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
        const encodedContent = Buffer.from(JSON.stringify(user, null, 2)).toString('base64');

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Create user: ${user.username}`,
                content: encodedContent,
                branch: GITHUB_BRANCH
            })
        });

        return response.ok;

    } catch (error) {
        console.error('Error saving user:', error);
        return false;
    }
}

/**
 * Update users index with new email
 */
async function updateUsersIndex(user) {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return;

        const filePath = 'users/index.json';
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        let index = { emails: [], userIds: {}, usernames: [] };
        let sha = null;

        if (response.ok) {
            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            index = JSON.parse(content);
            sha = data.sha;
        }

        if (!index.emails) index.emails = [];
        if (!index.userIds) index.userIds = {};
        if (!index.usernames) index.usernames = [];

        index.emails.push(user.email.toLowerCase());
        index.userIds[user.id] = user.username;
        index.usernames.push(user.username);

        index.emails = [...new Set(index.emails)];
        index.usernames = [...new Set(index.usernames)];

        const encodedContent = Buffer.from(JSON.stringify(index, null, 2)).toString('base64');
        const updateBody = {
            message: 'Update users index',
            content: encodedContent,
            branch: GITHUB_BRANCH
        };

        if (sha) updateBody.sha = sha;

        await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateBody)
        });

    } catch (error) {
        console.error('Error updating users index:', error);
    }
}

/**
 * Get file from GitHub
 */
async function getFileFromGitHub(filePath, token) {
    try {
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return JSON.parse(content);

    } catch (error) {
        console.error('Error getting file:', error);
        return null;
    }
}

/**
 * Generate unique user ID
 */
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate Encryption Key (32 characters)
 */
function generateEncryptionKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let key = '';

    for (let i = 0; i < 32; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        key += chars[randomIndex];
    }

    return key;
}

/**
 * Hash password using Base64
 */
function hashPassword(password) {
    try {
        return Buffer.from(password).toString('base64');
    } catch (e) {
        return password;
    }
}

/**
 * Verify password
 */
function verifyPassword(password, hash) {
    try {
        return Buffer.from(password).toString('base64') === hash;
    } catch (e) {
        return password === hash;
    }
}