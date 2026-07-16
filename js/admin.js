// ================================================================
// admin.js — HabitFlow Admin Control Panel
// Connects to: Express backend /api/admin/* (TiDB Cloud)
// Auth: x-admin-key header from localStorage
// ================================================================

// ─── CONSTANTS ──────────────────────────────────────────────────
const ADMIN_KEY_STORAGE = 'hf_admin_key';

// Detect base URL automatically (works on localhost AND Vercel)
const API_BASE = window.location.origin;

// ─── BOOT ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const storedKey = localStorage.getItem(ADMIN_KEY_STORAGE);

    if (!storedKey) {
        promptAdminKey();
    } else {
        initAdmin(storedKey);
    }
});

// Prompt for admin key if not stored
function promptAdminKey() {
    const key = window.prompt('🔐 Masukkan Admin Secret Key untuk mengakses panel ini:');
    if (!key) {
        window.location.href = 'login.html';
        return;
    }
    localStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
    initAdmin(key.trim());
}

// Initialize admin panel
async function initAdmin(key) {
    // Validate key against server first
    try {
        const res = await apiFetch('/api/admin/overview');
        if (!res.success) throw new Error('Unauthorized');
        // Key valid — render dashboard
        fetchAllStats();
        fetchUsers();
        fetchHabits();
        fetchFeedback();
    } catch (err) {
        localStorage.removeItem(ADMIN_KEY_STORAGE);
        alert('❌ Admin Key salah atau server tidak merespons. Silakan coba lagi.');
        window.location.href = 'login.html';
    }
}

// ─── API HELPER ──────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const key = localStorage.getItem(ADMIN_KEY_STORAGE) || '';
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'x-admin-key': key
    };
    const res = await fetch(API_BASE + endpoint, {
        ...options,
        headers: { ...defaultHeaders, ...(options.headers || {}) }
    });
    if (res.status === 403) {
        localStorage.removeItem(ADMIN_KEY_STORAGE);
        alert('❌ Sesi admin habis. Silakan login ulang.');
        window.location.href = 'login.html';
        throw new Error('Forbidden');
    }
    return res.json();
}

// ─── LOGOUT ──────────────────────────────────────────────────────
function handleAdminLogout() {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    window.location.href = 'login.html';
}

// ─── TAB SWITCHING ───────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-nav-item').forEach(el => {
        el.className = 'admin-nav-item relative overflow-hidden flex items-center gap-3 px-5 py-3.5 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-[var(--primary)] font-medium transition-all group';
    });
    const tab = document.getElementById(`tab-${tabId}`);
    if (tab) tab.classList.remove('hidden');
    const navBtn = document.getElementById(`nav-${tabId}`);
    if (navBtn) {
        navBtn.className = 'admin-nav-item relative overflow-hidden flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[var(--primary)] text-white font-semibold shadow-lg shadow-primary/30 transition-all group';
    }
}

