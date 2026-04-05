// Set up Supabase Client
const SUPABASE_URL = 'https://loovtbdzjgpqamhssnue.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvb3Z0YmR6amdwcWFtaHNzbnVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDI3MTcsImV4cCI6MjA5MDc3ODcxN30.StgTqDRbsasnEq7gfnkF4P1bZTaV8pf3BmPIhUPFI4Q';
// Ensure Supabase JS CDN is loaded in HTML before app.js
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Initialize theme
function initTheme() {
    // Default to green if not set
    const savedTheme = localStorage.getItem('theme') || 'green';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Dispatch event for other scripts
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: savedTheme } }));
}

// Toggle theme between green and blue
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'green';
    const newTheme = currentTheme === 'green' ? 'blue' : 'green';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
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

// DOM Loaded setup
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderDynamicDateSlider();
    
    // Add ripple effect to buttons
    const rippleButtons = document.querySelectorAll('.fab, .nav-item, .date-card, .check-btn');
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
    
    // Init hero slider if present
    initHeroSlider();
    
    // Setup Supabase Auth Listener
    if (supabase) {
        setupAuthListener();
    }
});

// --- Supabase Authentication Logic --- //

async function setupAuthListener() {
    const { data: { session }, error } = await supabase.auth.getSession();
    handleRouteProtection(session);

    supabase.auth.onAuthStateChange((event, session) => {
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
    const isPublicRoute = currentPath.includes('login.html') || currentPath.includes('register.html');
    
    if (!session && !isPublicRoute) {
        // Not logged in and on protected page -> redirect to login
        window.location.href = 'login.html';
    } else if (session && isPublicRoute) {
        // Logged in but on login/register page -> redirect to index
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

    const { data, error } = await supabase.auth.signInWithPassword({
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

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: name
            }
        }
    });

    if (error) {
        alert("Registration failed: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    } else {
        alert('Account created! Please check your email to confirm your registration.');
        btn.innerText = originalText;
        btn.disabled = false;
        window.location.href = 'login.html';
    }
}

async function handleGoogleAuth() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // redirect to dashboard after google auth
            redirectTo: window.location.origin + '/index.html'
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
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            document.body.style.opacity = '1';
        }
    }
}

// Hero Slider features
let currentSlide = 0;
let slideInterval;

function initHeroSlider() {
    const track = document.getElementById('hero-slider-track');
    if (!track) return;
    
    // Auto slide every 4 seconds
    startSlideInterval();
    
    // Allow pause on hover/touch
    const section = document.getElementById('hero-slider-section');
    section.addEventListener('mouseenter', () => clearInterval(slideInterval));
    section.addEventListener('mouseleave', startSlideInterval);
    section.addEventListener('touchstart', () => clearInterval(slideInterval), {passive: true});
    section.addEventListener('touchend', startSlideInterval, {passive: true});
}

function startSlideInterval() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        let nextSlide = (currentSlide + 1) % 3;
        goToSlide(nextSlide);
    }, 4000);
}

function goToSlide(index) {
    const track = document.getElementById('hero-slider-track');
    const indicators = document.getElementById('hero-indicators');
    if (!track || !indicators) return;
    
    currentSlide = index;
    // Move track x direction by multiples of 33.333%
    // Since width is 300% (3 slides), each slide takes 100/3 = 33.3333% of the container width
    const translateX = -(index * 33.333333);
    track.style.transform = `translateX(${translateX}%)`;
    
    // Update indicators visually
    const buttons = indicators.querySelectorAll('button');
    buttons.forEach((btn, i) => {
        if (i === index) {
            btn.className = 'w-2.5 h-2.5 rounded-full bg-white opacity-100 shadow-sm transition-all';
        } else {
            btn.className = 'w-1.5 h-1.5 rounded-full bg-white opacity-50 hover:opacity-100 transition-all';
        }
    });
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
            <button id="slider-date-${i}" class="date-card ${isActive} min-w-[60px] h-[75px] rounded-2xl flex flex-col items-center justify-center shrink-0 focus:outline-none" style="${style}" onclick="selectSliderDate(this, ${i})">
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
            btn.style.overflow = 'hidden';
        }
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
    alert("Add Habit modal will open here!");
}
