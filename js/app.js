// ================================================================
// app.js — HabitFlow Frontend Core
// Auth: MySQL backend () + localStorage session
// Supabase: DIHAPUS TOTAL — migrasi ke Full Custom Backend
// ================================================================

// Stub agar kode lama yang masih referensikan supabaseClient tidak crash
const supabaseClient = null;

// Initialize theme (Dark mode removed)
function initTheme() {
    let savedTheme = 'light';
    localStorage.setItem('theme', savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setupBackgroundGradient(savedTheme);
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: savedTheme } }));
}

// Global dynamic background gradient setup setup
function setupBackgroundGradient(theme) {
    if (window.location.pathname.toLowerCase().includes('admin_dashboard.html')) return;
    let container = document.querySelector('main.flex-1.overflow-y-auto') || document.querySelector('main');
    if (!container) {
        container = document.body;
        // make sure body is relative so absolute positioning works if it's the scroll container
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
    }

    // Check if it already exists
    let bgGradient = document.getElementById('theme-bg-gradient');
    if (!bgGradient) {
        bgGradient = document.createElement('div');
        bgGradient.id = 'theme-bg-gradient';
        bgGradient.className = 'absolute top-0 left-0 right-0 h-[400px] z-0 pointer-events-none transition-all duration-700';
        container.insertBefore(bgGradient, container.firstChild);
    } else {
        // Update classes if it exists (override legacy fixed inset-0)
        bgGradient.className = 'absolute top-0 left-0 right-0 h-[400px] z-0 pointer-events-none transition-all duration-700';
        if (bgGradient.parentElement !== container) {
            container.insertBefore(bgGradient, container.firstChild);
        }
    }

    updateGradientColor(theme || document.documentElement.getAttribute('data-theme') || 'green');
}

function updateGradientColor(theme) {
    const bgGradient = document.getElementById('theme-bg-gradient');
    if (bgGradient) {
        if (theme === 'dark') {
            bgGradient.style.background = 'linear-gradient(180deg, #064E3B 0%, #111827 50%, rgba(255,255,255,0) 100%)';
        } else if (theme === 'blue') {
            bgGradient.style.background = 'linear-gradient(180deg, #4480ba 0%, #acc9e6 50%, rgba(255,255,255,0) 100%)';
        } else {
            bgGradient.style.background = 'linear-gradient(180deg, #10B981 0%, #6ee7b7 50%, rgba(255,255,255,0) 100%)';
        }
    }
}

// Toggle theme between light and dark
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setupBackgroundGradient(newTheme);
    
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
}

// Ripple effect for interactive elements
function createRipple(event) {
    const button = event.currentTarget;

    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;

    // Get click coordinates relative to button
    const rect = button.getBoundingClientRect();
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');

    // Remove existing ripples
    const ripple = button.querySelector('.ripple');
    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);

    // Clean up
    setTimeout(() => {
        circle.remove();
    }, 600);
}

// Check habit interaction
function toggleHabit(btn) {
    const isChecked = btn.querySelector('.visible') !== null;
    const icon = btn.querySelector('i');

    if (isChecked) {
        // Uncheck
        btn.classList.add('opacity-50');
        btn.classList.remove('bg-white', 'text-[var(--primary)]');
        icon.classList.remove('visible');
        icon.classList.add('invisible');
    } else {
        // Check
        btn.classList.remove('opacity-50');
        btn.classList.add('bg-white', 'text-[var(--primary)]');
        icon.classList.remove('invisible');
        icon.classList.add('visible');

        // Add popping animation
        btn.style.transform = 'scale(1.2)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 150);
    }
}