// ─── TOAST NOTIFICATION ──────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.getElementById('admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'admin-toast';
    const colors = type === 'success'
        ? 'bg-emerald-500 text-white'
        : 'bg-red-500 text-white';
    toast.className = `fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm flex items-center gap-2 transition-all ${colors}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ─── OVERVIEW / STATS ────────────────────────────────────────────
async function fetchAllStats() {
    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    setEl('stat-total-users', '…');
    setEl('stat-total-habits', '…');
    setEl('stat-total-feedback', '…');
    setEl('stat-avg-rating', '…');

    try {
        const data = await apiFetch('/api/admin/overview');
        if (!data.success) throw new Error(data.message);
        const o = data.overview;
        setEl('stat-total-users', o.total_users);
        setEl('stat-total-habits', o.total_habits);
        setEl('stat-total-feedback', o.feedback_items);
        setEl('stat-avg-rating', (o.avg_rating || 0).toFixed(1) + ' / 5');
    } catch (err) {
        console.error('❌ fetchAllStats:', err);
        setEl('stat-total-users', 'ERR');
        setEl('stat-total-habits', 'ERR');
        setEl('stat-total-feedback', 'ERR');
        setEl('stat-avg-rating', 'ERR');
    }
}

// ─── USERS ───────────────────────────────────────────────────────
async function fetchUsers() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-[var(--text-muted)]"><i class="fa-solid fa-spinner fa-spin mr-2 text-primary"></i>Memuat data user...</td></tr>`;

    try {
        const data = await apiFetch('/api/admin/users');
        if (!data.success) throw new Error(data.message);

        if (data.users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-[var(--text-muted)]">Belum ada user terdaftar.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.users.map(user => {
            const initial = (user.username || 'U').charAt(0).toUpperCase();
            const dateStr = user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
            const isBanned = user.status === 'banned';
            const statusBadge = isBanned
                ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">Banned</span>`
                : `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">Active</span>`;
            const banBtnLabel = isBanned ? 'Unban' : 'Ban';
            const banBtnClass = isBanned
                ? 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400'
                : 'hover:bg-orange-50 hover:text-orange-500 dark:hover:bg-orange-500/20 dark:hover:text-orange-400';
            const newStatus = isBanned ? 'active' : 'banned';

            return `
            <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-all group">
                <td class="p-5 font-mono text-xs text-gray-500 align-middle">
                    <span class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">#${user.user_id}</span>
                </td>
                <td class="p-5 align-middle">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-emerald-300 text-white flex items-center justify-center font-bold text-sm shadow-sm">${initial}</div>
                        <div>
                            <div class="font-bold text-[var(--text-main)]">${escHtml(user.username)}</div>
                            <div class="text-xs text-[var(--text-muted)]">${dateStr}</div>
                        </div>
                    </div>
                </td>
                <td class="p-5 text-[var(--text-muted)] text-sm align-middle">${escHtml(user.email_address)}</td>
                <td class="p-5 align-middle">${statusBadge}</td>
                <td class="p-5 text-right align-middle">
                    <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button class="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 ${banBtnClass} transition-all"
                            onclick="updateUserStatus(${user.user_id}, '${newStatus}')" title="${banBtnLabel} user">${banBtnLabel}</button>
                        <button class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all"
                            onclick="deleteUser(${user.user_id})" title="Hapus user">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error('❌ fetchUsers:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Gagal memuat data user: ${err.message}</td></tr>`;
    }
}

