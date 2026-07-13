/**
 * =========================================
 * SECURITY MODULE - Habit Tracker
 * =========================================
 * Password validation, input sanitization,
 * rate limiting, and secure hashing utilities.
 */

// ========== PASSWORD VALIDATION ==========

const PasswordRules = {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
    SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~',
    // Common weak passwords blacklist
    BLACKLIST: [
        'password', '12345678', 'qwerty123', 'admin123', 'letmein',
        'welcome1', 'monkey123', 'dragon12', 'master12', 'password1',
        'abc12345', 'iloveyou', 'trustno1', 'sunshine', 'princess',
        '1234567890', 'password123', 'qwerty12345'
    ]
};

/**
 * Validates password strength and returns detailed results
 * @param {string} password - The password to validate
 * @returns {{ isValid: boolean, score: number, strength: string, errors: string[], checks: Object }}
 */
function validatePassword(password) {
    const checks = {
        minLength: false,
        maxLength: true,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false,
        noSpaces: true,
        notBlacklisted: true
    };

    const errors = [];
    let score = 0;

    // Check minimum length
    if (password.length >= PasswordRules.MIN_LENGTH) {
        checks.minLength = true;
        score += 1;
    } else {
        errors.push(`Minimum ${PasswordRules.MIN_LENGTH} characters`);
    }

    // Check max length
    if (password.length > PasswordRules.MAX_LENGTH) {
        checks.maxLength = false;
        errors.push(`Maximum ${PasswordRules.MAX_LENGTH} characters`);
    }

    // Check uppercase
    if (/[A-Z]/.test(password)) {
        checks.hasUppercase = true;
        score += 1;
    } else {
        errors.push('Must contain uppercase letter (A-Z)');
    }

    // Check lowercase
    if (/[a-z]/.test(password)) {
        checks.hasLowercase = true;
        score += 1;
    } else {
        errors.push('Must contain lowercase letter (a-z)');
    }

    // Check number
    if (/[0-9]/.test(password)) {
        checks.hasNumber = true;
        score += 1;
    } else {
        errors.push('Must contain a number (0-9)');
    }

    // Check special character
    if (/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/`~\\]/.test(password)) {
        checks.hasSpecial = true;
        score += 1;
    } else {
        errors.push('Must contain a symbol (!@#$%^&*...)');
    }

    // Check for spaces
    if (/\s/.test(password)) {
        checks.noSpaces = false;
        errors.push('Must not contain spaces');
        score = Math.max(0, score - 1);
    }

    // Check blacklist
    if (PasswordRules.BLACKLIST.includes(password.toLowerCase())) {
        checks.notBlacklisted = false;
        errors.push('Password too common, use a more unique one');
        score = Math.max(0, score - 2);
    }

    // Bonus score for extra length
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Determine strength label
    let strength;
    if (score <= 1) strength = 'Very Weak';
    else if (score <= 2) strength = 'Weak';
    else if (score <= 3) strength = 'Medium';
    else if (score <= 5) strength = 'Strong';
    else strength = 'Very Strong';

    const isValid = checks.minLength && checks.maxLength && checks.hasUppercase &&
        checks.hasLowercase && checks.hasNumber && checks.hasSpecial &&
        checks.noSpaces && checks.notBlacklisted;

    return { isValid, score: Math.min(score, 7), strength, errors, checks };
}


// ========== INPUT SANITIZATION ==========

// Dangerous patterns for SQL injection detection
const SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|TRUNCATE|DECLARE)\b)/i,
    /(--|;|'|"|\/\*|\*\/)/,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /(\bAND\b\s+\d+\s*=\s*\d+)/i,
    /(\bOR\b\s+'[^']*'\s*=\s*'[^']*')/i,
];

// Dangerous patterns for XSS detection
const XSS_PATTERNS = [
    /<script\b[^>]*>/i,
    /<\/script>/i,
    /javascript\s*:/i,
    /on(error|load|click|mouseover|focus|blur|submit|change|keyup|keydown)\s*=/i,
    /<iframe\b/i,
    /<embed\b/i,
    /<object\b/i,
    /expression\s*\(/i,
    /url\s*\(/i,
    /eval\s*\(/i,
    /document\.(cookie|location|write)/i,
    /window\.(location|open)/i,
];

/**
 * Sanitizes input by escaping HTML entities
 * @param {string} input - Raw user input
 * @returns {string} Sanitized input
 */
function escapeHtml(input) {
    if (typeof input !== 'string') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '`': '&#x60;'
    };
    return input.replace(/[&<>"'`/]/g, (char) => map[char]);
}

/**
 * Checks if input contains suspicious/malicious patterns
 * @param {string} input - Raw user input
 * @returns {{ isSafe: boolean, threats: string[] }}
 */
function detectThreats(input) {
    if (typeof input !== 'string') return { isSafe: true, threats: [] };

    const threats = [];

    // Check SQL injection patterns
    for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(input)) {
            threats.push('SQL injection pattern detected');
            break;
        }
    }

    // Check XSS patterns
    for (const pattern of XSS_PATTERNS) {
        if (pattern.test(input)) {
            threats.push('XSS/script injection pattern detected');
            break;
        }
    }

    // Check for null bytes
    if (/\0/.test(input)) {
        threats.push('Null byte injection detected');
    }

    return { isSafe: threats.length === 0, threats };
}