function initApp() {
    initTheme();
    renderDynamicDateSlider();

    // Add ripple effect for a satisfying click animation to all interactive elements
    const rippleButtons = document.querySelectorAll('.fab, .nav-item, .date-card, .check-btn, button, .account-btn, .cal-day');
    rippleButtons.forEach(btn => {
        // Ensure relative positioning
        if (getComputedStyle(btn).position === 'static') {
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
        }
        btn.addEventListener('mousedown', createRipple);
        // Also support touch
        btn.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                // Mock a click event for the ripple
                const touch = e.touches[0];
                e.clientX = touch.clientX;
                e.clientY = touch.clientY;
                createRipple(e);
            }
        }, { passive: true });
    });

    // Setup check buttons
    const checkBtns = document.querySelectorAll('.check-btn');
    checkBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent ripple from firing twice if parent has it
            toggleHabit(btn);
        });
    });

    // Route protection: cek session MySQL di localStorage
    handleRouteProtection();
}

// initHeroSlider removed — Swiper.js handles the hero slider in index.html

// === Custom Toast Notification System ===
// Sistem notifikasi Toast premium dengan dukungan 4 tipe:
// 'success' (hijau), 'error' (merah), 'warning' (kuning), 'info' (biru)
// Setiap toast muncul dengan animasi slide-in dan otomatis hilang setelah 4 detik.
window.showToast = function (message, type = 'success') {
    // Injeksi style animasi ke <head> jika belum ada (hanya sekali)
    if (!document.getElementById('toast-keyframes-style')) {
        const style = document.createElement('style');
        style.id = 'toast-keyframes-style';
        style.textContent = `
            @keyframes _toastSlideIn {
                from { opacity: 0; transform: translateX(110%); }
                to   { opacity: 1; transform: translateX(0); }
            }
            @keyframes _toastFadeOut {
                from { opacity: 1; transform: translateX(0); }
                to   { opacity: 0; transform: translateX(110%); }
            }
            ._toast-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                min-width: 260px;
                max-width: 340px;
                padding: 13px 16px;
                border-radius: 14px;
                font-family: inherit;
                font-size: 13.5px;
                font-weight: 500;
                line-height: 1.45;
                box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                cursor: pointer;
                animation: _toastSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                position: relative;
                overflow: hidden;
            }
            ._toast-item::after {
                content: '';
                position: absolute;
                bottom: 0; left: 0;
                height: 3px;
                background: rgba(255,255,255,0.35);
                border-radius: 0 0 14px 14px;
                animation: _toastProgress linear forwards;
            }
            ._toast-fadeout { animation: _toastFadeOut 0.3s ease forwards !important; }
            @keyframes _toastProgress {
                from { width: 100%; }
                to   { width: 0%; }
            }
        `;
        document.head.appendChild(style);
    }

    // Buat atau temukan container toast (pojok kanan atas)
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = [
            'position:fixed',
            'top:20px',
            'right:20px',
            'z-index:99999',
            'display:flex',
            'flex-direction:column',
            'gap:10px',
            'pointer-events:none'
        ].join(';');
        document.body.appendChild(container);
    }

    // Palet warna & ikon untuk setiap tipe
    const config = {
        success : { bg: 'linear-gradient(135deg,#10B981,#059669)', icon: 'fa-circle-check',      border: '#34D399' },
        error   : { bg: 'linear-gradient(135deg,#EF4444,#DC2626)', icon: 'fa-circle-xmark',      border: '#F87171' },
        warning : { bg: 'linear-gradient(135deg,#F59E0B,#D97706)', icon: 'fa-triangle-exclamation', border: '#FCD34D' },
        info    : { bg: 'linear-gradient(135deg,#3B82F6,#2563EB)', icon: 'fa-circle-info',       border: '#93C5FD' }
    };
    const { bg, icon, border } = config[type] || config.success;
    const AUTO_DISMISS_MS = 4000;

    // Buat elemen toast
    const toast = document.createElement('div');
    toast.className = '_toast-item';
    toast.style.cssText = `background:${bg};color:#fff;border:1px solid ${border};pointer-events:auto;`;
    toast.style.setProperty('--_dur', `${AUTO_DISMISS_MS}ms`);
    toast.querySelector?.('::after')?.style.setProperty?.('animation-duration', `${AUTO_DISMISS_MS}ms`);
    toast.innerHTML = `
        <i class="fa-solid ${icon}" style="font-size:16px;margin-top:1px;flex-shrink:0;"></i>
        <span style="flex:1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:14px;padding:0;margin-top:1px;flex-shrink:0;" title="Tutup">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    // Atur durasi progress bar via animasi CSS
    const style = document.createElement('style');
    const uid = `_tp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    toast.id = uid;
    style.textContent = `#${uid}::after { animation-duration: ${AUTO_DISMISS_MS}ms; }`;
    document.head.appendChild(style);

    container.appendChild(toast);
    console.log(`[Toast ${type}]: ${message}`);

    // Auto-dismiss dengan animasi fade-out
    const dismiss = setTimeout(() => {
        toast.classList.add('_toast-fadeout');
        setTimeout(() => { toast.remove(); style.remove(); }, 350);
    }, AUTO_DISMISS_MS);

    // Klik untuk dismiss lebih cepat
    toast.addEventListener('click', () => {
        clearTimeout(dismiss);
        toast.classList.add('_toast-fadeout');
        setTimeout(() => { toast.remove(); style.remove(); }, 300);
    });
};