async function updateUserStatus(userId, newStatus) {
    const label = newStatus === 'banned' ? 'BAN' : 'UNBAN';
    if (!confirm(`Yakin ingin ${label} user ID #${userId}?`)) return;
    try {
        const data = await apiFetch(`/api/admin/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        if (!data.success) throw new Error(data.message);
        showToast(data.message);
        fetchUsers();
        fetchAllStats();
    } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm(`⚠️ HAPUS PERMANEN user #${userId} beserta semua habit dan datanya? Tindakan ini tidak bisa dibatalkan!`)) return;
    try {
        const data = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        if (!data.success) throw new Error(data.message);
        showToast(data.message);
        fetchUsers();
        fetchAllStats();
    } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
    }
}

// ─── HABITS ──────────────────────────────────────────────────────
async function fetchHabits() {
    const tbody = document.getElementById('habits-table-body');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-[var(--text-muted)]"><i class="fa-solid fa-spinner fa-spin mr-2 text-primary"></i>Memuat data habit...</td></tr>`;

    try {
        const data = await apiFetch('/api/admin/habits');
        if (!data.success) throw new Error(data.message);

        if (data.habits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-[var(--text-muted)]">Belum ada habit.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.habits.map(h => {
            const dateStr = h.created_on ? new Date(h.created_on).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
            const activeTag = h.is_active
                ? `<span class="ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded font-bold">ACTIVE</span>`
                : `<span class="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-400 dark:bg-gray-700 rounded font-bold">INACTIVE</span>`;
            return `
            <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-all group">
                <td class="p-5 align-middle">
                    <div class="font-bold text-[var(--text-main)]">${escHtml(h.habit_detail)} ${activeTag}</div>
                </td>
                <td class="p-5 align-middle">
                    <span class="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 text-xs rounded-full font-bold">${escHtml(h.category)}</span>
                </td>
                <td class="p-5 align-middle">
                    <div class="text-sm font-medium">${escHtml(h.username)}</div>
                    <div class="text-xs text-[var(--text-muted)]">${escHtml(h.owner_email)}</div>
                </td>
                <td class="p-5 text-[var(--text-muted)] text-sm align-middle">${dateStr}</td>
                <td class="p-5 text-right align-middle">
                    <button class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                        onclick="deleteHabit(${h.habit_id})" title="Hapus habit">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error('❌ fetchHabits:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Gagal memuat data habit: ${err.message}</td></tr>`;
    }
}

async function deleteHabit(habitId) {
    if (!confirm(`Hapus habit #${habitId}? Progress log-nya juga akan terhapus (CASCADE).`)) return;
    try {
        const data = await apiFetch(`/api/admin/habits/${habitId}`, { method: 'DELETE' });
        if (!data.success) throw new Error(data.message);
        showToast(data.message);
        fetchHabits();
        fetchAllStats();
    } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
    }
}

// ─── FEEDBACK ────────────────────────────────────────────────────
async function fetchFeedback() {
    const tbody = document.getElementById('feedback-table-body');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-[var(--text-muted)]"><i class="fa-solid fa-spinner fa-spin mr-2 text-primary"></i>Memuat feedback...</td></tr>`;

    try {
        const data = await apiFetch('/api/admin/feedback');
        if (!data.success) throw new Error(data.message);

        if (data.feedback.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-[var(--text-muted)]">Belum ada feedback dari user.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.feedback.map(fb => {
            const dateStr = fb.date_submitted
                ? new Date(fb.date_submitted).toLocaleString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '-';
            const stars = Array(5).fill(0).map((_, i) =>
                `<i class="fa-solid fa-star ${i < fb.rating ? 'text-amber-400' : 'text-gray-200 dark:text-gray-700'} text-sm"></i>`
            ).join('');
            const comment = escHtml(fb.feedback_comment || 'Tidak ada komentar');
            return `
            <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-all group">
                <td class="p-5 whitespace-nowrap align-top pt-6">
                    <div class="flex gap-0.5 mb-1">${stars}</div>
                    <div class="text-xs font-bold text-[var(--text-muted)]">${fb.rating}/5</div>
                </td>
                <td class="p-5 align-top pt-6">
                    <div class="text-sm font-medium text-[var(--text-main)] italic pl-3 border-l-2 border-[var(--primary)]/50">"${comment}"</div>
                    <div class="text-xs text-[var(--text-muted)] mt-1">— ${escHtml(fb.username || 'Anonymous')}</div>
                </td>
                <td class="p-5 align-top pt-6">
                    <span class="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] uppercase tracking-wider font-bold rounded-md">${escHtml(fb.source || 'Web')}</span>
                </td>
                <td class="p-5 text-[var(--text-muted)] text-xs font-medium align-top pt-6">${dateStr}</td>
                <td class="p-5 text-right align-top pt-5">
                    <button class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                        onclick="deleteFeedback(${fb.id})" title="Hapus feedback">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error('❌ fetchFeedback:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Gagal memuat feedback: ${err.message}</td></tr>`;
    }
}

async function deleteFeedback(feedbackId) {
    if (!confirm(`Hapus feedback #${feedbackId}?`)) return;
    try {
        const data = await apiFetch(`/api/admin/feedback/${feedbackId}`, { method: 'DELETE' });
        if (!data.success) throw new Error(data.message);
        showToast(data.message);
        fetchFeedback();
        fetchAllStats();
    } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
    }
}

// ─── UTILITY: XSS-safe HTML escape ───────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
