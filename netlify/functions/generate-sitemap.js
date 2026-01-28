

const GITHUB_API = 'https://api.github.com';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ROBA12551';
const GITHUB_REPO = process.env.GITHUB_REPO || 'soundwave-tracks';
const SITE_URL = process.env.SITE_URL || 'https://soundwave.live';

// Fetch GitHub data
async function fetchGitHubFile(path) {
    try {
        const token = process.env.GITHUB_TOKEN;
        const headers = {
            'Accept': 'application/vnd.github.v3.raw'
        };
        
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
            console.error(`Failed to fetch ${path}: ${response.status}`);
            return null;
        }

        const text = await response.text();
        return JSON.parse(text);

    } catch (error) {
        console.error(`Error fetching ${path}:`, error);
        return null;
    }
}

// Generate URL entry for sitemap
function createUrlEntry(loc, lastmod = '2024-01-28', changefreq = 'monthly', priority = 0.5, image = null) {
    let entry = `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <mobile:mobile/>`;

    if (image) {
        entry += `
    <image:image>
      <image:loc>${image}</image:loc>
    </image:image>`;
    }

    entry += `
  </url>`;

    return entry;
}

// Generate sitemap
async function generateSitemap() {
    const urls = [];

    // Static pages
    urls.push(createUrlEntry(`${SITE_URL}/`, '2024-01-28', 'daily', 1.0));
    urls.push(createUrlEntry(`${SITE_URL}/trending`, '2024-01-28', 'hourly', 0.8));
    urls.push(createUrlEntry(`${SITE_URL}/discover`, '2024-01-28', 'daily', 0.8));
    urls.push(createUrlEntry(`${SITE_URL}/new`, '2024-01-28', 'daily', 0.7));

    // Genre pages
    const genres = ['electronic', 'hip-hop', 'pop', 'rock', 'jazz', 'classical'];
    genres.forEach(genre => {
        urls.push(createUrlEntry(`${SITE_URL}/genre/${genre}`, '2024-01-28', 'daily', 0.7));
    });

    // Dynamic tracks from GitHub
    try {
        const tracksData = await fetchGitHubFile('tracks/index.json');
        if (tracksData && tracksData.tracks) {
            tracksData.tracks.forEach(track => {
                urls.push(createUrlEntry(
                    `${SITE_URL}/track/${track.id}`,
                    track.createdAt || '2024-01-28',
                    'monthly',
                    0.8,
                    track.cover
                ));
            });
        }
    } catch (error) {
        console.error('Error adding track URLs:', error);
    }

    // Dynamic artist pages from GitHub
    try {
        const tracksData = await fetchGitHubFile('tracks/index.json');
        if (tracksData && tracksData.tracks) {
            const artists = [...new Set(tracksData.tracks.map(t => t.artist))];
            artists.forEach(artist => {
                urls.push(createUrlEntry(
                    `${SITE_URL}/artist/${artist}`,
                    '2024-01-28',
                    'weekly',
                    0.8
                ));
            });
        }
    } catch (error) {
        console.error('Error adding artist URLs:', error);
    }

    // User pages
    urls.push(createUrlEntry(`${SITE_URL}/me`, '2024-01-28', 'weekly', 0.5));
    urls.push(createUrlEntry(`${SITE_URL}/likes`, '2024-01-28', 'weekly', 0.5));
    urls.push(createUrlEntry(`${SITE_URL}/history`, '2024-01-28', 'weekly', 0.5));

    // Info pages
    urls.push(createUrlEntry(`${SITE_URL}/policy`, '2024-01-28', 'monthly', 0.3));
    urls.push(createUrlEntry(`${SITE_URL}/about`, '2024-01-28', 'monthly', 0.3));
    urls.push(createUrlEntry(`${SITE_URL}/contact`, '2024-01-28', 'monthly', 0.3));

    // Build sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;

    return sitemap;
}

// Netlify Function Handler
exports.handler = async (event, context) => {
    try {
        const sitemap = await generateSitemap();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'max-age=3600' // Cache for 1 hour
            },
            body: sitemap
        };

    } catch (error) {
        console.error('Error generating sitemap:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/plain' },
            body: 'Error generating sitemap'
        };
    }
};