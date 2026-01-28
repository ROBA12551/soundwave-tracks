// Follow System Functions
const FOLLOW_PREFIX = 'soundwave_follows_';
const LIKE_PREFIX = 'soundwave_likes_';
const COMMENT_PREFIX = 'soundwave_comments_';
const PLAYS_PREFIX = 'soundwave_plays_';

// ===== FOLLOW FUNCTIONS =====

/**
 * フォローする
 */
async function followArtist(artistName, currentUsername) {
    try {
        const key = FOLLOW_PREFIX + currentUsername;
        let follows = JSON.parse(localStorage.getItem(key) || '[]');
        
        if (!follows.includes(artistName)) {
            follows.push(artistName);
            localStorage.setItem(key, JSON.stringify(follows));
            console.log('✅ Following:', artistName);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error following artist:', error);
        return false;
    }
}

/**
 * フォロー解除
 */
async function unfollowArtist(artistName, currentUsername) {
    try {
        const key = FOLLOW_PREFIX + currentUsername;
        let follows = JSON.parse(localStorage.getItem(key) || '[]');
        
        const index = follows.indexOf(artistName);
        if (index > -1) {
            follows.splice(index, 1);
            localStorage.setItem(key, JSON.stringify(follows));
            console.log('✅ Unfollowed:', artistName);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error unfollowing artist:', error);
        return false;
    }
}

/**
 * フォロー状態を確認
 */
function isFollowing(artistName, currentUsername) {
    try {
        const key = FOLLOW_PREFIX + currentUsername;
        const follows = JSON.parse(localStorage.getItem(key) || '[]');
        return follows.includes(artistName);
    } catch (error) {
        console.error('Error checking follow status:', error);
        return false;
    }
}

/**
 * フォロー一覧を取得
 */
function getFollows(currentUsername) {
    try {
        const key = FOLLOW_PREFIX + currentUsername;
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (error) {
        console.error('Error getting follows:', error);
        return [];
    }
}

// ===== LIKE FUNCTIONS =====

/**
 * トラックにいいねする
 */
async function likeTrack(trackId, currentUsername) {
    try {
        const key = LIKE_PREFIX + currentUsername;
        let likes = JSON.parse(localStorage.getItem(key) || '[]');
        
        if (!likes.includes(trackId)) {
            likes.push(trackId);
            localStorage.setItem(key, JSON.stringify(likes));
            console.log('✅ Liked track:', trackId);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error liking track:', error);
        return false;
    }
}

/**
 * いいねを取り消す
 */
async function unlikeTrack(trackId, currentUsername) {
    try {
        const key = LIKE_PREFIX + currentUsername;
        let likes = JSON.parse(localStorage.getItem(key) || '[]');
        
        const index = likes.indexOf(trackId);
        if (index > -1) {
            likes.splice(index, 1);
            localStorage.setItem(key, JSON.stringify(likes));
            console.log('✅ Unliked track:', trackId);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error unliking track:', error);
        return false;
    }
}

/**
 * トラックがいいねされているか確認
 */
function isLiked(trackId, currentUsername) {
    try {
        const key = LIKE_PREFIX + currentUsername;
        const likes = JSON.parse(localStorage.getItem(key) || '[]');
        return likes.includes(trackId);
    } catch (error) {
        console.error('Error checking like status:', error);
        return false;
    }
}

/**
 * いいね一覧を取得
 */
function getLikes(currentUsername) {
    try {
        const key = LIKE_PREFIX + currentUsername;
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (error) {
        console.error('Error getting likes:', error);
        return [];
    }
}

// ===== COMMENT FUNCTIONS =====

/**
 * コメントを追加
 */
async function addComment(trackId, username, text) {
    try {
        const key = COMMENT_PREFIX + trackId;
        let comments = JSON.parse(localStorage.getItem(key) || '[]');
        
        const comment = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            username: username,
            text: text,
            timestamp: new Date().toISOString(),
            likes: 0
        };

        comments.push(comment);
        localStorage.setItem(key, JSON.stringify(comments));
        
        console.log('✅ Comment added:', comment.id);
        return comment;
    } catch (error) {
        console.error('Error adding comment:', error);
        return null;
    }
}

/**
 * トラックのコメントを取得
 */
function getComments(trackId) {
    try {
        const key = COMMENT_PREFIX + trackId;
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (error) {
        console.error('Error getting comments:', error);
        return [];
    }
}

/**
 * コメント数を取得
 */
function getCommentCount(trackId) {
    return getComments(trackId).length;
}

/**
 * コメントを削除
 */
async function deleteComment(trackId, commentId, currentUsername) {
    try {
        const key = COMMENT_PREFIX + trackId;
        let comments = JSON.parse(localStorage.getItem(key) || '[]');
        
        const comment = comments.find(c => c.id === commentId);
        if (comment && comment.username === currentUsername) {
            comments = comments.filter(c => c.id !== commentId);
            localStorage.setItem(key, JSON.stringify(comments));
            console.log('✅ Comment deleted:', commentId);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting comment:', error);
        return false;
    }
}

// ===== PLAY COUNT FUNCTIONS (IP-based duplicate prevention) =====

/**
 * 再生をカウント（同じIPから同じ曲は1回だけカウント）
 */
async function recordPlay(trackId, ipAddress) {
    try {
        const key = PLAYS_PREFIX + new Date().toDateString();  // Daily reset
        let plays = JSON.parse(localStorage.getItem(key) || '{}');
        
        const playKey = `${trackId}_${ipAddress}`;
        
        if (!plays[playKey]) {
            plays[playKey] = true;
            localStorage.setItem(key, JSON.stringify(plays));
            console.log('✅ Play recorded:', trackId, ipAddress);
            return true;  // Increment count
        }
        
        console.log('⏭️ Play already recorded today for this track from this IP');
        return false;  // Don't increment count
    } catch (error) {
        console.error('Error recording play:', error);
        return false;
    }
}

/**
 * ユーザーのIPアドレスを取得
 */
async function getUserIP() {
    try {
        const stored = localStorage.getItem('soundwave_userIP');
        if (stored) return stored;

        const response = await fetch('https://api.ipify.org?format=json', {
            method: 'GET',
            mode: 'cors'
        });

        if (response.ok) {
            const data = await response.json();
            const ip = data.ip;
            localStorage.setItem('soundwave_userIP', ip);
            return ip;
        }

        // Fallback
        return 'unknown';
    } catch (error) {
        console.error('Error getting IP:', error);
        return 'unknown';
    }
}

/**
 * 本日の再生数を取得
 */
function getPlaysToday(trackId, ipAddress) {
    try {
        const key = PLAYS_PREFIX + new Date().toDateString();
        const plays = JSON.parse(localStorage.getItem(key) || '{}');
        const playKey = `${trackId}_${ipAddress}`;
        return plays[playKey] ? 1 : 0;
    } catch (error) {
        console.error('Error getting plays:', error);
        return 0;
    }
}

async function initializeFollowAndLikeSystem() {
    console.log('🔧 Initializing follow and like system...');
    
    // Get user IP
    const ip = await getUserIP();
    console.log('📍 User IP:', ip);
    
    console.log('✅ System initialized');
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeFollowAndLikeSystem();
});