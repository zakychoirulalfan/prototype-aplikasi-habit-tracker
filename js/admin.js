// ================================================================
// admin.js — HabitFlow Admin Control Panel
// Backend: Express + TiDB Cloud on Vercel
// Auth:    x-admin-key header (from localStorage)
// Mobile:  touch-action:manipulation, min 44px targets
// Dark mode: PERMANENTLY REMOVED
// ================================================================

'use strict';

const ADMIN_KEY = 'hf_admin_key';
const API_BASE  = window.location.origin;  // auto-detects localhost vs Vercel

// ─── 1. BOOT ─────────────────────────────────────────────────────
// Runs after DOM is ready. No dependency on app.js.
document.addEventListener('DOMContentLoaded', function () {
    console.log('[Admin] DOMContentLoaded fired — booting admin panel');

    const storedKey = localStorage.getItem(ADMIN_KEY);
    if (!storedKey) {
        console.log('[Admin] No key in storage — prompting user');
        promptAdminKey();
    } else {
        console.log('[Admin] Key found in storage — validating with server');
        initAdmin();
    }
});

// ─── 2. KEY PROMPT ───────────────────────────────────────────────
function promptAdminKey() {
    const key = window.prompt('🔐 Masukkan Admin Secret Key:');
    if (!key || !key.trim()) {
        console.warn('[Admin] No key entered — redirecting to login');
        window.location.replace('login.html');
        return;
    }
    localStorage.setItem(ADMIN_KEY, key.trim());
    console.log('[Admin] Key saved — validating');
    initAdmin();
}

// ─── 3. INIT ─────────────────────────────────────────────────────
async function initAdmin() {
    try {
        const data = await apiFetch('/api/admin/overview');
        if (!data.success) throw new Error('Invalid key');
        console.log('[Admin] Key valid ✅ — loading all data');
        fetchAllStats();
        // Other tabs load on demand — no upfront fetch needed
    } catch (err) {
        console.error('[Admin] Key validation failed:', err.message);
        localStorage.removeItem(ADMIN_KEY);
        alert('❌ Admin Key salah atau server tidak merespons.\nSilakan coba lagi.');
        window.location.replace('login.html');
    }
}

// ─── 4. LOGOUT ───────────────────────────────────────────────────
// Called by onclick="handleAdminLogout()" — works on desktop AND mobile
function handleAdminLogout(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    console.log('[Admin] Logout triggered');
    
    // Clear Admin Key
    localStorage.removeItem(ADMIN_KEY);
    // Clear global app.js admin state
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('currentUser'); // Just to be safe
    sessionStorage.clear();
    
    // replace() prevents back-button returning to admin panel
    window.location.replace('intro.html');
}

// ─── 5. TAB SWITCHING ────────────────────────────────────────────
// Uses .is-active class (defined in HTML <style>) — no Tailwind needed
function switchTab(tabId) {
    console.log('[Admin] switchTab →', tabId);

    // Hide all panels
    document.querySelectorAll('.tab-panel').forEach(function (el) {
        el.classList.remove('is-active');
    });

    // Deactivate all nav buttons
    document.querySelectorAll('.nav-btn').forEach(function (el) {
        el.classList.remove('active');
        // Keep danger class for logout button
    });

    // Show selected panel
    var panel = document.getElementById('tab-' + tabId);
    if (panel) {
        panel.classList.add('is-active');
    } else {
        console.error('[Admin] Panel not found: tab-' + tabId);
    }

    // Activate selected nav button
    var navBtn = document.getElementById('nav-' + tabId);
    if (navBtn) navBtn.classList.add('active');

    // Lazy-load data for that tab
    if (tabId === 'dashboard') fetchAllStats();
    if (tabId === 'users')     fetchUsers();
    if (tabId === 'habits')    fetchHabits();
    if (tabId === 'feedback')  fetchFeedback();
}