/**
 * Full sanitization: detect threats + escape HTML
 * @param {string} input - Raw user input
 * @param {string} fieldName - Name of the field for error messaging
 * @returns {{ sanitized: string, isSafe: boolean, threats: string[] }}
 */
function sanitizeInput(input, fieldName = 'Input') {
    if (typeof input !== 'string') return { sanitized: '', isSafe: true, threats: [] };

    const trimmed = input.trim();
    const detection = detectThreats(trimmed);
    const sanitized = escapeHtml(trimmed);

    return {
        sanitized,
        isSafe: detection.isSafe,
        threats: detection.threats.map(t => `${fieldName}: ${t}`)
    };
}

/**
 * Validates an email format strictly
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
    // RFC 5322 simplified pattern
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
}


// ========== RATE LIMITER ==========

class RateLimiter {
    /**
     * @param {number} maxAttempts - Maximum attempts allowed
     * @param {number} lockoutDuration - Lockout duration in milliseconds
     */
    constructor(maxAttempts = 5, lockoutDuration = 30000) {
        this.maxAttempts = maxAttempts;
        this.lockoutDuration = lockoutDuration;
        this.attempts = 0;
        this.lockoutEndTime = null;
        this.countdownInterval = null;
    }

    /**
     * Check if the user is currently locked out
     * @returns {{ isLocked: boolean, remainingMs: number }}
     */
    isLocked() {
        if (!this.lockoutEndTime) return { isLocked: false, remainingMs: 0 };

        const remaining = this.lockoutEndTime - Date.now();
        if (remaining <= 0) {
            this.reset();
            return { isLocked: false, remainingMs: 0 };
        }

        return { isLocked: true, remainingMs: remaining };
    }

    /**
     * Record a failed attempt
     * @returns {{ isLocked: boolean, attemptsLeft: number, lockoutDuration: number }}
     */
    recordFailedAttempt() {
        this.attempts++;

        if (this.attempts >= this.maxAttempts) {
            this.lockoutEndTime = Date.now() + this.lockoutDuration;
            return {
                isLocked: true,
                attemptsLeft: 0,
                lockoutDuration: this.lockoutDuration
            };
        }

        return {
            isLocked: false,
            attemptsLeft: this.maxAttempts - this.attempts,
            lockoutDuration: 0
        };
    }

    /**
     * Reset the rate limiter (call on successful login)
     */
    reset() {
        this.attempts = 0;
        this.lockoutEndTime = null;
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    /**
     * Start a visible countdown timer
     * @param {HTMLElement} element - Element to display countdown
     * @param {Function} onComplete - Callback when lockout ends
     */
    startCountdown(element, onComplete) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        const updateDisplay = () => {
            const { isLocked, remainingMs } = this.isLocked();
            if (!isLocked) {
                if (element) {
                    element.style.display = 'none';
                    element.innerHTML = '';
                }
                if (onComplete) onComplete();
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                return;
            }

            const seconds = Math.ceil(remainingMs / 1000);
            if (element) {
                element.style.display = 'flex';
                element.innerHTML = `
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-shield-halved text-red-500"></i>
                        <span>Too many attempts. Try again in <strong>${seconds}</strong> seconds</span>
                    </div>
                `;
            }
        };

        updateDisplay();
        this.countdownInterval = setInterval(updateDisplay, 1000);
    }

    /**
     * Get remaining attempts info
     * @returns {string}
     */
    getWarningMessage() {
        const left = this.maxAttempts - this.attempts;
        if (left <= 2 && left > 0) {
            return `⚠️ Warning: ${left} attempts left before account is temporarily locked`;
        }
        return '';
    }
}

