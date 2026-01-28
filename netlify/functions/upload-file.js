const busboy = require('busboy');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_API = 'https://api.github.com';

function generateTrackId() {
    return 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function uploadToGitHub(path, base64Content) {
    console.log('📤 Uploading to GitHub:', path);
    
    try {
        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

        // Check if file exists
        let sha = null;
        try {
            const getResp = await fetch(url, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
            if (getResp.ok) {
                const data = await getResp.json();
                sha = data.sha;
                console.log('📝 File exists, SHA:', sha.substring(0, 10));
            }
        } catch (e) {
            console.log('📝 File is new');
        }

        // Upload to GitHub
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
            const errText = await response.text();
            console.error('❌ GitHub error:', response.status, errText.substring(0, 100));
            throw new Error(`GitHub ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Uploaded:', result.content.download_url.substring(0, 50) + '...');
        
        return { success: true, url: result.content.download_url };
    } catch (error) {
        console.error('❌ Upload error:', error.message);
        return { success: false, error: error.message };
    }
}

exports.handler = async (event) => {
    console.log('=== UPLOAD HANDLER START ===');
    console.log('Method:', event.httpMethod);
    console.log('Content-Type:', event.headers['content-type']);

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        console.log('✅ OPTIONS request');
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod !== 'POST') {
        console.error('❌ Wrong method:', event.httpMethod);
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Only POST allowed' })
        };
    }

    return new Promise((resolve) => {
        try {
            console.log('1️⃣ Checking token...');
            if (!GITHUB_TOKEN) {
                console.error('❌ No GITHUB_TOKEN');
                return resolve({
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, error: 'No GitHub token configured' })
                });
            }
            console.log('✅ Token present');

            console.log('2️⃣ Processing body...');
            let bodyBuffer = event.body;
            if (event.isBase64Encoded) {
                console.log('   Body is base64 encoded');
                bodyBuffer = Buffer.from(event.body, 'base64');
            } else {
                console.log('   Body is string');
                bodyBuffer = Buffer.from(event.body || '');
            }
            console.log('   Buffer size:', bodyBuffer.length, 'bytes');

            console.log('3️⃣ Creating busboy parser...');
            const bb = busboy({
                headers: event.headers,
                limits: { fileSize: 100 * 1024 * 1024 }
            });
            console.log('✅ Busboy created');

            let fileBuffer = null;
            let fileType = 'audio';
            let fileName = '';

            bb.on('file', (fieldname, file, info) => {
                console.log(`📁 File field: ${fieldname}, filename: ${info.filename}`);
                const chunks = [];

                file.on('data', (data) => {
                    chunks.push(data);
                    console.log(`   Received ${data.length} bytes`);
                });

                file.on('end', () => {
                    fileBuffer = Buffer.concat(chunks);
                    fileName = info.filename;
                    console.log(`✅ File complete: ${Math.round(fileBuffer.length / 1024 / 1024)}MB`);
                });

                file.on('error', (err) => {
                    console.error('❌ File error:', err.message);
                });
            });

            bb.on('field', (fieldname, val) => {
                console.log(`📝 Field: ${fieldname} = ${val}`);
                if (fieldname === 'type') {
                    fileType = val;
                }
            });

            bb.on('finish', async () => {
                console.log('4️⃣ Parse finished');
                
                try {
                    if (!fileBuffer || fileBuffer.length === 0) {
                        console.error('❌ No file buffer');
                        return resolve({
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({ success: false, error: 'No file received' })
                        });
                    }

                    console.log('5️⃣ Generating track ID...');
                    const trackId = generateTrackId();
                    const ext = fileName.split('.').pop().toLowerCase();
                    const path = fileType === 'audio' 
                        ? `uploads/${trackId}.${ext}`
                        : `covers/${trackId}.${ext}`;

                    console.log('   Track ID:', trackId);
                    console.log('   Path:', path);

                    console.log('6️⃣ Converting to base64...');
                    const base64 = fileBuffer.toString('base64');
                    console.log('   Base64 size:', base64.length, 'chars');

                    console.log('7️⃣ Uploading to GitHub...');
                    const result = await uploadToGitHub(path, base64);

                    if (result.success) {
                        console.log('✅ UPLOAD SUCCESS');
                        return resolve({
                            statusCode: 200,
                            headers,
                            body: JSON.stringify({
                                success: true,
                                url: result.url,
                                trackId
                            })
                        });
                    } else {
                        console.error('❌ GitHub upload failed:', result.error);
                        return resolve({
                            statusCode: 500,
                            headers,
                            body: JSON.stringify({ success: false, error: result.error })
                        });
                    }
                } catch (error) {
                    console.error('❌ Finish handler error:', error.message);
                    console.error('Stack:', error.stack.substring(0, 200));
                    return resolve({
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ success: false, error: error.message })
                    });
                }
            });

            bb.on('error', (error) => {
                console.error('❌ Busboy error:', error.message);
                console.error('Stack:', error.stack.substring(0, 200));
                return resolve({
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Parse error: ' + error.message })
                });
            });

            console.log('8️⃣ Starting parse...');
            if (bodyBuffer && bodyBuffer.length > 0) {
                bb.write(bodyBuffer);
            }
            bb.end();
            
        } catch (error) {
            console.error('❌ HANDLER ERROR:', error.message);
            console.error('Stack:', error.stack.substring(0, 200));
            return resolve({
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: error.message })
            });
        }
    });
};