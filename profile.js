/**
 * BeatWave Profile Page - Client Side
 */

const API_BASE = '/.netlify/functions';
const STORAGE_PREFIX = 'soundwave_';

let currentUser = null;
let userProfile = null;
let allTracks = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Loading profile page...');
    
    loadUserFromStorage();
    loadAllTracks();
    loadProfileFromGitHub();
    setupEventListeners();
    updateUIForUser();
});

function loadUserFromStorage() {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            console.log('✅ User loaded:', currentUser.username);
        } catch (e) {
            console.error('Error parsing user:', e);
            currentUser = null;
        }
    }
}

async function loadAllTracks() {
    try {
        console.log('📥 Loading tracks...');
        const response = await fetch(`${API_BASE}/tracks`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        allTracks = Array.isArray(data.tracks) ? data.tracks : [];
        console.log(`✅ Loaded ${allTracks.length} tracks`);
    } catch (e) {
        console.error('❌ Error loading tracks:', e);
    }
}

// ★ GitHub からプロフィールを読み込み
async function loadProfileFromGitHub() {
    try {
        if (!currentUser) {
            console.log('⏭️ No user logged in');
            displayProfile();
            return;
        }

        console.log('📥 Loading profile from GitHub...');
        const response = await fetch(`${API_BASE}/profile?username=${encodeURIComponent(currentUser.username)}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.success && data.profile) {
            // ★ デフォルト値とマージして、すべてのプロパティが存在することを確認
            userProfile = {
                name: data.profile.name || currentUser.username,
                email: data.profile.email || currentUser.email,
                location: data.profile.location || '🇯🇵 Japan',
                bio: data.profile.bio || 'Music artist on BeatWave',
                avatarLetter: data.profile.avatarLetter || currentUser.username?.charAt(0).toUpperCase() || 'U',
                avatarUrl: data.profile.avatarUrl || '',
                verified: data.profile.verified || false,
                followers: data.profile.followers || 0,
                createdAt: data.profile.createdAt || new Date().toISOString(),
                updatedAt: data.profile.updatedAt || new Date().toISOString(),
                sha: data.sha  // GitHub の SHA（更新時に必要）
            };
            
            console.log('✅ Profile loaded from GitHub:', userProfile.name);
            
            // ★ localStorage にキャッシュ
            localStorage.setItem(STORAGE_PREFIX + 'profileData', JSON.stringify(userProfile));
        }
    } catch (e) {
        console.warn('⚠️ Error loading profile from GitHub:', e);
        
        // ★ localStorage から読み込み（フォールバック）
        const cached = localStorage.getItem(STORAGE_PREFIX + 'profileData');
        if (cached) {
            try {
                userProfile = JSON.parse(cached);
                console.log('✅ Profile loaded from cache');
            } catch (err) {
                console.error('Error parsing cached profile:', err);
            }
        }
    }
    
    displayProfile();
}

// ===== PROFILE DISPLAY =====

function displayProfile() {
    console.log('🔍 displayProfile() called');
    
    const profileData = userProfile || loadProfileData();
    userProfile = profileData;

    console.log('👤 Profile Data:', {
        name: profileData.name,
        avatarLetter: profileData.avatarLetter,
        avatarUrlLength: profileData.avatarUrl ? profileData.avatarUrl.length : 0,
        avatarUrlStart: profileData.avatarUrl ? profileData.avatarUrl.substring(0, 50) : 'N/A'
    });

    // アバター
    const avatarEl = document.getElementById('profileAvatar');
    console.log('🎨 Avatar element found:', !!avatarEl);
    
    if (avatarEl) {
        // ★ Base64画像がある場合は表示
        if (profileData.avatarUrl && profileData.avatarUrl.startsWith('data:image')) {
            console.log('✅ Using avatar image');
            avatarEl.style.backgroundImage = `url(${profileData.avatarUrl})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.style.backgroundColor = 'transparent';  // ★ グラデーション背景を非表示
            avatarEl.textContent = '';  // テキストを非表示
            console.log('✅ Avatar image applied');
        } else {
            console.log('⏭️ No avatar image, using letter:', profileData.avatarLetter);
            // ★ 画像がない場合は文字を表示
            avatarEl.style.backgroundImage = '';
            avatarEl.style.backgroundColor = '';  // グラデーション背景に戻す
            avatarEl.textContent = profileData.avatarLetter || 'U';
        }
    } else {
        console.error('❌ Avatar element not found!');
    }

    // 名前
    document.getElementById('profileName').textContent = profileData.name;

    // 場所
    document.getElementById('profileLocation').textContent = profileData.location ? `🇯🇵 ${profileData.location}` : '🌍 Worldwide';

    // 説明
    document.getElementById('profileDescription').textContent = profileData.bio || 'Independent artist on BeatWave';

    // ★ userTracks を定義（スコープ外で使用するため）
    const userTracks = allTracks.filter(t => t.artist === profileData.name);
    const totalPlays = userTracks.reduce((sum, t) => sum + (t.plays || 0), 0);
    const totalLikes = userTracks.reduce((sum, t) => sum + (t.likes || 0), 0);

    // ★ 統計情報は最初のロード時だけ表示
    // 再生中に自動で変わるのを防ぐ
    const cachedStatsKey = STORAGE_PREFIX + 'profileStats';
    let stats = {};
    
    try {
        const cached = localStorage.getItem(cachedStatsKey);
        if (cached) stats = JSON.parse(cached);
    } catch (e) {}

    // ★ 初回ロード時のみ計算（stats が空の場合）
    if (!stats.tracks) {
        stats = {
            tracks: userTracks.length,
            plays: totalPlays,
            likes: totalLikes
        };
        
        localStorage.setItem(cachedStatsKey, JSON.stringify(stats));
    }

    const followers = profileData.followers || 0;

    document.getElementById('statTracks').textContent = stats.tracks || 0;
    document.getElementById('statPlays').textContent = formatNumber(stats.plays || 0);
    document.getElementById('statLikes').textContent = formatNumber(stats.likes || 0);
    document.getElementById('statFollowers').textContent = formatNumber(followers);

    // Verified バッジ
    const verifiedBadge = document.getElementById('verifiedBadge');
    if (profileData.verified) {
        verifiedBadge.style.display = 'inline-flex';
    } else {
        verifiedBadge.style.display = 'none';
    }

    // トラックを表示
    displayUserTracks(userTracks);

    // About セクション
    document.getElementById('aboutText').textContent = profileData.bio || 'Independent music artist on BeatWave. Creating unique sounds.';
}

function displayUserTracks(tracks) {
    const grid = document.getElementById('tracksGrid');
    
    if (tracks.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary);">No tracks yet</p>';
        return;
    }

    let html = '';
    tracks.forEach(track => {
        html += `
            <div class="track-card" onclick="playTrack('${track.id}')">
                <div class="track-cover">
                    ${track.coverUrl ? `<img src="${track.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : '🎵'}
                </div>
                <div class="track-info">
                    <h3>${escapeHtml(track.title || 'Untitled')}</h3>
                    <p>${formatNumber(track.plays || 0)} plays</p>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// ===== PROFILE DATA MANAGEMENT =====

function loadProfileData() {
    if (currentUser) {
        return {
            name: currentUser.username || '',
            email: currentUser.email || '',
            location: '🇯🇵 Japan',
            bio: 'Music artist on BeatWave',
            avatarLetter: currentUser.username?.charAt(0).toUpperCase() || 'U',
            avatarUrl: '',
            verified: false,
            followers: 0,
            createdAt: new Date().toISOString()
        };
    }

    return {
        name: 'Guest',
        email: '',
        location: '',
        bio: '',
        avatarLetter: 'G',
        avatarUrl: '',
        verified: false,
        followers: 0
    };
}

// ===== EDIT PROFILE =====

function openEditModal() {
    if (!currentUser) {
        alert('Please login to edit profile');
        return;
    }

    const profileData = userProfile || loadProfileData();

    document.getElementById('editName').value = profileData.name || '';
    // ★ location が undefined の場合のチェック
    document.getElementById('editLocation').value = (profileData.location || '').replace('🇯🇵 ', '').replace('🌍 ', '');
    document.getElementById('editBio').value = profileData.bio || '';
    document.getElementById('editAvatarLetter').value = profileData.avatarLetter || '';

    // ★ 既存のアバター画像をプレビューに表示
    const previewEl = document.getElementById('avatarPreview');
    if (previewEl) {
        if (profileData.avatarUrl && profileData.avatarUrl.startsWith('data:image')) {
            // Base64 画像がある場合
            previewEl.style.backgroundImage = `url(${profileData.avatarUrl})`;
            previewEl.style.backgroundSize = 'cover';
            previewEl.style.backgroundPosition = 'center';
            previewEl.textContent = '';  // テキストを非表示
        } else {
            // 画像がない場合は文字を表示
            previewEl.style.backgroundImage = '';
            previewEl.textContent = profileData.avatarLetter || '👤';
        }
    }

    // ★ avatarBase64 の hidden input をクリア（新しい画像が選択されたときのため）
    const base64Input = document.getElementById('avatarBase64');
    if (base64Input) {
        base64Input.value = '';
    }

    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

// ★ 画像ファイルをBase64に変換
function handleAvatarUpload(event) {
    console.log('📸 Avatar upload triggered');
    
    const file = event.target.files[0];
    if (!file) {
        console.log('⏭️ No file selected');
        return;
    }

    console.log(`📁 File selected: ${file.name}, Size: ${(file.size / 1024).toFixed(1)}KB, Type: ${file.type}`);

    // ★ ファイルサイズをチェック（5MB = 5242880 bytes）
    const MAX_FILE_SIZE = 5 * 1024 * 1024;  // 5MB
    
    if (file.size > MAX_FILE_SIZE) {
        alert(`❌ File too large!\nMax: 5MB\nYour file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        event.target.value = '';  // ファイル選択をリセット
        return;
    }

    // ★ ファイルタイプをチェック
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!ALLOWED_TYPES.includes(file.type)) {
        alert('❌ Invalid file type!\nSupported: JPG, PNG, GIF, WebP');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
        const base64 = e.target.result;
        console.log(`✅ File converted to Base64, Length: ${base64.length}`);
        
        // ★ プレビューに表示
        const previewEl = document.getElementById('avatarPreview');
        if (previewEl) {
            previewEl.style.backgroundImage = `url(${base64})`;
            previewEl.style.backgroundSize = 'cover';
            previewEl.style.backgroundPosition = 'center';
            previewEl.textContent = '';
            console.log('✅ Preview updated');
        }
        
        // ★ Base64をhidden inputに保存
        const base64Input = document.getElementById('avatarBase64');
        if (base64Input) {
            base64Input.value = base64;
            console.log(`✅ Base64 saved to input (${base64.length} chars)`);
        }
    };
    
    reader.onerror = (e) => {
        console.error('❌ Failed to read file:', e);
        alert('❌ Failed to read file. Please try again.');
    };
    
    console.log('📖 Reading file as data URL...');
    reader.readAsDataURL(file);
}

// ★ プロフィール情報を GitHub に保存
async function saveProfile() {
    const name = document.getElementById('editName').value.trim();
    const location = document.getElementById('editLocation').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    const avatarLetter = document.getElementById('editAvatarLetter').value.trim().toUpperCase();
    const avatarBase64 = document.getElementById('avatarBase64').value;

    console.log('🔍 Saving profile...');
    console.log('  Name:', name);
    console.log('  Location:', location);
    console.log('  Bio:', bio);
    console.log('  Avatar Letter:', avatarLetter);
    console.log('  Avatar Base64 length:', avatarBase64 ? avatarBase64.length : 0);
    console.log('  Has existing avatar:', !!(userProfile?.avatarUrl));

    if (!name) {
        alert('Name is required');
        return;
    }

    if (!avatarLetter) {
        alert('Avatar letter is required');
        return;
    }

    // ★ avatarUrl を決定（新しい画像 > 既存画像 > 空）
    let avatarUrl = '';
    
    if (avatarBase64) {
        // ★ 新しい画像がアップロードされた
        avatarUrl = avatarBase64;
        console.log('✅ Using new avatar image');
    } else if (userProfile?.avatarUrl) {
        // ★ 既存画像を保持
        avatarUrl = userProfile.avatarUrl;
        console.log('✅ Using existing avatar image');
    }

    const profileData = {
        name: name,
        email: currentUser?.email || '',
        location: location ? `🇯🇵 ${location}` : '🌍 Worldwide',
        bio: bio,
        avatarLetter: avatarLetter,
        avatarUrl: avatarUrl,  // ★ 新規 or 既存 or 空
        verified: (userProfile || {}).verified || false,
        followers: (userProfile || {}).followers || 0,
        createdAt: (userProfile || {}).createdAt || new Date().toISOString()
    };

    try {
        console.log('💾 Saving profile to GitHub...');
        
        // ★ GitHub に保存
        const response = await fetch(`${API_BASE}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save',
                username: currentUser.username,
                profile: profileData,
                sha: userProfile?.sha
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Profile saved:', data.profile.name);
            console.log('✅ Avatar URL length:', data.profile.avatarUrl ? data.profile.avatarUrl.length : 0);
            
            // ★ ローカルストレージにもキャッシュ
            localStorage.setItem(STORAGE_PREFIX + 'profileData', JSON.stringify(data.profile));
            userProfile = data.profile;
            
            displayProfile();
            closeEditModal();
            alert('✅ Profile updated successfully!');
        } else {
            alert('❌ Error: ' + (data.error || 'Failed to save profile'));
        }
    } catch (error) {
        console.error('❌ Error saving profile:', error);
        alert('Error saving profile: ' + error.message);
    }
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    const editBtn = document.getElementById('editProfileBtn');
    const shareBtn = document.getElementById('shareProfileBtn');
    const homeLink = document.getElementById('homeLink');
    const userBtn = document.getElementById('userBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const avatarUpload = document.getElementById('avatarUpload');

    if (editBtn) {
        editBtn.addEventListener('click', openEditModal);
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const url = window.location.href;
            if (navigator.share) {
                navigator.share({
                    title: 'Check out my BeatWave profile!',
                    url: url
                });
            } else {
                navigator.clipboard.writeText(url);
                alert('Profile URL copied to clipboard!');
            }
        });
    }

    if (homeLink) {
        homeLink.addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem(STORAGE_PREFIX + 'user');
            alert('ログアウトしました');
            window.location.href = '/';
        });
    }

    if (avatarUpload) {
        avatarUpload.addEventListener('change', handleAvatarUpload);
    }

    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            closeEditModal();
        }
    });
}