// ─── 6. API HELPER ───────────────────────────────────────────────
async function apiFetch(endpoint, options) {
    options = options || {};
    var key = localStorage.getItem(ADMIN_KEY) || '';

    var headers = {
        'Content-Type': 'application/json',
        'x-admin-key': key
    };
    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    var res = await fetch(API_BASE + endpoint, {
        method:  options.method  || 'GET',
        body:    options.body    || undefined,
        headers: headers
    });

    console.log('[Admin] API', options.method || 'GET', endpoint, '→ HTTP', res.status);

    if (res.status === 403) {
        localStorage.removeItem(ADMIN_KEY);
        showToast('Sesi admin habis. Silakan login ulang.', 'error');
        setTimeout(function () { window.location.replace('login.html'); }, 1500);
        throw new Error('Forbidden (403)');
    }

    // Parse JSON — log full body on error for easier debugging
    var json;
    try {
        json = await res.json();
    } catch (parseErr) {
        console.error('[Admin] Failed to parse JSON from', endpoint, '— status:', res.status);
        throw new Error('Server returned non-JSON (HTTP ' + res.status + ')');
    }

    if (!res.ok && !json.success) {
        console.error('[Admin] API error response from', endpoint + ':', json);
    }

    return json;
}

// ─── 7. TOAST (Disabled) ─────────────────────────────────────────
function showToast(message, type) {
    type = type || 'success';
    // UI Notification has been permanently disabled to prevent layout bugs
    console.log(`[Admin] Notification muted [${type}]:`, message);
}

// ─── 8. OVERVIEW STATS ───────────────────────────────────────────
async function fetchAllStats() {
    console.log('[Admin] fetchAllStats()');

    setText('stat-total-users',    '…');
    setText('stat-total-habits',   '…');
    setText('stat-total-feedback', '…');
    setText('stat-avg-rating',     '…');

    try {
        var data = await apiFetch('/api/admin/overview');
        if (!data.success) throw new Error(data.message || 'Unknown error');

        var o = data.overview;
        setText('stat-total-users',    o.total_users);
        setText('stat-total-habits',   o.total_habits);
        setText('stat-total-feedback', o.feedback_items);
        setText('stat-avg-rating',     (o.avg_rating || 0).toFixed(1) + ' / 5');

        console.log('[Admin] Stats loaded:', o);
    } catch (err) {
        console.error('[Admin] fetchAllStats error:', err);
        setText('stat-total-users',    'ERR');
        setText('stat-total-habits',   'ERR');
        setText('stat-total-feedback', 'ERR');
        setText('stat-avg-rating',     'ERR');
    }
}

