/**
 * BeatWave App v4 - Optimized for Speed
 * Fast loading, caching, lazy loading
 */

// ===== CONFIG & STATE =====
const API_BASE = '/.netlify/functions';
const STORAGE_PREFIX = 'soundwave_';
const CACHE_KEY = STORAGE_PREFIX + 'tracksCache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let currentUser = null;
let currentAudio = null;
let isPlayingTrack = false;
let allTracks = [];
let playlist = [];
let likedTracks = new Set();

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing BeatWave...');
    
    loadUserFromStorage();
    loadLikesFromStorage();
    setupEventListeners();
    updateUIForUser();
    
    // ★ 非同期で読み込み（ページをブロックしない）
    console.log('⚡ Loading tracks asynchronously...');
    loadAllTracksAsync();
    
    console.log('✅ BeatWave UI ready');
});

function loadUserFromStorage() {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing user:', e);
            currentUser = null;
        }
    }
}

function loadLikesFromStorage() {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'likedTracks');
    if (saved) {
        try {
            likedTracks = new Set(JSON.parse(saved));
        } catch (e) {
            console.error('Error parsing likes:', e);
        }
    }
}

// ===== TRACK LOADING (OPTIMIZED) =====

/**
 * ★ 非同期で段階的に読み込み
 */
async function loadAllTracksAsync() {
    try {
        // 1️⃣ キャッシュを確認
        const cached = getTracksFromCache();
        if (cached) {
            console.log('💾 Using cached tracks:', cached.length);
            allTracks = cached;
            playlist = allTracks;
            displayTracksProgressively();
            return;
        }

        // 2️⃣ API から取得
        console.log('📥 Fetching tracks from API...');
        const response = await fetch(`${API_BASE}/tracks`, {
            signal: AbortSignal.timeout(10000) // 10秒でタイムアウト
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        allTracks = Array.isArray(data.tracks) ? data.tracks : [];
        playlist = allTracks;

        console.log(`✅ Loaded ${allTracks.length} tracks`);

        // 3️⃣ キャッシュに保存
        cacheTracksData(allTracks);

        // 4️⃣ UI に表示
        displayTracksProgressively();

    } catch (e) {
        console.error('❌ Error loading tracks:', e);
        
        // フォールバック: キャッシュを試す
        const cached = getTracksFromCache(true); // 古いキャッシュを使用
        if (cached) {
            allTracks = cached;
            displayTracksProgressively();
        } else {
            allTracks = createDemoTracks();
            displayTracksProgressively();
        }
    }
}

/**
 * ★ トラックをキャッシュに保存
 */
function cacheTracksData(tracks) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: tracks,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Failed to cache tracks:', e);
    }
}

/**
 * ★ キャッシュからトラックを取得
 */
function getTracksFromCache(ignoreExpiry = false) {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        
        // キャッシュの有効期限を確認
        if (!ignoreExpiry && Date.now() - timestamp > CACHE_TTL) {
            console.log('💾 Cache expired');
            return null;
        }

        return data;
    } catch (e) {
        console.warn('Failed to read cache:', e);
        return null;
    }
}

/**
 * ★ 段階的に表示（遅延レンダリング）
 */
function displayTracksProgressively() {
    // 優先度: Featured > Realtime > Recommended > Uploaded > Trending
    
    // 1️⃣ Featured（すぐに表示）
    console.log('📊 Rendering featured track...');
    displayFeaturedTrack();
    
    // 2️⃣ Realtime（100ms後）
    setTimeout(() => {
        console.log('📊 Rendering realtime tracks...');
        displayRealtimeTracks();
    }, 100);
    
    // 3️⃣ Recommended（200ms後）
    setTimeout(() => {
        console.log('📊 Rendering recommended tracks...');
        displayRecommendedTracks();
    }, 200);
    
    // 4️⃣ Uploaded（300ms後）
    setTimeout(() => {
        console.log('📊 Rendering uploaded tracks...');
        displayUploadedTracks();
    }, 300);
    
    // 5️⃣ Trending（400ms後）
    setTimeout(() => {
        console.log('📊 Rendering trending tracks...');
        displayTrendingTracks();
    }, 400);
}