// === Global Confirm Modal System ===
window.showConfirmModal = function (title, message, confirmText, confirmClass, onConfirm, cancelText = 'Cancel') {
    let modal = document.getElementById('global-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'global-confirm-modal';
        modal.className = 'fixed inset-0 bg-gray-900/40 z-[110] flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300 px-6 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl transform scale-95 transition-transform duration-300 popup-content" id="g-confirm-box">
                <div class="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto" id="g-confirm-icon">
                    <i class="fa-solid fa-circle-question"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-900 text-center mb-2" id="g-confirm-title"></h3>
                <p class="text-gray-500 text-center text-sm mb-6" id="g-confirm-msg"></p>
                <div class="flex gap-3">
                    <button class="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors" id="g-confirm-cancel"></button>
                    <button class="flex-1 py-3.5 font-bold rounded-xl transition-colors text-white shadow-md focus:outline-none" id="g-confirm-btn"></button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('g-confirm-title').textContent = title;
    document.getElementById('g-confirm-msg').textContent = message;

    const iconContainer = document.getElementById('g-confirm-icon');
    const confirmBtn = document.getElementById('g-confirm-btn');
    const cancelBtn = document.getElementById('g-confirm-cancel');

    cancelBtn.textContent = cancelText;
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `flex-1 py-3.5 font-bold rounded-xl transition-colors text-white shadow-md focus:outline-none ${confirmClass}`;

    if (confirmClass.includes('red')) {
        iconContainer.className = 'w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl mb-4 mx-auto';
        iconContainer.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    } else {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const isDark = theme === 'dark';
        let bgCls = isDark ? 'bg-gray-800 text-[#34D399]' : 'bg-green-50 text-[#10B981]';
        if (theme === 'blue') bgCls = 'bg-blue-50 text-[#5BA4C9]';
        iconContainer.className = `w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto ${bgCls}`;
        iconContainer.innerHTML = '<i class="fa-solid fa-circle-question"></i>';

        if (!confirmClass.includes('bg-')) {
            confirmBtn.classList.add('theme-bg-update');
            confirmBtn.style.backgroundColor = theme === 'blue' ? '#5BA4C9' : '#10B981';
        }
    }

    modal.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('g-confirm-box').classList.remove('scale-95');
    document.getElementById('g-confirm-box').classList.add('scale-100');

    const close = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        document.getElementById('g-confirm-box').classList.remove('scale-100');
        document.getElementById('g-confirm-box').classList.add('scale-95');
    };

    cancelBtn.onclick = () => close();
    confirmBtn.onclick = () => {
        close();
        if (onConfirm) onConfirm();
    };
};

// Ensure initApp runs reliably whether script loads before or after DOM parse
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ================================================================
// AUTH LOGIC — Pure MySQL (Supabase telah dihapus)
// ================================================================