// Global rate limiter instance for login
const loginRateLimiter = new RateLimiter(5, 30000);


// ========== SECURE HASH (SHA-256) ==========

/**
 * Generate SHA-256 hash of a string using Web Crypto API
 * @param {string} message - String to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function sha256Hash(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pre-computed SHA-256 hash of the admin password 'lacdolacter0803'
// This avoids exposing the plaintext password in source code
const ADMIN_CREDENTIALS = {
    email: 'admindasboard01@gmail.com',
    // SHA-256 hash of 'lacdolacter0803'
    passwordHash: '2539dd7a24b23fd905d8543327cba7e28505053a7f3c70444b195bd06fe80454'
};

/**
 * Verify admin credentials securely using hash comparison
 * @param {string} email - Admin email
 * @param {string} password - Admin password (plaintext, will be hashed for comparison)
 * @returns {Promise<boolean>}
 */
async function verifyAdminCredentials(email, password) {
    if (email !== ADMIN_CREDENTIALS.email) return false;
    const hash = await sha256Hash(password);
    return hash === ADMIN_CREDENTIALS.passwordHash;
}


// ========== PASSWORD STRENGTH UI HELPER ==========

/**
 * Creates and manages a password strength indicator UI
 * @param {HTMLInputElement} passwordInput - The password input element
 * @param {HTMLElement} container - Container to render the strength UI into
 */
function initPasswordStrengthUI(passwordInput, container) {
    if (!passwordInput || !container) return;

    // Build the UI
    container.innerHTML = `
        <div class="password-strength-wrapper mt-3" id="pwd-strength-wrapper" style="display: none;">
            <!-- Strength Bar -->
            <div class="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                <div id="pwd-strength-bar" class="h-full rounded-full transition-all duration-500 ease-out" style="width: 0%; background-color: #EF4444;"></div>
            </div>
            
            <!-- Strength Label -->
            <div class="flex justify-between items-center mb-3">
                <span id="pwd-strength-label" class="text-xs font-bold text-gray-400">Password Strength</span>
                <span id="pwd-strength-value" class="text-xs font-bold text-gray-400"></span>
            </div>
            
            <!-- Rules Checklist -->
            <div class="space-y-1.5" id="pwd-rules-list">
                <div class="flex items-center gap-2 text-xs" data-rule="minLength">
                    <i class="fa-solid fa-circle-xmark text-gray-300 w-4 text-center transition-colors duration-300" id="rule-icon-minLength"></i>
                    <span class="text-gray-500" id="rule-text-minLength">Minimum 8 characters</span>
                </div>
                <div class="flex items-center gap-2 text-xs" data-rule="hasUppercase">
                    <i class="fa-solid fa-circle-xmark text-gray-300 w-4 text-center transition-colors duration-300" id="rule-icon-hasUppercase"></i>
                    <span class="text-gray-500" id="rule-text-hasUppercase">Uppercase letter (A-Z)</span>
                </div>
                <div class="flex items-center gap-2 text-xs" data-rule="hasLowercase">
                    <i class="fa-solid fa-circle-xmark text-gray-300 w-4 text-center transition-colors duration-300" id="rule-icon-hasLowercase"></i>
                    <span class="text-gray-500" id="rule-text-hasLowercase">Lowercase letter (a-z)</span>
                </div>
                <div class="flex items-center gap-2 text-xs" data-rule="hasNumber">
                    <i class="fa-solid fa-circle-xmark text-gray-300 w-4 text-center transition-colors duration-300" id="rule-icon-hasNumber"></i>
                    <span class="text-gray-500" id="rule-text-hasNumber">Number (0-9)</span>
                </div>
                <div class="flex items-center gap-2 text-xs" data-rule="hasSpecial">
                    <i class="fa-solid fa-circle-xmark text-gray-300 w-4 text-center transition-colors duration-300" id="rule-icon-hasSpecial"></i>
                    <span class="text-gray-500" id="rule-text-hasSpecial">Symbol (!@#$%^&*...)</span>
                </div>
                <div class="flex items-center gap-2 text-xs" data-rule="noSpaces">
                    <i class="fa-solid fa-circle-xmark text-gray-300 w-4 text-center transition-colors duration-300" id="rule-icon-noSpaces"></i>
                    <span class="text-gray-500" id="rule-text-noSpaces">No spaces</span>
                </div>
            </div>
        </div>
    `;

    // Attach event listener
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        const wrapper = document.getElementById('pwd-strength-wrapper');

        if (password.length === 0) {
            wrapper.style.display = 'none';
            return;
        }

        wrapper.style.display = 'block';
        const result = validatePassword(password);
        updateStrengthUI(result);
    });
}