function createDemoTracks() {
    return [
        {
            id: 'demo_1',
            title: 'Sample Track 1',
            artist: 'Demo Artist',
            genre: 'Electronic',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            plays: 100,
            likes: 20,
            comments: 5,
            verified: true
        },
        {
            id: 'demo_2',
            title: 'Sample Track 2',
            artist: 'Demo Artist 2',
            genre: 'Hip Hop',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            plays: 80,
            likes: 15,
            comments: 3
        }
    ];
}

// ===== TRACK DISPLAY =====

function displayFeaturedTrack() {
    const container = document.getElementById('featuredTrackContainer');
    if (!container || allTracks.length === 0) return;

    const featured = [...allTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0];
    const isLiked = likedTracks.has(featured.id);
    const verifiedBadge = featured.verified ? '<span class="verified-badge">✓</span>' : '';

    container.innerHTML = `
        <div class="featured-track">
            <div class="featured-cover">
                ${featured.coverUrl ? `<img src="${featured.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🎵'}
            </div>
            <div>
                <h2 class="featured-info" style="font-size: 32px; font-weight: 900; margin-bottom: 8px;">
                    ${escapeHtml(featured.title || 'Untitled')}
                </h2>
                <p style="font-size: 16px; color: rgba(255, 255, 255, 0.8); margin-bottom: 12px;">
                    <span style="cursor: pointer; display: inline-flex; align-items: center; gap: 8px;" onclick="openUserProfile('${escapeHtml(featured.artist)}')">
                        ${escapeHtml(featured.artist || 'Unknown')}
                        ${verifiedBadge}
                    </span>
                </p>
                <span class="featured-artist">${escapeHtml(featured.genre || 'Music')}</span>
                
                <div class="featured-stats">
                    <div class="featured-stat">
                        <div class="featured-stat-value">${formatNumber(featured.plays || 0)}</div>
                        <div class="featured-stat-label">Plays</div>
                    </div>
                    <div class="featured-stat">
                        <div class="featured-stat-value">${formatNumber(featured.likes || 0)}</div>
                        <div class="featured-stat-label">Likes</div>
                    </div>
                    <div class="featured-stat">
                        <div class="featured-stat-value">${formatNumber(featured.comments || 0)}</div>
                        <div class="featured-stat-label">Comments</div>
                    </div>
                </div>

                <div class="featured-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="playTrack('${featured.id}')">▶ Play Now</button>
                    <button class="btn btn-secondary" onclick="likeTrack('${featured.id}')" style="font-size: 18px;">
                        ${isLiked ? '❤️ Liked' : '🤍 Like'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function displayRealtimeTracks() {
    const container = document.getElementById('realtimeTracks');
    if (!container || !allTracks.length) return;

    const sorted = [...allTracks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    let html = '';
    sorted.slice(0, 10).forEach(track => {
        const isLiked = likedTracks.has(track.id);
        const verifiedBadge = track.verified ? '<span class="verified-badge">✓</span>' : '';
        html += `
            <div class="track-list-item" onclick="playTrack('${track.id}')">
                <div class="track-list-cover">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🎵'}
                </div>
                <div class="track-list-info">
                    <div class="track-list-title">${escapeHtml(track.title || 'Untitled')}</div>
                    <div class="track-list-artist">
                        <span style="cursor: pointer;" onclick="event.stopPropagation(); openUserProfile('${escapeHtml(track.artist)}')">
                            ${escapeHtml(track.artist || 'Unknown')}
                            ${verifiedBadge}
                        </span>
                    </div>
                    <div class="track-list-meta">
                        <span>${formatNumber(track.plays || 0)} plays</span>
                        <span>•</span>
                        <span>${formatNumber(track.likes || 0)} likes</span>
                    </div>
                </div>
                <button class="play-button" onclick="event.stopPropagation(); playTrack('${track.id}')">▶</button>
                <button class="play-button" style="background: none; color: var(--text-secondary);" onclick="event.stopPropagation(); likeTrack('${track.id}')">
                    ${isLiked ? '❤️' : '🤍'}
                </button>
            </div>
        `;
    });

    container.innerHTML = html || '<p style="color: var(--text-secondary);">No tracks</p>';
}

function displayRecommendedTracks() {
    const container = document.getElementById('recommendedTracks');
    if (!container || !allTracks.length) return;

    const random = [...allTracks].sort(() => Math.random() - 0.5);

    let html = '';
    random.slice(0, 8).forEach(track => {
        const isLiked = likedTracks.has(track.id);
        const verifiedBadge = track.verified ? '<span class="verified-badge">✓</span>' : '';
        html += `
            <div class="track-card" onclick="playTrack('${track.id}')">
                <div class="track-cover">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🎵'}
                </div>
                <div class="track-info">
                    <h3>${escapeHtml(track.title || 'Untitled')} ${verifiedBadge}</h3>
                    <p onclick="event.stopPropagation(); openUserProfile('${escapeHtml(track.artist)}')" style="cursor: pointer;">
                        ${escapeHtml(track.artist || 'Unknown')}
                    </p>
                    <div class="track-stats">
                        <span>${formatNumber(track.plays || 0)} plays</span>
                        <span onclick="event.stopPropagation(); likeTrack('${track.id}')" style="cursor: pointer;">
                            ${isLiked ? '❤️' : '🤍'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<p style="color: var(--text-secondary);">No tracks</p>';
}

function displayUploadedTracks() {
    const container = document.getElementById('uploadedTracks');
    if (!container || !allTracks.length) return;

    const sorted = [...allTracks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    let html = '';
    sorted.slice(0, 8).forEach(track => {
        const isLiked = likedTracks.has(track.id);
        const verifiedBadge = track.verified ? '<span class="verified-badge">✓</span>' : '';
        html += `
            <div class="track-card" onclick="playTrack('${track.id}')">
                <div class="track-cover">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🎵'}
                </div>
                <div class="track-info">
                    <h3>${escapeHtml(track.title || 'Untitled')} ${verifiedBadge}</h3>
                    <p onclick="event.stopPropagation(); openUserProfile('${escapeHtml(track.artist)}')" style="cursor: pointer;">
                        ${escapeHtml(track.artist || 'Unknown')}
                    </p>
                    <div class="track-stats">
                        <span>${formatNumber(track.plays || 0)} plays</span>
                        <span onclick="event.stopPropagation(); likeTrack('${track.id}')" style="cursor: pointer;">
                            ${isLiked ? '❤️' : '🤍'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<p style="color: var(--text-secondary);">No tracks</p>';
}

function displayTrendingTracks() {
    const container = document.getElementById('trendingTracks');
    if (!container || !allTracks.length) return;

    const sorted = [...allTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0));

    let html = '';
    sorted.slice(0, 20).forEach(track => {
        const isLiked = likedTracks.has(track.id);
        const verifiedBadge = track.verified ? '<span class="verified-badge">✓</span>' : '';
        html += `
            <div class="track-list-item" onclick="playTrack('${track.id}')">
                <div class="track-list-cover">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🎵'}
                </div>
                <div class="track-list-info">
                    <div class="track-list-title">${escapeHtml(track.title || 'Untitled')} ${verifiedBadge}</div>
                    <div class="track-list-artist">
                        <span style="cursor: pointer;" onclick="event.stopPropagation(); openUserProfile('${escapeHtml(track.artist)}')">
                            ${escapeHtml(track.artist || 'Unknown')}
                        </span>
                    </div>
                    <div class="track-list-meta">
                        <span>${formatNumber(track.plays || 0)} plays</span>
                    </div>
                </div>
                <button class="play-button" onclick="event.stopPropagation(); playTrack('${track.id}')">▶</button>
            </div>
        `;
    });

    container.innerHTML = html || '<p style="color: var(--text-secondary); text-align: center;">No tracks</p>';
}

function displayLikedTracks() {
    const container = document.getElementById('likedTracks');
    if (!container) return;

    const liked = allTracks.filter(t => likedTracks.has(t.id));

    if (liked.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No liked tracks yet</p>';
        return;
    }

    let html = '';
    liked.forEach(track => {
        const verifiedBadge = track.verified ? '<span class="verified-badge">✓</span>' : '';
        html += `
            <div class="track-list-item" onclick="playTrack('${track.id}')">
                <div class="track-list-cover">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🎵'}
                </div>
                <div class="track-list-info">
                    <div class="track-list-title">${escapeHtml(track.title || 'Untitled')} ${verifiedBadge}</div>
                    <div class="track-list-artist">
                        <span style="cursor: pointer;" onclick="event.stopPropagation(); openUserProfile('${escapeHtml(track.artist)}')">
                            ${escapeHtml(track.artist || 'Unknown')}
                        </span>
                    </div>
                </div>
                <button class="play-button" onclick="event.stopPropagation(); playTrack('${track.id}')">▶</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

function displayHistoryTracks() {
    const container = document.getElementById('historyTracks');
    if (!container) return;

    let history = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'history') || '[]');

    if (history.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No history yet</p>';
        return;
    }

    let html = '';
    history.forEach(track => {
        html += `
            <div class="track-list-item" onclick="playTrack('${track.id}')">
                <div class="track-list-cover">🎵</div>
                <div class="track-list-info">
                    <div class="track-list-title">${escapeHtml(track.title || 'Unknown')}</div>
                    <div class="track-list-artist">${escapeHtml(track.artist || 'Unknown')}</div>
                </div>
                <button class="play-button" onclick="event.stopPropagation(); playTrack('${track.id}')">▶</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ===== PLAYBACK =====

async function playTrack(trackId) {
    if (!trackId) return;

    if (currentAudio) {
        try {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        } catch (e) {}
    }

    const track = allTracks.find(t => t.id === trackId);
    if (!track || !track.audioUrl) {
        console.error('Track not found');
        return;
    }

    console.log('▶️ Playing track:', trackId);
    await incrementPlayCount(trackId);

    currentAudio = new Audio();
    currentAudio.crossOrigin = 'anonymous';
    currentAudio.src = track.audioUrl;
    currentAudio.volume = 0.8;

    const titleEl = document.getElementById('playerTitle');
    const artistEl = document.getElementById('playerArtist');
    const playBtn = document.getElementById('playBtn');

    if (titleEl) titleEl.textContent = track.title || 'Untitled';
    if (artistEl) artistEl.textContent = track.artist || 'Unknown';

    currentAudio.addEventListener('timeupdate', () => {
        const fillEl = document.getElementById('playerProgressFill');
        const timeEl = document.getElementById('timeDisplay');
        
        if (fillEl && currentAudio.duration) {
            fillEl.style.width = (currentAudio.currentTime / currentAudio.duration * 100) + '%';
        }
        
        if (timeEl) {
            timeEl.textContent = formatTime(currentAudio.currentTime);
        }
    });

    currentAudio.addEventListener('ended', () => {
        if (playBtn) playBtn.textContent = '▶';
        playNext();
    });

    try {
        await currentAudio.play();
        isPlayingTrack = true;
        if (playBtn) playBtn.textContent = '⏸';
    } catch (err) {
        console.error('Play error:', err.message);
    }
}

function togglePlay() {
    if (!currentAudio || !currentAudio.src) {
        if (allTracks.length > 0) {
            playTrack(allTracks[0].id);
        }
        return;
    }

    const playBtn = document.getElementById('playBtn');

    if (currentAudio.paused) {
        currentAudio.play().catch(err => {
            if (err.name !== 'AbortError') {
                console.error('Resume error:', err.message);
            }
        });
        isPlayingTrack = true;
        if (playBtn) playBtn.textContent = '⏸';
    } else {
        currentAudio.pause();
        isPlayingTrack = false;
        if (playBtn) playBtn.textContent = '▶';
    }
}

function playPrevious() {
    let history = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'history') || '[]');
    if (history.length >= 2) {
        playTrack(history[1].id);
    }
}

function playNext() {
    if (allTracks.length > 0) {
        const random = Math.floor(Math.random() * allTracks.length);
        playTrack(allTracks[random].id);
    }
}

// ===== STATS MANAGEMENT =====

async function incrementPlayCount(trackId) {
    try {
        const track = allTracks.find(t => t.id === trackId);
        if (!track) return;

        track.plays = (track.plays || 0) + 1;
        updateAllTrackDisplays();
        await saveTracksToGitHub();
    } catch (error) {
        console.error('❌ Error incrementing play count:', error);
    }
}

async function saveTracksToGitHub() {
    try {
        const response = await fetch(`${API_BASE}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save',
                tracks: allTracks
            })
        });

        if (!response.ok) {
            console.error('GitHub save failed:', response.status);
            return false;
        }

        cacheTracksData(allTracks);
        return true;
    } catch (error) {
        console.error('❌ Error saving to GitHub:', error);
        return false;
    }
}

function updateAllTrackDisplays() {
    displayFeaturedTrack();
    displayRealtimeTracks();
    displayRecommendedTracks();
    displayUploadedTracks();
    displayTrendingTracks();
}

// ===== LIKES =====

async function likeTrack(trackId) {
    if (!currentUser) {
        alert('Please sign in to like');
        return;
    }

    const track = allTracks.find(t => t.id === trackId);
    if (!track) return;

    const isLiked = likedTracks.has(trackId);
    const newLiked = !isLiked;

    if (newLiked) {
        likedTracks.add(trackId);
        track.likes = (track.likes || 0) + 1;
    } else {
        likedTracks.delete(trackId);
        track.likes = Math.max(0, (track.likes || 1) - 1);
    }
    
    localStorage.setItem(STORAGE_PREFIX + 'likedTracks', JSON.stringify(Array.from(likedTracks)));
    await saveTracksToGitHub();
    updateAllTrackDisplays();
}

// ===== SEARCH =====

let searchTimeout;

function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toLowerCase();

        if (!query) {
            closeSearchResults();
            return;
        }

        searchTimeout = setTimeout(() => {
            const results = allTracks.filter(t => 
                (t.title || '').toLowerCase().includes(query) ||
                (t.artist || '').toLowerCase().includes(query) ||
                (t.genre || '').toLowerCase().includes(query)
            );

            showSearchResults(query, results);
        }, 300);
    });
}

function showSearchResults(query, results) {
    let overlay = document.getElementById('searchOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'searchOverlay';
        document.body.appendChild(overlay);
    }

    let html = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--dark-bg); z-index: 10000; overflow-y: auto; display: flex; flex-direction: column;">
            <div style="background: var(--card-bg); border-bottom: 1px solid var(--border-color); padding: 16px 24px; position: sticky; top: 0; display: flex; align-items: center; gap: 12px;">
                <button onclick="closeSearchResults()" style="background: none; border: none; color: var(--text-primary); font-size: 20px; cursor: pointer;">← Back</button>
                <div style="flex: 1; font-size: 14px; color: var(--text-secondary);">
                    ${results.length} results
                </div>
            </div>
            <div style="padding: 24px; flex: 1;">
    `;

    if (results.length === 0) {
        html += '<p style="color: var(--text-secondary); text-align: center; padding: 40px 0;">No results found</p>';
    } else {
        results.forEach(track => {
            const isLiked = likedTracks.has(track.id);
            const verifiedBadge = track.verified ? '<span class="verified-badge">✓</span>' : '';
            html += `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'" onclick="playTrack('${track.id}')">
                    <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #ff6b00 0%, #FFA500 100%); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; overflow: hidden;">
                        ${track.coverUrl ? `<img src="${track.coverUrl}" alt="${track.title}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">` : '🎵'}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${escapeHtml(track.title || 'Untitled')} ${verifiedBadge}
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;" onclick="event.stopPropagation(); openUserProfile('${escapeHtml(track.artist)}')">
                            ${escapeHtml(track.artist || 'Unknown')}
                        </div>
                    </div>
                    <div onclick="event.stopPropagation(); likeTrack('${track.id}')" style="font-size: 18px; cursor: pointer;">
                        ${isLiked ? '❤️' : '🤍'}
                    </div>
                </div>
            `;
        });
    }

    html += '</div></div>';
    overlay.innerHTML = html;
    overlay.style.display = 'block';
}

function closeSearchResults() {
    const overlay = document.getElementById('searchOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ===== USER PROFILE =====

function openUserProfile(username) {
    if (!username || username === 'Unknown') {
        alert('This artist does not have a profile yet');
        return;
    }

    // ★ 自分のプロフィールの場合は profile.html へ移動
    if (currentUser && username === currentUser.username) {
        window.location.href = '/profile.html';
        return;
    }

    // ★ 他のユーザーの場合はモーダルで表示
    let modal = document.getElementById('profileModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'profileModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const userTracks = allTracks.filter(t => t.artist === username);
    const userLikes = userTracks.reduce((sum, t) => sum + (t.likes || 0), 0);
    const userPlays = userTracks.reduce((sum, t) => sum + (t.plays || 0), 0);

    let tracksHtml = '';
    if (userTracks.length > 0) {
        tracksHtml = userTracks.slice(0, 5).map(track => `
            <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                <div style="font-weight: 600;">${escapeHtml(track.title)}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">
                    ▶️ ${formatNumber(track.plays || 0)} • ❤️ ${formatNumber(track.likes || 0)}
                </div>
            </div>
        `).join('');
    } else {
        tracksHtml = '<p style="color: var(--text-secondary);">No tracks yet</p>';
    }

    const profileContent = `
        <div style="background: var(--card-bg); border-radius: 12px; padding: 32px; max-width: 600px; width: 90%; border: 1px solid var(--border-color); position: relative;">
            <button class="modal-close" onclick="closeModal('profileModal')" style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-secondary); font-size: 28px; cursor: pointer;">X</button>
            
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ff6b00, #FFA500); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 36px; color: white; font-weight: 700;">
                    ${username.charAt(0).toUpperCase()}
                </div>
                
                <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
                    ${escapeHtml(username)}
                </h2>
                
                <div style="display: flex; justify-content: center; gap: 24px; margin-bottom: 16px;">
                    <div>
                        <div style="font-size: 18px; font-weight: 700;">${userTracks.length}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Tracks</div>
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: 700;">${formatNumber(userPlays)}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Total Plays</div>
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: 700;">${formatNumber(userLikes)}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Total Likes</div>
                    </div>
                </div>
            </div>

            <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
                <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px;">Latest Tracks</h3>
                ${tracksHtml}
                ${userTracks.length > 5 ? `<p style="color: var(--text-secondary); font-size: 12px; margin-top: 8px;">... and ${userTracks.length - 5} more</p>` : ''}
            </div>
        </div>
    `;

    modal.innerHTML = profileContent;
    modal.classList.add('active');
}

function openCurrentUserProfile() {
    if (!currentUser) {
        alert('Please login first');
        openModal('loginModal');
        return;
    }

    // ★ プロフィールページに移動
    window.location.href = '/profile.html';
}

// ===== SIDEBAR NAVIGATION =====

function initializeSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            sidebarItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const view = item.getAttribute('data-view');
            if (view) switchView(view);
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    
    const view = document.getElementById(viewName + 'View');
    if (view) view.style.display = 'block';

    switch(viewName) {
        case 'home':
            break;
        case 'trending':
            displayTrendingTracks();
            break;
        case 'liked':
            displayLikedTracks();
            break;
        case 'history':
            displayHistoryTracks();
            break;
    }
}

// ===== PLAYER INITIALIZATION =====

function initializePlayer() {
    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.addEventListener('click', togglePlay);

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) prevBtn.addEventListener('click', playPrevious);

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.addEventListener('click', playNext);

    const progressBar = document.getElementById('playerProgress');
    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            if (!currentAudio || !currentAudio.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            currentAudio.currentTime = percent * currentAudio.duration;
        });
    }
}

// ===== UI UPDATES =====

function updateUIForUser() {
    const loginBtn = document.getElementById('loginBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const userBtn = document.getElementById('userBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (currentUser) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (uploadBtn) uploadBtn.style.display = 'block';
        if (userBtn) {
            userBtn.style.display = 'block';
            userBtn.textContent = currentUser.username[0].toUpperCase();
            userBtn.onclick = openCurrentUserProfile;
        }
        if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
        if (loginBtn) {
            loginBtn.style.display = 'block';
            loginBtn.onclick = () => openModal('loginModal');
        }
        if (uploadBtn) uploadBtn.style.display = 'none';
        if (userBtn) userBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// ===== UTILITY FUNCTIONS =====

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    initializeSidebar();
    initializeSearch();
    initializePlayer();

    const loginBtn = document.getElementById('loginBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const homeLink = document.getElementById('homeLink');

    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            if (currentUser) {
                window.location.href = '/upload.html';
            } else {
                alert('Please login first');
                openModal('loginModal');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            currentUser = null;
            localStorage.removeItem(STORAGE_PREFIX + 'user');
            updateUIForUser();
            alert('ログアウトしました');
        });
    }

    if (homeLink) {
        homeLink.addEventListener('click', () => switchView('home'));
    }
}

// ===== MODALS =====

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

// ===== EXPORT TO GLOBAL =====

window.playTrack = playTrack;
window.likeTrack = likeTrack;
window.togglePlay = togglePlay;
window.closeSearchResults = closeSearchResults;
window.switchView = switchView;
window.playPrevious = playPrevious;
window.playNext = playNext;
window.openModal = openModal;
window.closeModal = closeModal;
window.updateUIForUser = updateUIForUser;
window.openUserProfile = openUserProfile;
window.openCurrentUserProfile = openCurrentUserProfile;