// Tidak ada lagi setupAuthListener() — auth state dikelola via localStorage

function handleRouteProtection() {
    const currentPath = window.location.pathname.toLowerCase();
    const isPublicRoute = currentPath.includes('login.html')
        || currentPath.includes('register.html')
        || currentPath.includes('intro.html')
        || currentPath.includes('reset-password.html');
    const isAdminRoute = currentPath.includes('admin_dashboard.html');
    const isIndexRoute = currentPath.endsWith('/') || currentPath.includes('index.html');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    // Parse MySQL session carefully (avoiding 'null' string bugs)
    let mysqlUser = null;
    try {
        const rawUser = localStorage.getItem('currentUser');
        if (rawUser && rawUser !== 'null' && rawUser !== 'undefined') {
            mysqlUser = JSON.parse(rawUser);
        }
    } catch (e) {
        console.error('Invalid user data in localStorage, clearing it.');
        localStorage.removeItem('currentUser');
    }

    const isLoggedIn = !!mysqlUser || isAdmin;

    // --- Task 3: Clear stale auth data when on login/intro ---
    if (isPublicRoute && !isLoggedIn) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAdmin');
    }

    // --- Task 1: Strict Auth Guard ---
    if (isAdminRoute) {
        if (!isAdmin) {
            window.location.replace('login.html');
            return;
        }
    } else if (!isLoggedIn && !isPublicRoute) {
        // If not logged in and trying to access a protected route (like index.html)
        const introSeen = localStorage.getItem('introSeen') === 'true';
        window.location.replace(introSeen ? 'login.html' : 'intro.html');
        return; // Stop execution here
    } else if (isLoggedIn && isPublicRoute && !isAdminRoute) {
        // Logged in but trying to access login/register
        window.location.replace(isAdmin ? 'admin_dashboard.html' : 'index.html');
        return; // Stop execution here
    }

    // --- Task 2: Hide Loading Spinner if Auth is Successful ---
    // At this point, the user is authorized to view the current page.
    // If we have an auth-guard-loader overlay, safely remove it to reveal the page.
    const authLoader = document.getElementById('auth-guard-loader');
    if (authLoader) {
        // Fade out
        authLoader.style.opacity = '0';
        setTimeout(() => {
            if (authLoader.parentNode) {
                authLoader.parentNode.removeChild(authLoader);
            }
        }, 300); // Wait for CSS transition (duration-300)
    }
}