// ===== UI UPDATES =====

function updateUIForUser() {
    const userBtn = document.getElementById('userBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const editBtn = document.getElementById('editProfileBtn');

    if (currentUser) {
        if (userBtn) {
            userBtn.style.display = 'block';
            userBtn.textContent = currentUser.username[0].toUpperCase();
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
        }
        if (editBtn) {
            editBtn.style.display = 'block';
        }
    } else {
        if (userBtn) userBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
    }
}

// ===== UTILITY FUNCTIONS =====

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function playTrack(trackId) {
    // ★ プロフィールページではトラックを再生できないため、ホームページにリダイレクト
    // app.js の playTrack 関数を使用して再生
    
    // trackId をセッションストレージに保存して、ホームページで読み込む
    sessionStorage.setItem('playTrackId', trackId);
    
    // ホームページへ移動
    window.location.href = '/?play=' + trackId;
}

// ===== EXPORT =====

window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveProfile = saveProfile;
window.handleAvatarUpload = handleAvatarUpload;

// ★ プロフィール統計情報を更新（手動リロード用）
window.refreshProfileStats = function() {
    console.log('🔄 Refreshing profile statistics...');
    
    // ★ キャッシュをクリア
    localStorage.removeItem(STORAGE_PREFIX + 'profileStats');
    
    // ★ 再度計算・表示
    displayProfile();
    
    console.log('✅ Profile statistics refreshed');
    alert('✅ Statistics updated!');
};

// ★ デバッグ用：localStorage のプロフィール情報を表示
window.debugProfile = function() {
    console.log('=== DEBUG PROFILE ===');
    
    // localStorage から読み込み
    const cached = localStorage.getItem(STORAGE_PREFIX + 'profileData');
    if (cached) {
        try {
            const profile = JSON.parse(cached);
            console.log('✅ Profile in localStorage:');
            console.log('  Name:', profile.name);
            console.log('  AvatarLetter:', profile.avatarLetter);
            console.log('  AvatarUrl length:', profile.avatarUrl ? profile.avatarUrl.length : 0);
            console.log('  AvatarUrl start:', profile.avatarUrl ? profile.avatarUrl.substring(0, 50) + '...' : 'N/A');
        } catch (e) {
            console.error('❌ Error parsing profile:', e);
        }
    } else {
        console.warn('⚠️ No profile in localStorage');
    }
    
    // userProfile から表示
    if (userProfile) {
        console.log('✅ Current userProfile:');
        console.log('  Name:', userProfile.name);
        console.log('  AvatarLetter:', userProfile.avatarLetter);
        console.log('  AvatarUrl length:', userProfile.avatarUrl ? userProfile.avatarUrl.length : 0);
    } else {
        console.warn('⚠️ userProfile is null');
    }
    
    // avatarBase64 input から表示
    const base64Input = document.getElementById('avatarBase64');
    if (base64Input) {
        console.log('✅ avatarBase64 input:');
        console.log('  Value length:', base64Input.value ? base64Input.value.length : 0);
        console.log('  Value start:', base64Input.value ? base64Input.value.substring(0, 50) + '...' : 'N/A');
    }
    
    console.log('=== END DEBUG ===');
};