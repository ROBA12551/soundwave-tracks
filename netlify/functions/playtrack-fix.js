// 修正: playTrack 関数（CORS対応）
let currentAudio = null;
let isPlayingTrack = false;

async function playTrack(trackId) {
    try {
        // 既存の再生を停止
        if (currentAudio) {
            try {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            } catch (e) {}
        }

        console.log('Playing track:', trackId);

        // トラック情報を取得
        const response = await fetch(`${API_BASE}/tracks`);
        const data = await response.json();
        const track = data.tracks?.find(t => t.id === trackId);

        if (!track || !track.audioUrl) {
            console.error('Track not found or no audio URL');
            return;
        }

        console.log('Audio URL:', track.audioUrl);

        // 新しい Audio オブジェクトを作成
        currentAudio = new Audio();
        currentAudio.crossOrigin = "anonymous";
        
        // GitHub Raw URLは直接使用（プロキシ不要）
        currentAudio.src = track.audioUrl;
        currentAudio.preload = "metadata";

        // UI更新
        document.getElementById('playerTitle').textContent = track.title || 'Unknown';
        document.getElementById('playerArtist').textContent = track.artist || 'Unknown';

        // メタデータ読み込み
        currentAudio.onloadedmetadata = () => {
            console.log('✅ Metadata loaded, Duration:', currentAudio.duration);
            if (document.getElementById('duration')) {
                document.getElementById('duration').textContent = formatTime(currentAudio.duration);
            }
        };

        // 時間更新
        currentAudio.ontimeupdate = () => {
            if (currentAudio.duration > 0) {
                const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
                if (document.getElementById('playerProgressFill')) {
                    document.getElementById('playerProgressFill').style.width = progress + '%';
                }
                if (document.getElementById('timeDisplay')) {
                    document.getElementById('timeDisplay').textContent = formatTime(currentAudio.currentTime);
                }
            }
        };

        // 終了時
        currentAudio.onended = () => {
            console.log('Track ended');
            // playNext() があれば呼び出し
        };

        // エラーハンドリング
        currentAudio.onerror = (error) => {
            console.error('Audio error:', error);
            const errorMsg = currentAudio.error?.message || 'Unknown error';
            console.error('Error message:', errorMsg);
        };

        // 再生開始
        isPlayingTrack = true;
        const playPromise = currentAudio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('✅ Now playing');
                    if (document.getElementById('playBtn')) {
                        document.getElementById('playBtn').textContent = '⏸';
                    }
                })
                .catch((error) => {
                    console.error('❌ Play error:', error.name, error.message);
                    // AbortError は無視（既に停止している）
                    if (error.name !== 'AbortError') {
                        isPlayingTrack = false;
                        if (document.getElementById('playBtn')) {
                            document.getElementById('playBtn').textContent = '▶';
                        }
                    }
                });
        }

    } catch (error) {
        console.error('PlayTrack error:', error);
        isPlayingTrack = false;
    }
}

// 修正: togglePlay 関数
function togglePlay() {
    if (!currentAudio || !currentAudio.src) {
        console.log('No track selected');
        if (playlist && playlist.length > 0) {
            playTrack(playlist[0].id);
        }
        return;
    }

    try {
        if (isPlayingTrack) {
            // 再生中 → 一時停止
            currentAudio.pause();
            isPlayingTrack = false;
            if (document.getElementById('playBtn')) {
                document.getElementById('playBtn').textContent = '▶';
            }
            console.log('Paused');
        } else {
            // 一時停止中 → 再生再開
            const playPromise = currentAudio.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        isPlayingTrack = true;
                        if (document.getElementById('playBtn')) {
                            document.getElementById('playBtn').textContent = '⏸';
                        }
                        console.log('Resumed');
                    })
                    .catch((error) => {
                        console.error('Resume error:', error.name);
                        if (error.name !== 'AbortError') {
                            isPlayingTrack = false;
                        }
                    });
            }
        }
    } catch (error) {
        console.error('Toggle play error:', error);
    }
}

// プログレスバークリック
if (document.getElementById('playerProgress')) {
    document.getElementById('playerProgress').addEventListener('click', (e) => {
        if (!currentAudio || !currentAudio.duration) return;

        const bar = e.currentTarget;
        const rect = bar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        currentAudio.currentTime = percent * currentAudio.duration;
        console.log('Seek to:', formatTime(currentAudio.currentTime));
    });
}

// 時間フォーマット
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 再生ボタンクリック
if (document.getElementById('playBtn')) {
    document.getElementById('playBtn').addEventListener('click', togglePlay);
}