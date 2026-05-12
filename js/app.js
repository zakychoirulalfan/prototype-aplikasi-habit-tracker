// Set up Supabase Client
if (typeof SUPABASE_URL === 'undefined') {
    window.SUPABASE_URL = 'https://fjbiwrdurcburbaognan.supabase.co';
}
if (typeof SUPABASE_ANON_KEY === 'undefined') {
    window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYml3cmR1cmNidXJiYW9nbmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTQxMjEsImV4cCI6MjA5NDE3MDEyMX0.0-X3hAXeyU12eLambrS-pM9MGNbUKoNcINFlANDoKBA';
}

// Ensure Supabase JS CDN is loaded in HTML before app.js
if (typeof supabaseClient === 'undefined') {
    window.supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
}


// Initialize theme
function initTheme() {
    // Default to green if not set
    const savedTheme = localStorage.getItem('theme') || 'green';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Setup background gradient immediately
    setupBackgroundGradient(savedTheme);

    // Dispatch event for other scripts
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: savedTheme } }));
}

// Global dynamic background gradient setup setup
function setupBackgroundGradient(theme) {
    let container = document.querySelector('main.flex-1.overflow-y-auto') || document.querySelector('main');
    if (!container) {
        container = document.body;
        // make sure body is relative so absolute positioning works if it's the scroll container
        if(getComputedStyle(container).position === 'static') {
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
         if (theme === 'blue') {
             bgGradient.style.background = 'linear-gradient(180deg, #4480ba 0%, #acc9e6 50%, rgba(255,255,255,0) 100%)'; 
         } else {
             bgGradient.style.background = 'linear-gradient(180deg, #10B981 0%, #6ee7b7 50%, rgba(255,255,255,0) 100%)';
         }
    }
}

// Toggle theme between green and blue
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'green';
    const newTheme = currentTheme === 'green' ? 'blue' : 'green';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateGradientColor(newTheme);
    
    // Dispatch event
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
    initHeroSlider();
    
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
            if(e.touches.length > 0) {
                // Mock a click event for the ripple
                const touch = e.touches[0];
                e.clientX = touch.clientX;
                e.clientY = touch.clientY;
                createRipple(e);
            }
        }, {passive: true});
    });
    
    // Setup check buttons
    const checkBtns = document.querySelectorAll('.check-btn');
    checkBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent ripple from firing twice if parent has it
            toggleHabit(btn);
        });
    });
    
    // Setup Supabase Auth Listener
    if (supabaseClient) {
        setupAuthListener();
    }
}

function initHeroSlider() {
    const track = document.getElementById('hero-slider-track');
    const dotsContainer = document.getElementById('hero-slider-dots');
    
    if (!track || !dotsContainer) return;
    
    const dots = Array.from(dotsContainer.querySelectorAll('button'));
    
    const updateDots = () => {
        const scrollLeft = track.scrollLeft;
        const width = track.clientWidth;
        // Prevent div by zero if width is 0
        if (width === 0) return;
        
        const currentSlideIndex = Math.round(scrollLeft / width);
        
        const theme = document.documentElement.getAttribute('data-theme') || 'green';
        const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';
        
        dots.forEach((dot, index) => {
            if (index === currentSlideIndex) {
                 dot.style.opacity = '1';
                 dot.style.width = '1.25rem'; // w-5
                 dot.style.backgroundColor = primaryColor;
                 dot.classList.add('dot-active');
            } else {
                 dot.style.opacity = '0.5';
                 dot.style.width = '0.5rem'; // w-2
                 dot.style.backgroundColor = 'white';
                 dot.classList.remove('dot-active');
            }
        });
    };

    track.addEventListener('scroll', updateDots);

    // Initial setting of dots based on the theme
    updateDots();
    
    // Add click event to dots to navigate to the specific slide
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            const width = track.clientWidth;
            track.scrollTo({
                left: index * width,
                behavior: 'smooth'
            });
        });
    });

    // Update dots colors when theme changes
    document.addEventListener('themeChanged', (e) => {
        const theme = e.detail.theme;
        const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';
        const activeDot = dotsContainer.querySelector('.dot-active');
        if (activeDot) {
            activeDot.style.backgroundColor = primaryColor;
        }
    });
}