async function handleEmailLogin(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    // === Rate Limit Check ===
    if (typeof loginRateLimiter !== 'undefined') {
        const lockStatus = loginRateLimiter.isLocked();
        if (lockStatus.isLocked) {
            const warningEl = document.getElementById('rate-limit-warning');
            if (warningEl) {
                loginRateLimiter.startCountdown(warningEl, () => {
                    btn.disabled = false;
                    btn.innerText = originalText;
                });
            }
            showToast('Account temporarily locked. Wait for countdown to finish.', 'error');
            return;
        }
    }

    const emailRaw = document.getElementById('email').value;
    const passwordRaw = document.getElementById('password').value;

    // === Input Sanitization ===
    if (typeof sanitizeInput === 'function') {
        const emailCheck = sanitizeInput(emailRaw, 'Email');
        if (!emailCheck.isSafe) {
            showToast('Invalid input: ' + emailCheck.threats.join(', '), 'error');
            return;
        }

        // Validate email format
        if (typeof isValidEmail === 'function' && !isValidEmail(emailRaw.trim())) {
            showToast('Invalid email format.', 'error');
            return;
        }

        // Check password for obvious injection attempts (but allow special chars for passwords)
        const pwdThreatCheck = detectThreats(passwordRaw);
        if (!pwdThreatCheck.isSafe) {
            showToast('Password input contains suspicious characters.', 'error');
            return;
        }
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;

    const email = emailRaw.trim();
    const password = passwordRaw;

    // === Admin Bypass (Hash-based) ===
    if (typeof verifyAdminCredentials === 'function') {
        const isAdmin = await verifyAdminCredentials(email, password);
        if (isAdmin) {
            localStorage.setItem('isAdmin', 'true');
            if (typeof loginRateLimiter !== 'undefined') loginRateLimiter.reset();
            showToast('Admin login successful!');
            setTimeout(() => window.location.href = 'admin_dashboard.html', 500);
            return;
        }
    }

    // === Login via Node.js + MySQL ===
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
            // Simpan data user ke localStorage
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            if (typeof loginRateLimiter !== 'undefined') loginRateLimiter.reset();
            showToast('Login berhasil! Selamat datang, ' + (result.user.username || result.user.email) + '!');
            setTimeout(() => window.location.href = 'index.html', 800);
        } else {
            // === Record failed attempt for rate limiting ===
            if (typeof loginRateLimiter !== 'undefined') {
                const rateLimitResult = loginRateLimiter.recordFailedAttempt();
                const warningEl = document.getElementById('rate-limit-warning');
                if (rateLimitResult.isLocked) {
                    showToast('Too many failed attempts. Account locked for 30 seconds.', 'error');
                    if (warningEl) {
                        loginRateLimiter.startCountdown(warningEl, () => {
                            btn.disabled = false;
                            btn.innerText = originalText;
                        });
                    }
                } else {
                    const warningMsg = loginRateLimiter.getWarningMessage();
                    showToast('Login gagal: ' + result.message + (warningMsg ? '\n' + warningMsg : ''), 'error');
                }
            } else {
                showToast('Login gagal: ' + result.message, 'error');
            }
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (networkError) {
        showToast('Tidak dapat terhubung ke server. Pastikan server berjalan.', 'error');
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleEmailRegister(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    const usernameRaw = document.getElementById('username').value;
    const nameRaw     = document.getElementById('name') ? document.getElementById('name').value : usernameRaw;
    const emailRaw    = document.getElementById('email').value;
    const passwordRaw = document.getElementById('password').value;
    const confirmPasswordEl  = document.getElementById('confirm-password');
    const confirmPasswordRaw = confirmPasswordEl ? confirmPasswordEl.value : passwordRaw;

    // === Input Sanitization ===
    if (typeof sanitizeInput === 'function') {
        const usernameCheck = sanitizeInput(usernameRaw, 'Username');
        const nameCheck     = sanitizeInput(nameRaw, 'Nama');
        const emailCheck    = sanitizeInput(emailRaw, 'Email');
        const allThreats    = [...usernameCheck.threats, ...nameCheck.threats, ...emailCheck.threats];
        if (allThreats.length > 0) {
            showToast('Invalid input: ' + allThreats.join(', '), 'error');
            return;
        }
        if (typeof isValidEmail === 'function' && !isValidEmail(emailRaw.trim())) {
            showToast('Invalid email format.', 'error');
            return;
        }
    }

    // === Password Strength ===
    if (typeof validatePassword === 'function') {
        const pwdResult = validatePassword(passwordRaw);
        if (!pwdResult.isValid) {
            showToast('Password tidak memenuhi syarat:\n• ' + pwdResult.errors.join('\n• '), 'error');
            return;
        }
    }

    if (passwordRaw !== confirmPasswordRaw) {
        showToast('Password dan konfirmasi password tidak cocok!', 'error');
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    btn.disabled  = true;

    try {
        // === Register via MySQL Backend ===
        const response = await fetch('/api/register', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
                username: usernameRaw.trim(),
                fullName: nameRaw.trim(),
                email   : emailRaw.trim(),
                password: passwordRaw
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Akun berhasil dibuat! Silakan login.');
            setTimeout(() => window.location.href = 'login.html', 1000);
        } else {
            showToast(result.message || 'Registrasi gagal.', 'error');
            btn.innerText = originalText;
            btn.disabled  = false;
        }
    } catch (networkErr) {
        showToast('Tidak dapat terhubung ke server. Pastikan server backend berjalan.', 'error');
        btn.innerText = originalText;
        btn.disabled  = false;
    }
}

// Google OAuth removed — currently disabled in the UI

async function handleSignOut() {
    showConfirmModal(
        'Log Out',
        'Are you sure you want to log out of your account?',
        'Log Out',
        'bg-red-500 hover:bg-red-600',
        () => {
            try {
                document.body.style.opacity = '0';
                document.body.style.transition = 'opacity 0.5s ease';
                // Hapus semua session data dari localStorage
                localStorage.removeItem('isAdmin');
                localStorage.removeItem('currentUser');
                // Tidak perlu call Supabase signOut lagi
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                document.body.style.opacity = '1';
                showToast('Gagal logout. Coba lagi.', 'error');
            }
        }
    );
}

// Dynamic Date rendering for horizontal scroll
function renderDynamicDateSlider() {
    const monthContainer = document.getElementById('mobile-month-selector');
    const dateContainer = document.getElementById('mobile-date-selector');

    if (!monthContainer || !dateContainer) return;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDate = today.getDate();

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Render Months
    let monthHtml = '';
    months.forEach((m, i) => {
        if (i === currentMonth) {
            monthHtml += `<button class="shrink-0 text-sm font-medium text-white bg-[var(--primary)] px-4 py-1.5 rounded-full whitespace-nowrap shadow-md focus:outline-none theme-bg-update" id="active-month-btn">${m}</button>`;
        } else {
            monthHtml += `<button class="shrink-0 text-sm font-medium text-gray-500 whitespace-nowrap focus:outline-none" onclick="changeSliderMonth(${i})">${m}</button>`;
        }
    });
    monthContainer.innerHTML = monthHtml;

    // Smooth scroll month container to active month
    setTimeout(() => {
        const activeMonthBtn = document.getElementById('active-month-btn');
        if (activeMonthBtn) {
            monthContainer.scrollTo({
                left: activeMonthBtn.offsetLeft - 24,
                behavior: 'smooth'
            });
        }
    }, 50);

    // Render Dates for current month
    renderDatesForMonth(currentYear, currentMonth, currentDate, true);

    // Listen for theme change to update the dynamic element colors
    document.addEventListener('themeChanged', (e) => {
        const currentTheme = e.detail.theme || document.documentElement.getAttribute('data-theme') || 'light';
        const pColor = currentTheme === 'blue' ? '#5BA4C9' : '#10B981';
        document.querySelectorAll('.theme-bg-update').forEach(el => {
            if (el.classList.contains('active')) {
                el.style.backgroundColor = pColor;
            }
        });
        const activeMonth = document.getElementById('active-month-btn');
        if (activeMonth) {
            activeMonth.style.backgroundColor = pColor;
        }
    });
}

function renderDatesForMonth(year, monthIndex, activeDateToSet = null, scroll = false) {
    const dateContainer = document.getElementById('mobile-date-selector');
    const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    let dateHtml = '';
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';

    let activeId = '';

    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, monthIndex, i);
        const dayName = days[d.getDay()];
        // FIX: jangan pakai d.toISOString().slice(0,10) — toISOString() mengonversi
        // ke UTC, sehingga untuk timezone UTC+ (mis. WIB/WITA/WIT) tanggalnya bisa
        // mundur satu hari (contoh: 4 Juli 00:00 WIB = 3 Juli 17:00 UTC).
        // getLocalDateString() (dari habits.js) mengambil tanggal dari waktu lokal,
        // bukan UTC, jadi hasilnya konsisten dengan tanggal yang tertulis di kartu.
        const dateStr = getLocalDateString(d);

        let isActive = '';
        let style = '';

        // Either set the specific active date, or default to the 1st if switching months
        if ((activeDateToSet && i === activeDateToSet) || (!activeDateToSet && i === 1)) {
            isActive = 'active theme-bg-update shadow-md text-white';
            style = `background-color: ${primaryColor}; transform: translateY(-2px);`;
            activeId = `slider-date-${i}`;
        } else {
            isActive = 'bg-white shadow-sm';
            style = `background-color: var(--card-bg);`;
        }

        dateHtml += `
            <button id="slider-date-${i}" class="date-card ${isActive} min-w-[60px] h-[75px] rounded-2xl flex flex-col items-center justify-center shrink-0 focus:outline-none" style="${style}" data-date="${dateStr}" onclick="selectSliderDate(this, ${i})">
                <span class="text-xl font-bold">${i}</span>
                <span class="text-xs font-medium mt-1">${dayName}</span>
            </button>
        `;
    }

    dateContainer.innerHTML = dateHtml;

    // Add ripple effect to new buttons
    const newCards = dateContainer.querySelectorAll('.date-card');
    newCards.forEach(btn => {
        if (getComputedStyle(btn).position === 'static') {
            btn.style.position = 'relative';
        }
        btn.style.overflow = 'visible';
        btn.addEventListener('mousedown', createRipple);
        btn.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                e.clientX = touch.clientX;
                e.clientY = touch.clientY;
                createRipple(e);
            }
        }, { passive: true });
    });

    if (scroll && activeId) {
        setTimeout(() => {
            const activeEl = document.getElementById(activeId);
            if (activeEl) {
                dateContainer.scrollTo({
                    left: activeEl.offsetLeft - 24,
                    behavior: 'smooth'
                });
            }
        }, 50);
    }
}