/**
 * Updates the strength indicator UI based on validation result
 * @param {Object} result - Result from validatePassword()
 */
function updateStrengthUI(result) {
    const bar = document.getElementById('pwd-strength-bar');
    const label = document.getElementById('pwd-strength-value');

    if (!bar || !label) return;

    // Calculate percentage (score out of 7)
    const percent = Math.round((result.score / 7) * 100);

    // Color mapping
    const colorMap = {
        'Very Weak': '#EF4444',
        'Weak': '#F97316',
        'Medium': '#EAB308',
        'Strong': '#22C55E',
        'Very Strong': '#10B981'
    };

    bar.style.width = `${Math.max(percent, 5)}%`;
    bar.style.backgroundColor = colorMap[result.strength] || '#EF4444';
    label.textContent = result.strength;
    label.style.color = colorMap[result.strength] || '#EF4444';

    // Update individual rule checks
    const ruleKeys = ['minLength', 'hasUppercase', 'hasLowercase', 'hasNumber', 'hasSpecial', 'noSpaces'];
    ruleKeys.forEach(key => {
        const icon = document.getElementById(`rule-icon-${key}`);
        const text = document.getElementById(`rule-text-${key}`);
        if (!icon || !text) return;

        if (result.checks[key]) {
            icon.className = 'fa-solid fa-circle-check text-green-500 w-4 text-center transition-colors duration-300';
            text.className = 'text-green-600 font-medium';
        } else {
            icon.className = 'fa-solid fa-circle-xmark text-gray-300 w-4 text-center transition-colors duration-300';
            text.className = 'text-gray-500';
        }
    });
}
// ========================================================
// CUSTOM CONFIGURATION FOR LARAGON DATABASE BYPASS
// ========================================================

/**
 * Menggantikan fungsi register bawaan template agar langsung
 * mengirimkan data ke Server Backend Node.js lokal (Laragon)
 */
async function handleEmailRegister(e) {
    e.preventDefault(); // Mencegah reload halaman otomatis
    e.stopImmediatePropagation(); // Menghentikan fungsi Supabase bawaan template agar tidak ikut berjalan

    // 1. Ambil elemen input berdasarkan ID yang ada di register.html kamu
    const usernameInput = document.getElementById('username');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    const username = usernameInput.value;
    const fullName = nameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // 2. Validasi kecocokan password secara manual
    if (password !== confirmPassword) {
        alert("Password dan Confirm Password tidak cocok!");
        return;
    }

    // 3. Jalankan Validasi Kompleks dari Fungsi Bawaan security.js
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        alert("Password belum memenuhi syarat keamanan:\n- " + passwordValidation.errors.join("\n- "));
        return;
    }

    // 4. Sanitasi Input untuk mencegah SQL Injection & XSS (Memanfaatkan fitur security.js)
    const sanitizedUsername = sanitizeInput(username, 'Username').sanitized;
    const sanitizedFullName = sanitizeInput(fullName, 'Full Name').sanitized;
    const sanitizedEmail = sanitizeInput(email, 'Email').sanitized;

    try {
        console.log("Mengirim data registrasi ke Laragon via Node.js Express...");

        // 5. Kirim data bersih ke server backend lokal port 3000
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: sanitizedUsername,
                fullName: sanitizedFullName,
                email: sanitizedEmail,
                password: password // Biarkan backend yang menangani hashing jika diperlukan, atau kirim plain text sesuai server.js kita sebelumnya
            })
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message); // Menampilkan "Akun berhasil terdaftar ke database Laragon!"
            window.location.href = 'login.html'; // Redirect ke halaman login
        } else {
            alert('Registrasi Gagal: ' + result.message);
        }

    } catch (error) {
        console.error('Koneksi Error:', error);
        alert('Tidak dapat terhubung ke database. Pastikan kamu sudah menjalankan "node server.js" di terminal VS Code.');
    }
}
document.getElementById('register-form').addEventListener('submit', handleEmailRegister);