// Ensure initApp runs reliably whether script loads before or after DOM parse
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// --- Supabase Authentication Logic --- //

async function setupAuthListener() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    handleRouteProtection(session);

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            console.log('User signed in');
            handleRouteProtection(session);
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            handleRouteProtection(null);
        }
    });
}

function handleRouteProtection(session) {
    const currentPath = window.location.pathname.toLowerCase();
    const isPublicRoute = currentPath.includes('login') 
        || currentPath.includes('register')
        || currentPath.includes('forgot_password')
        || currentPath.includes('reset_password')
        || currentPath.includes('password_reset');
    
    if (!session && !isPublicRoute) {
        // Not logged in and on protected page -> redirect to login
        window.location.href = 'login.html';
    } else if (session && isPublicRoute) {
        // Logged in but on login/register page -> redirect to index
        // Don't redirect if user is on password reset page (they may be resetting password)
        if (currentPath.includes('reset_password') || currentPath.includes('password_reset')) {
            return;
        }
        window.location.href = 'index.html';
    }
}

async function handleEmailLogin(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert("Login failed: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleEmailRegister(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;

    const username = document.getElementById('username').value;
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: name,
                username: username
            }
        }
    });

    if (error) {
        alert("Registration failed: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    } else {
        // Save profile data (username, email, password_hash) to profiles table
        if (data.user) {
            try {
                await supabaseClient
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        full_name: name,
                        username: username,
                        email: email,
                        password_hash: btoa(password) // base64 encoded for storage
                    }, { onConflict: 'id' });
            } catch (profileErr) {
                console.error('Profile save error:', profileErr);
            }
        }
        alert('Account created! Please check your email to confirm your registration.');
        btn.innerText = originalText;
        btn.disabled = false;
        window.location.href = 'login.html';
    }
}

async function handleGoogleAuth() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // redirect to dashboard after google auth
            redirectTo: window.location.origin + '/views/index.html'
        }
    });
    
    if (error) {
        alert("Google Auth Error: " + error.message);
    }
}

async function handleSignOut() {
    if(confirm("Are you sure you want to log out?")) {
        try {
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.5s ease';
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            document.body.style.opacity = '1';
        }
    }
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
            monthHtml += `<button class="text-sm font-medium text-white bg-[var(--primary)] px-4 py-1.5 rounded-full whitespace-nowrap shadow-md focus:outline-none theme-bg-update" id="active-month-btn">${m}</button>`;
        } else {
            monthHtml += `<button class="text-sm font-medium text-gray-500 whitespace-nowrap focus:outline-none" onclick="changeSliderMonth(${i})">${m}</button>`;
        }
    });
    monthContainer.innerHTML = monthHtml;
    
    // Scroll month container to active month
    setTimeout(() => {
        const activeMonthBtn = document.getElementById('active-month-btn');
        if (activeMonthBtn) {
            monthContainer.scrollLeft = activeMonthBtn.offsetLeft - 24;
        }
    }, 50);

    // Render Dates for current month
    renderDatesForMonth(currentYear, currentMonth, currentDate, true);
    
    // Listen for theme change to update the dynamic element colors
    document.addEventListener('themeChanged', (e) => {
        document.querySelectorAll('.theme-bg-update').forEach(el => {
            if(el.classList.contains('active')) {
                el.style.backgroundColor = e.detail.theme === 'blue' ? '#5BA4C9' : '#10B981';
            }
        });
        const activeMonth = document.getElementById('active-month-btn');
        if (activeMonth) {
            activeMonth.style.backgroundColor = e.detail.theme === 'blue' ? '#5BA4C9' : '#10B981';
        }
    });
}