function changeSliderMonth(monthIndex) {
    const today = new Date();
    // Assuming current year for simplicity
    const currentYear = today.getFullYear();

    // If selecting current month, auto-select today, otherwise 1st
    const dateToSelect = (monthIndex === today.getMonth()) ? today.getDate() : 1;

    renderDatesForMonth(currentYear, monthIndex, dateToSelect, true);

    // Easy way to rebuild month slider
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthContainer = document.getElementById('mobile-month-selector');
    let monthHtml = '';
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';

    months.forEach((m, i) => {
        if (i === monthIndex) {
            monthHtml += `<button class="shrink-0 text-sm font-medium text-white px-4 py-1.5 rounded-full whitespace-nowrap shadow-md focus:outline-none theme-bg-update" id="active-month-btn" style="background-color: ${primaryColor}">${m}</button>`;
        } else {
            monthHtml += `<button class="shrink-0 text-sm font-medium text-gray-500 whitespace-nowrap focus:outline-none" onclick="changeSliderMonth(${i})">${m}</button>`;
        }
    });
    monthContainer.innerHTML = monthHtml;

    setTimeout(() => {
        const activeMonthBtn = document.getElementById('active-month-btn');
        if (activeMonthBtn) {
            monthContainer.scrollTo({
                left: activeMonthBtn.offsetLeft - 24,
                behavior: 'smooth'
            });
        }
    }, 50);

    // Let the current page know the month slider rebuilt the dates
    document.dispatchEvent(new CustomEvent('monthChanged'));
}

function selectSliderDate(el, dateNum) {
    const container = document.getElementById('mobile-date-selector');
    const cards = container.querySelectorAll('.date-card');

    // Reset all
    cards.forEach(card => {
        card.classList.remove('active', 'theme-bg-update', 'shadow-md', 'text-white');
        card.classList.add('bg-white', 'shadow-sm');
        card.style.backgroundColor = 'var(--card-bg)';
        card.style.transform = 'none';
        card.style.color = 'var(--text-main)';
    });

    // Set active
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';

    el.classList.add('active', 'theme-bg-update', 'shadow-md', 'text-white');
    el.classList.remove('bg-white', 'shadow-sm');
    el.style.backgroundColor = primaryColor;
    el.style.transform = 'translateY(-2px)';
    el.style.color = 'white';
}

function openAddModal() {
    window.location.href = 'add_habit.html';
}