// ─── 9. USERS ────────────────────────────────────────────────────
async function fetchUsers() {
    console.log('[Admin] fetchUsers()');
    var tbody = document.getElementById('users-table-body');
    tbody.innerHTML = loadingRow(5, 'Memuat data user...');

    try {
        var data = await apiFetch('/api/admin/users');
        if (!data.success) throw new Error(data.message);

        if (!data.users || data.users.length === 0) {
            tbody.innerHTML = emptyRow(5, 'Belum ada user terdaftar.');
            return;
        }

        tbody.innerHTML = data.users.map(function (u) {
            var initial  = (u.username || 'U').charAt(0).toUpperCase();
            var dateStr  = u.created_at
                ? new Date(u.created_at).toLocaleDateString('id-ID', { year:'numeric', month:'short', day:'numeric' })
                : '-';
            var isBanned = u.status === 'banned';
            var badge    = isBanned
                ? '<span class="badge badge-banned">Banned</span>'
                : '<span class="badge badge-active">Active</span>';
            var newStatus = isBanned ? 'active' : 'banned';
            var btnLabel  = isBanned ? 'Unban' : 'Ban';
            var btnClass  = isBanned ? 'btn btn-badge unban' : 'btn btn-badge ban';

            return '<tr>' +
                '<td class="muted" style="font-family:monospace;font-size:.75rem;">' +
                    '<span style="background:#F3F4F6;padding:.2rem .5rem;border-radius:.3rem;">#' + escHtml(String(u.user_id)) + '</span>' +
                '</td>' +
                '<td>' +
                    '<div style="display:flex;align-items:center;gap:.6rem;">' +
                        '<div class="avatar">' + escHtml(initial) + '</div>' +
                        '<div>' +
                            '<div style="font-weight:700;">' + escHtml(u.username) + '</div>' +
                            '<div style="font-size:.75rem;color:#9CA3AF;">' + escHtml(dateStr) + '</div>' +
                        '</div>' +
                    '</div>' +
                '</td>' +
                '<td class="muted">' + escHtml(u.email_address) + '</td>' +
                '<td>' + badge + '</td>' +
                '<td class="right">' +
                    '<div class="row-actions">' +
                        '<button type="button" class="' + btnClass + '" ' +
                            'onclick="updateUserStatus(' + u.user_id + ',\'' + newStatus + '\')" ' +
                            'title="' + btnLabel + '">' + btnLabel + '</button>' +
                        '<button type="button" class="btn btn-icon" ' +
                            'onclick="deleteUser(' + u.user_id + ')" ' +
                            'title="Hapus user">' +
                            '<i class="fa-solid fa-trash"></i>' +
                        '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }).join('');

        console.log('[Admin] Users rendered:', data.users.length);
    } catch (err) {
        console.error('[Admin] fetchUsers error:', err);
        tbody.innerHTML = errorRow(5, 'Gagal memuat user: ' + err.message);
    }
}

async function updateUserStatus(userId, newStatus) {
    console.log('[Admin] updateUserStatus:', userId, '->', newStatus);
    var label = newStatus === 'banned' ? 'BAN' : 'UNBAN';
    if (!confirm('Yakin ingin ' + label + ' user #' + userId + '?')) {
        console.log('[Admin] updateUserStatus cancelled');
        return;
    }
    try {
        var data = await apiFetch('/api/admin/users/' + userId + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        if (!data.success) throw new Error(data.message);
        showToast(data.message, 'success');
        fetchUsers();
        fetchAllStats();
    } catch (err) {
        console.error('[Admin] updateUserStatus error:', err);
        showToast('Gagal: ' + err.message, 'error');
    }
}

async function deleteUser(userId) {
    console.log('[Admin] deleteUser:', userId);
    if (!confirm('⚠️ HAPUS PERMANEN user #' + userId + ' beserta semua habit & datanya?\nTindakan ini tidak bisa dibatalkan!')) {
        console.log('[Admin] deleteUser cancelled');
        return;
    }
    try {
        var data = await apiFetch('/api/admin/users/' + userId, { method: 'DELETE' });
        if (!data.success) throw new Error(data.message);
        showToast(data.message, 'success');
        fetchUsers();
        fetchAllStats();
    } catch (err) {
        console.error('[Admin] deleteUser error:', err);
        showToast('Gagal: ' + err.message, 'error');
    }
}

// ─── 10. HABITS ──────────────────────────────────────────────────
async function fetchHabits() {
    console.log('[Admin] fetchHabits()');
    var tbody = document.getElementById('habits-table-body');
    tbody.innerHTML = loadingRow(5, 'Memuat data habit...');

    try {
        var data = await apiFetch('/api/admin/habits');
        if (!data.success) throw new Error(data.message);

        if (!data.habits || data.habits.length === 0) {
            tbody.innerHTML = emptyRow(5, 'Belum ada habit.');
            return;
        }

        tbody.innerHTML = data.habits.map(function (h) {
            var dateStr   = h.created_on
                ? new Date(h.created_on).toLocaleDateString('id-ID', { year:'numeric', month:'short', day:'numeric' })
                : '-';
            var statusTag = h.is_active
                ? '<span class="badge-tag-sm badge-active-sm">ACTIVE</span>'
                : '<span class="badge-tag-sm badge-inactive-sm">INACTIVE</span>';

            return '<tr>' +
                '<td>' +
                    '<span style="font-weight:700;">' + escHtml(h.habit_detail) + '</span> ' + statusTag +
                '</td>' +
                '<td><span class="badge-tag">' + escHtml(h.category) + '</span></td>' +
                '<td>' +
                    '<div style="font-weight:600;font-size:.875rem;">' + escHtml(h.username) + '</div>' +
                    '<div style="font-size:.75rem;color:#9CA3AF;">' + escHtml(h.owner_email) + '</div>' +
                '</td>' +
                '<td class="muted">' + escHtml(dateStr) + '</td>' +
                '<td class="right">' +
                    '<div class="row-actions">' +
                        '<button type="button" class="btn btn-icon" ' +
                            'onclick="deleteHabit(' + h.habit_id + ')" ' +
                            'title="Hapus habit">' +
                            '<i class="fa-solid fa-trash"></i>' +
                        '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }).join('');

        console.log('[Admin] Habits rendered:', data.habits.length);
    } catch (err) {
        console.error('[Admin] fetchHabits error:', err);
        tbody.innerHTML = errorRow(5, 'Gagal memuat habit: ' + err.message);
    }
}

async function deleteHabit(habitId) {
    console.log('[Admin] deleteHabit:', habitId);
    if (!confirm('Hapus habit #' + habitId + '?\nProgress log-nya juga terhapus (CASCADE).')) {
        console.log('[Admin] deleteHabit cancelled');
        return;
    }
    try {
        var data = await apiFetch('/api/admin/habits/' + habitId, { method: 'DELETE' });
        if (!data.success) throw new Error(data.message);
        showToast(data.message, 'success');
        fetchHabits();
        fetchAllStats();
    } catch (err) {
        console.error('[Admin] deleteHabit error:', err);
        showToast('Gagal: ' + err.message, 'error');
    }
}

// ─── 11. FEEDBACK ────────────────────────────────────────────────
async function fetchFeedback() {
    console.log('[Admin] fetchFeedback()');
    var tbody = document.getElementById('feedback-table-body');
    tbody.innerHTML = loadingRow(5, 'Memuat feedback...');

    try {
        var data = await apiFetch('/api/admin/feedback');
        if (!data.success) throw new Error(data.message);

        if (!data.feedback || data.feedback.length === 0) {
            tbody.innerHTML = emptyRow(5, 'Belum ada feedback.');
            return;
        }

        tbody.innerHTML = data.feedback.map(function (fb) {
            var dateStr = fb.date_submitted
                ? new Date(fb.date_submitted).toLocaleString('id-ID', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
                : '-';

            // Stars — no dark: class
            var stars = '';
            for (var i = 0; i < 5; i++) {
                var col = i < fb.rating ? '#F59E0B' : '#E5E7EB';
                stars += '<i class="fa-solid fa-star" style="color:' + col + ';font-size:.8rem;"></i>';
            }

            var comment = escHtml(fb.feedback_comment || 'Tidak ada komentar');

            return '<tr>' +
                '<td>' +
                    '<div style="display:flex;gap:.2rem;margin-bottom:.25rem;">' + stars + '</div>' +
                    '<div style="font-size:.7rem;font-weight:700;color:#9CA3AF;">' + escHtml(String(fb.rating)) + '/5</div>' +
                '</td>' +
                '<td>' +
                    '<div style="font-size:.875rem;font-style:italic;padding-left:.75rem;border-left:2px solid #10B981;">"' + comment + '"</div>' +
                    '<div style="font-size:.75rem;color:#9CA3AF;margin-top:.2rem;">— ' + escHtml(fb.username || 'Anonymous') + '</div>' +
                '</td>' +
                '<td><span class="badge-source">' + escHtml(fb.source || 'Web') + '</span></td>' +
                '<td style="font-size:.75rem;color:#9CA3AF;">' + escHtml(dateStr) + '</td>' +
                '<td class="right">' +
                    '<div class="row-actions">' +
                        '<button type="button" class="btn btn-icon" ' +
                            'onclick="deleteFeedback(' + fb.id + ')" ' +
                            'title="Hapus feedback">' +
                            '<i class="fa-solid fa-trash"></i>' +
                        '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }).join('');

        console.log('[Admin] Feedback rendered:', data.feedback.length);
    } catch (err) {
        console.error('[Admin] fetchFeedback error:', err);
        tbody.innerHTML = errorRow(5, 'Gagal memuat feedback: ' + err.message);
    }
}

async function deleteFeedback(feedbackId) {
    console.log('[Admin] deleteFeedback:', feedbackId);
    if (!confirm('Hapus feedback #' + feedbackId + '?')) {
        console.log('[Admin] deleteFeedback cancelled');
        return;
    }
    try {
        var data = await apiFetch('/api/admin/feedback/' + feedbackId, { method: 'DELETE' });
        if (!data.success) throw new Error(data.message);
        showToast(data.message, 'success');
        fetchFeedback();
        fetchAllStats();
    } catch (err) {
        console.error('[Admin] deleteFeedback error:', err);
        showToast('Gagal: ' + err.message, 'error');
    }
}

// ─── 12. UTILITIES ───────────────────────────────────────────────
function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

function loadingRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" class="loading-td">' +
        '<i class="fa-solid fa-spinner fa-spin" style="color:#10B981;margin-right:.5rem;"></i>' +
        escHtml(msg) +
    '</td></tr>';
}

function emptyRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" class="loading-td">' + escHtml(msg) + '</td></tr>';
}

function errorRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" style="padding:2rem;text-align:center;color:#EF4444;">' +
        '<i class="fa-solid fa-triangle-exclamation" style="margin-right:.4rem;"></i>' +
        escHtml(msg) +
    '</td></tr>';
}

// XSS-safe HTML escaper
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