function renderDatesForMonth(year, monthIndex, activeDateToSet = null, scroll = false) {
    const dateContainer = document.getElementById('mobile-date-selector');
    const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    let dateHtml = '';
    const theme = document.documentElement.getAttribute('data-theme') || 'green';
    const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';
    
    let activeId = '';
    
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, monthIndex, i);
        const dayName = days[d.getDay()];
        const dateStr = d.toISOString().slice(0, 10);
        
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
            if(e.touches.length > 0) {
                const touch = e.touches[0];
                e.clientX = touch.clientX;
                e.clientY = touch.clientY;
                createRipple(e);
            }
        }, {passive: true});
    });
    
    if (scroll && activeId) {
        setTimeout(() => {
            const activeEl = document.getElementById(activeId);
            if(activeEl) {
                dateContainer.scrollLeft = activeEl.offsetLeft - 24;
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
    const theme = document.documentElement.getAttribute('data-theme') || 'green';
    const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';
    
    months.forEach((m, i) => {
        if (i === monthIndex) {
            monthHtml += `<button class="text-sm font-medium text-white px-4 py-1.5 rounded-full whitespace-nowrap shadow-md focus:outline-none theme-bg-update" id="active-month-btn" style="background-color: ${primaryColor}">${m}</button>`;
        } else {
            monthHtml += `<button class="text-sm font-medium text-gray-500 whitespace-nowrap focus:outline-none" onclick="changeSliderMonth(${i})">${m}</button>`;
        }
    });
    monthContainer.innerHTML = monthHtml;
    
    setTimeout(() => {
        const activeMonthBtn = document.getElementById('active-month-btn');
        if (activeMonthBtn) monthContainer.scrollLeft = activeMonthBtn.offsetLeft - 24;
    }, 50);
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
    const theme = document.documentElement.getAttribute('data-theme') || 'green';
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

/**
 * Check if an email has exceeded the rate limit for forgot password requests.
 * Limit: 3 requests per hour.
 * @param {string} email 
 * @returns {Object} { allowed: boolean, message: string, retryAfter: number }
 */
function checkEmailRateLimit(email) {
    const LIMIT = 3;
    const WINDOW_MS = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    
    // Get stored data
    let rateData = {};
    try {
        rateData = JSON.parse(localStorage.getItem('email_rate_limits') || '{}');
    } catch (e) {
        console.error('Error parsing rate limit data', e);
    }
    
    // Clean up old entries
    const cleanedData = {};
    for (const key in rateData) {
        if (now - rateData[key].lastReset < WINDOW_MS) {
            cleanedData[key] = rateData[key];
        }
    }
    
    let userLimit = cleanedData[email];
    
    if (!userLimit) {
        return { allowed: true };
    }
    
    if (userLimit.count >= LIMIT) {
        const timeLeft = Math.ceil((userLimit.lastReset + WINDOW_MS - now) / (60 * 1000));
        return {
            allowed: false,
            message: `Rate limit exceeded. Please try again in ${timeLeft} minutes.`,
            retryAfter: timeLeft
        };
    }
    
    return { allowed: true };
}

/**
 * Record a successful email request for rate limiting.
 * @param {string} email 
 */
function recordEmailRequest(email) {
    const WINDOW_MS = 60 * 60 * 1000;
    const now = Date.now();
    let rateData = {};
    try {
        rateData = JSON.parse(localStorage.getItem('email_rate_limits') || '{}');
    } catch (e) {
        console.error('Error parsing rate limit data', e);
    }
    
    if (!rateData[email] || (now - rateData[email].lastReset > WINDOW_MS)) {
        rateData[email] = {
            count: 1,
            lastReset: now
        };
    } else {
        rateData[email].count += 1;
    }
    
    localStorage.setItem('email_rate_limits', JSON.stringify(rateData));
}

