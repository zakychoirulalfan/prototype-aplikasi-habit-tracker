// ===== habits.js — Shared Habit Data Layer (Supabase-first) =====
// Uses Supabase as source of truth with localStorage as cache.
// supabaseClient is defined in app.js (loaded after this file).

// --- Select mode state ---
let _selectMode = false;
let _selectedIds = new Set();

// --- Helper to safely get the supabase client ---
function getClient() {
    return window.supabaseClient || null;
}

// --- Data helpers (localStorage as cache) ---
function getHabits() {
    return JSON.parse(localStorage.getItem('habits') || '[]');
}

function saveHabitsCache(habits) {
    localStorage.setItem('habits', JSON.stringify(habits));
}

// Ensure a "loginDate" is persisted so we know when to start red-dots
function getLoginDate() {
    let d = localStorage.getItem('loginDate');
    if (!d) {
        d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        localStorage.setItem('loginDate', d);
    }
    return d;
}

// --- Completion tracking (per habit per date) ---
// Cache shape: { "2026-04-05": { "<habitId>": true/false } }
function getCompletions() {
    return JSON.parse(localStorage.getItem('completions') || '{}');
}

function setCompletion(habitId, dateStr, value) {
    // Update local cache
    const c = getCompletions();
    if (!c[dateStr]) c[dateStr] = {};
    c[dateStr][habitId] = value;
    localStorage.setItem('completions', JSON.stringify(c));

    // Persist to Supabase habit_logs
    upsertHabitLog(habitId, dateStr, { completed: value });
}

function isHabitCompleted(habitId, dateStr) {
    const c = getCompletions();
    return !!(c[dateStr] && c[dateStr][habitId]);
}

// --- Numeric value tracking (per habit per date) ---
function getNumericValues() {
    return JSON.parse(localStorage.getItem('numericValues') || '{}');
}

function getNumericValue(habitId, dateStr) {
    const nv = getNumericValues();
    return (nv[dateStr] && nv[dateStr][habitId]) || 0;
}

function setNumericValue(habitId, dateStr, value) {
    // Update local cache
    const nv = getNumericValues();
    if (!nv[dateStr]) nv[dateStr] = {};
    nv[dateStr][habitId] = value;
    localStorage.setItem('numericValues', JSON.stringify(nv));
    // Mark completed if value > 0
    setCompletion(habitId, dateStr, value > 0);
    // Persist numeric value to Supabase
    upsertHabitLog(habitId, dateStr, { numeric_value: value, completed: value > 0 });
}

// --- Timer state tracking ---
// Running state is kept in localStorage only (real-time).
// Elapsed time is persisted to Supabase when timer is paused.
function getTimerStates() {
    return JSON.parse(localStorage.getItem('timerStates') || '{}');
}

function saveTimerStates(ts) {
    localStorage.setItem('timerStates', JSON.stringify(ts));
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// --- Supabase Upsert for habit_logs ---
async function upsertHabitLog(habitId, dateStr, fields) {
    const client = getClient();
    if (!client) return;
    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        const payload = {
            user_id: session.user.id,
            habit_id: habitId,
            log_date: dateStr,
            updated_at: new Date().toISOString(),
            ...fields
        };

        await client.from('habit_logs').upsert(payload, {
            onConflict: 'habit_id,log_date'
        });
    } catch (err) {
        console.error('habit_logs upsert error:', err);
    }
}

// --- Supabase Sync: Fetch habits and logs on page load ---
async function syncHabitsFromSupabase() {
    const client = getClient();
    if (!client) return;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        // Fetch habits from user_habits
        const { data: habits, error } = await client
            .from('user_habits')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching habits:', error);
            return;
        }

        // Transform to app format and cache in localStorage
        const appHabits = (habits || []).map(h => ({
            id: h.id,
            name: h.name,
            goals: h.goals || '',
            description: h.description || '',
            category: h.category || 'study',
            iconHtml: h.icon_html || '<i class="fa-solid fa-star"></i>',
            evaluation: h.evaluation || 'checklist',
            unit: h.unit || ''
        }));

        saveHabitsCache(appHabits);

        // Fetch habit_logs for completions
        const { data: logs, error: logsError } = await client
            .from('habit_logs')
            .select('*')
            .eq('user_id', session.user.id);

        if (logsError) {
            console.error('Error fetching habit logs:', logsError);
            return;
        }

        // Build completions, numeric values, and timer elapsed from logs
        const completions = {};
        const numericValues = {};
        const timerStates = getTimerStates(); // preserve running state

        (logs || []).forEach(log => {
            const dateStr = log.log_date;
            if (!completions[dateStr]) completions[dateStr] = {};
            if (!numericValues[dateStr]) numericValues[dateStr] = {};

            completions[dateStr][log.habit_id] = log.completed;

            if (log.numeric_value > 0) {
                numericValues[dateStr][log.habit_id] = log.numeric_value;
            }

            if (log.timer_elapsed > 0) {
                // Only set elapsed from DB if timer isn't currently running locally
                if (!timerStates[log.habit_id] || !timerStates[log.habit_id].running) {
                    timerStates[log.habit_id] = {
                        running: false,
                        elapsed: log.timer_elapsed,
                        lastTick: null
                    };
                }
            }
        });

        localStorage.setItem('completions', JSON.stringify(completions));
        localStorage.setItem('numericValues', JSON.stringify(numericValues));
        saveTimerStates(timerStates);

        return appHabits;
    } catch (err) {
        console.error('syncHabitsFromSupabase error:', err);
    }
}

// --- Add habit to Supabase (returns the Supabase UUID) ---
async function addHabitToSupabase(habitData) {
    const client = getClient();
    if (!client) return null;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return null;

        const { data, error } = await client.from('user_habits').insert({
            user_id: session.user.id,
            name: habitData.name,
            goals: habitData.goals,
            description: habitData.description,
            category: habitData.category,
            icon_html: habitData.iconHtml,
            evaluation: habitData.evaluation,
            unit: habitData.unit || ''
        }).select('id').single();

        if (error) {
            console.error('Supabase habit insert error:', error);
            return null;
        }

        return data.id; // Return the Supabase UUID
    } catch (err) {
        console.error('addHabitToSupabase error:', err);
        return null;
    }
}

// --- Update habit in Supabase ---
async function updateHabitInSupabase(habitId, habitData) {
    const client = getClient();
    if (!client) return;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        await client.from('user_habits').update({
            name: habitData.name,
            goals: habitData.goals,
            description: habitData.description,
            category: habitData.category,
            icon_html: habitData.iconHtml,
            evaluation: habitData.evaluation,
            unit: habitData.unit || '',
            updated_at: new Date().toISOString()
        }).eq('id', habitId).eq('user_id', session.user.id);
    } catch (err) {
        console.error('updateHabitInSupabase error:', err);
    }
}

// --- Delete habits from Supabase ---
async function deleteHabitsFromSupabase(habitIds) {
    const client = getClient();
    if (!client) return;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        await client.from('user_habits')
            .delete()
            .eq('user_id', session.user.id)
            .in('id', habitIds);
    } catch (err) {
        console.error('deleteHabitsFromSupabase error:', err);
    }
}

// --- Category color mapping ---
const CATEGORY_COLORS = {
    art:           { bg: 'bg-pink-50',    text: 'text-pink-500',    hex: '#EC4899' },
    study:         { bg: 'bg-blue-50',    text: 'text-blue-500',    hex: '#3B82F6' },
    entertainment: { bg: 'bg-purple-50',  text: 'text-purple-500',  hex: '#8B5CF6' },
    meditation:    { bg: 'bg-indigo-50',  text: 'text-indigo-500',  hex: '#6366F1' },
    meditate:      { bg: 'bg-indigo-50',  text: 'text-indigo-500',  hex: '#6366F1' },
    finance:       { bg: 'bg-green-50',   text: 'text-green-500',   hex: '#10B981' },
    sport:         { bg: 'bg-orange-50',  text: 'text-orange-500',  hex: '#F97316' },
    health:        { bg: 'bg-red-50',     text: 'text-red-500',     hex: '#EF4444' },
    work:          { bg: 'bg-gray-100',   text: 'text-gray-700',    hex: '#374151' },
    entertain:     { bg: 'bg-purple-50',  text: 'text-purple-500',  hex: '#8B5CF6' },
};

function getCategoryColor(catName) {
    const key = catName.toLowerCase().trim();
    return CATEGORY_COLORS[key] || { bg: 'bg-teal-50', text: 'text-teal-500', hex: '#14B8A6' };
}

// =============================================
// HOME PAGE — render habit cards
// =============================================
function renderHomeHabits() {
    const container = document.getElementById('habit-list');
    if (!container) return;

    const habits = getHabits();
    const today = new Date().toISOString().slice(0, 10);

    if (habits.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-plus text-gray-400 text-xl"></i>
                </div>
                <p class="text-gray-500 text-sm font-medium">No habits yet</p>
                <p class="text-gray-400 text-xs mt-1">Tap the + button to add your first habit</p>
            </div>`;
        return;
    }

    let html = '';
    habits.forEach((habit, idx) => {
        const completed = isHabitCompleted(habit.id, today);
        const delay = 0.3 + idx * 0.05;

        if (habit.evaluation === 'timer') {
            html += buildTimerCard(habit, completed, delay, today);
        } else if (habit.evaluation === 'numeric') {
            html += buildNumericCard(habit, completed, delay, today);
        } else {
            html += buildChecklistCard(habit, completed, delay, today);
        }
    });

    container.innerHTML = html;

    // Attach event listeners
    attachHomeCardListeners(today);
    // Start ticking any running timers
    startHomeTimerTicks();
}

function buildSelectCircle(habitId) {
    const sel = _selectedIds.has(habitId);
    return `<div class="sel-circle w-7 h-7 rounded-full border-2 border-white/80 flex items-center justify-center shrink-0 transition-all ${sel ? 'bg-white' : ''}" style="pointer-events:none;">${sel ? '<i class="fa-solid fa-check text-xs" style="color:var(--primary)"></i>' : ''}</div>`;
}

function buildChecklistCard(habit, completed, delay, dateStr) {
    const checkedClasses = completed ? 'bg-white text-[var(--primary)]' : 'opacity-50';
    const iconVisibility = completed ? 'visible' : 'invisible';
    const cardClick = _selectMode ? `onclick="toggleHabitSelection('${habit.id}')" style="cursor:pointer;"` : '';
    const selRing = (_selectMode && _selectedIds.has(habit.id)) ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--primary)]' : '';

    const rightArea = _selectMode
        ? buildSelectCircle(habit.id)
        : `<div class="flex items-center gap-3">
            <button class="check-btn home-check w-9 h-9 rounded-full border-2 border-white flex items-center justify-center hover:bg-white hover:text-[var(--primary)] transition-colors ${checkedClasses}" data-id="${habit.id}" data-date="${dateStr}"><i class="fa-solid fa-check ${iconVisibility}"></i></button>
            <button class="text-white opacity-80 h-10 px-2 flex flex-col justify-center gap-1 home-delete" data-id="${habit.id}"><span class="w-1 h-1 bg-white rounded-full"></span><span class="w-1 h-1 bg-white rounded-full"></span><span class="w-1 h-1 bg-white rounded-full"></span></button>
           </div>`;

    return `
    <div class="habit-card rounded-2xl p-4 flex items-center justify-between text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] ${selRing}" style="animation-delay:${delay}s" data-habit-id="${habit.id}" ${cardClick}>
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 border-2 border-white/80 rounded-full flex items-center justify-center text-xl shrink-0">${habit.iconHtml || '<i class="fa-solid fa-star"></i>'}</div>
            <div><h3 class="font-bold text-base w-32 truncate">${habit.name}</h3><p class="text-xs font-medium text-white/90">${habit.goals || ''}</p></div>
        </div>
        ${rightArea}
    </div>`;
}

function buildNumericCard(habit, completed, delay, dateStr) {
    const value = getNumericValue(habit.id, dateStr);
    const circleFilled = value > 0 ? 'bg-white text-[var(--primary)]' : '';
    const cardClick = _selectMode ? `onclick="toggleHabitSelection('${habit.id}')" style="cursor:pointer;"` : '';
    const selRing = (_selectMode && _selectedIds.has(habit.id)) ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--primary)]' : '';

    const rightArea = _selectMode
        ? buildSelectCircle(habit.id)
        : `<div class="flex items-center gap-2">
            <div class="flex flex-col gap-0.5">
                <button class="numeric-plus w-5 h-5 rounded-full border border-white/70 flex items-center justify-center hover:bg-white hover:text-[var(--primary)] transition-colors" data-id="${habit.id}" data-date="${dateStr}"><i class="fa-solid fa-plus" style="font-size:8px;"></i></button>
                <button class="numeric-minus w-5 h-5 rounded-full border border-white/70 flex items-center justify-center hover:bg-white hover:text-[var(--primary)] transition-colors" data-id="${habit.id}" data-date="${dateStr}"><i class="fa-solid fa-minus" style="font-size:8px;"></i></button>
            </div>
            <div class="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center ${circleFilled} transition-colors">
                <input type="number" class="numeric-input w-7 h-7 bg-transparent text-center font-bold text-xs focus:outline-none" style="-moz-appearance:textfield;appearance:textfield;color:inherit;" value="${value}" min="0" data-id="${habit.id}" data-date="${dateStr}">
            </div>
            <button class="text-white opacity-80 h-10 px-1 ml-1 flex flex-col justify-center gap-1 home-delete" data-id="${habit.id}"><span class="w-1 h-1 bg-white rounded-full"></span><span class="w-1 h-1 bg-white rounded-full"></span><span class="w-1 h-1 bg-white rounded-full"></span></button>
           </div>`;

    return `
    <div class="habit-card rounded-2xl p-4 flex items-center justify-between text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] ${selRing}" style="animation-delay:${delay}s" data-habit-id="${habit.id}" ${cardClick}>
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 border-2 border-white/80 rounded-full flex items-center justify-center text-xl shrink-0">${habit.iconHtml || '<i class="fa-solid fa-hashtag"></i>'}</div>
            <div><h3 class="font-bold text-base w-24 sm:w-32 truncate">${habit.name}</h3><p class="text-xs font-medium text-white/90">${habit.goals || ''}</p></div>
        </div>
        ${rightArea}
    </div>`;
}

function buildTimerCard(habit, completed, delay, dateStr) {
    const ts = getTimerStates();
    const state = ts[habit.id] || { running: false, elapsed: 0 };
    const cardClick = _selectMode ? `onclick="toggleHabitSelection('${habit.id}')" style="cursor:pointer;"` : '';
    const selRing = (_selectMode && _selectedIds.has(habit.id)) ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--primary)]' : '';

    const rightArea = _selectMode
        ? buildSelectCircle(habit.id)
        : `<div class="flex items-center gap-3">
            <button class="home-timer-btn w-9 h-9 rounded-full border-2 border-white flex items-center justify-center hover:bg-white hover:text-[var(--primary)] transition-colors ${state.running ? 'bg-white text-[var(--primary)]' : ''}" data-id="${habit.id}" data-date="${dateStr}"><i class="fa-solid ${state.running ? 'fa-pause' : 'fa-play'} text-sm"></i></button>
            <button class="text-white opacity-80 h-10 px-2 flex flex-col justify-center gap-1 home-delete" data-id="${habit.id}"><span class="w-1 h-1 bg-white rounded-full"></span><span class="w-1 h-1 bg-white rounded-full"></span><span class="w-1 h-1 bg-white rounded-full"></span></button>
           </div>`;

    return `
    <div class="habit-card rounded-2xl p-4 flex items-center justify-between text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] ${selRing}" style="animation-delay:${delay}s" data-habit-id="${habit.id}" ${cardClick}>
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 border-2 border-white/80 rounded-full flex items-center justify-center text-xl shrink-0">${habit.iconHtml || '<i class="fa-solid fa-stopwatch"></i>'}</div>
            <div><h3 class="font-bold text-base w-32 truncate">${habit.name}</h3><p class="text-xs font-medium text-white/90 timer-display" data-timer-id="${habit.id}">${formatTime(state.elapsed)}</p></div>
        </div>
        ${rightArea}
    </div>`;
}

function attachHomeCardListeners(dateStr) {
    // Checklist toggle
    document.querySelectorAll('.home-check').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const wasCompleted = isHabitCompleted(id, dateStr);
            setCompletion(id, dateStr, !wasCompleted);

            const icon = btn.querySelector('i');
            if (!wasCompleted) {
                btn.classList.remove('opacity-50');
                btn.classList.add('bg-white', 'text-[var(--primary)]');
                icon.classList.remove('invisible');
                icon.classList.add('visible');
                btn.style.transform = 'scale(1.2)';
                setTimeout(() => btn.style.transform = 'scale(1)', 150);
            } else {
                btn.classList.add('opacity-50');
                btn.classList.remove('bg-white', 'text-[var(--primary)]');
                icon.classList.remove('visible');
                icon.classList.add('invisible');
            }
            // Update red dots on date slider
            renderHomeDateRedDots();
        });
    });

    // Timer play/pause
    document.querySelectorAll('.home-timer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const ts = getTimerStates();
            if (!ts[id]) ts[id] = { running: false, elapsed: 0 };

            if (ts[id].running) {
                // Pause
                ts[id].running = false;
                ts[id].lastTick = null;
                btn.innerHTML = '<i class="fa-solid fa-play text-sm"></i>';
                btn.classList.remove('bg-white', 'text-[var(--primary)]');
                // Mark as completed if any time recorded + persist to Supabase
                if (ts[id].elapsed > 0) {
                    setCompletion(id, dateStr, true);
                    upsertHabitLog(id, dateStr, { timer_elapsed: ts[id].elapsed, completed: true });
                }
            } else {
                // Start
                ts[id].running = true;
                ts[id].lastTick = Date.now();
                btn.innerHTML = '<i class="fa-solid fa-pause text-sm"></i>';
                btn.classList.add('bg-white', 'text-[var(--primary)]');
            }
            saveTimerStates(ts);
            startHomeTimerTicks();
            renderHomeDateRedDots();
        });
    });

    // Numeric +/- buttons
    document.querySelectorAll('.numeric-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const date = btn.dataset.date;
            let val = getNumericValue(id, date);
            if (val > 0) val--;
            setNumericValue(id, date, val);
            renderHomeHabits();
        });
    });
    document.querySelectorAll('.numeric-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const date = btn.dataset.date;
            let val = getNumericValue(id, date);
            val++;
            setNumericValue(id, date, val);
            renderHomeHabits();
        });
    });
    // Numeric direct input
    document.querySelectorAll('.numeric-input').forEach(input => {
        input.addEventListener('change', () => {
            const id = input.dataset.id;
            const date = input.dataset.date;
            let val = parseInt(input.value) || 0;
            if (val < 0) val = 0;
            setNumericValue(id, date, val);
            renderHomeHabits();
        });
        // Select all on focus for easy editing
        input.addEventListener('focus', () => input.select());
    });

    // 3-dot menu → open edit page
    document.querySelectorAll('.home-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            window.location.href = `edit_habit.html?id=${id}`;
        });
    });
}

// Timer ticking
let _homeTimerInterval = null;
function startHomeTimerTicks() {
    if (_homeTimerInterval) clearInterval(_homeTimerInterval);
    _homeTimerInterval = setInterval(() => {
        const ts = getTimerStates();
        let anyRunning = false;
        Object.keys(ts).forEach(id => {
            if (ts[id].running) {
                anyRunning = true;
                const now = Date.now();
                const delta = Math.floor((now - (ts[id].lastTick || now)) / 1000);
                ts[id].elapsed += delta;
                ts[id].lastTick = now;
                // Update display
                const display = document.querySelector(`.timer-display[data-timer-id="${id}"]`);
                if (display) display.textContent = formatTime(ts[id].elapsed);
            }
        });
        saveTimerStates(ts);
        if (!anyRunning) {
            clearInterval(_homeTimerInterval);
            _homeTimerInterval = null;
        }
    }, 1000);
}

// Red dots on the home date slider
function renderHomeDateRedDots() {
    const habits = getHabits();
    if (habits.length === 0) return;

    const loginDate = getLoginDate();
    const completions = getCompletions();

    // Ensure the date container doesn't clip overflow
    const dateContainer = document.getElementById('mobile-date-selector');
    if (dateContainer) {
        dateContainer.style.overflowY = 'visible';
        dateContainer.style.paddingTop = '8px';
    }

    document.querySelectorAll('.date-card').forEach(card => {
        const dateStr = card.dataset.date;
        if (!dateStr) return;
        // Only for dates >= loginDate and <= today
        const today = new Date().toISOString().slice(0, 10);
        if (dateStr < loginDate || dateStr > today) {
            // Remove dot if exists
            const existingDot = card.querySelector('.red-dot');
            if (existingDot) existingDot.remove();
            return;
        }
        // Check if all habits completed for this date
        const allCompleted = habits.every(h => completions[dateStr] && completions[dateStr][h.id]);
        let dot = card.querySelector('.red-dot');
        if (!allCompleted) {
            if (!dot) {
                dot = document.createElement('span');
                dot.className = 'red-dot';
                card.appendChild(dot);
            }
        } else {
            if (dot) dot.remove();
        }
    });
}

// =============================================
// CALENDAR PAGE — render habit list for selected date & red dots
// =============================================
function renderCalendarHabits(dateStr) {
    const container = document.getElementById('calendar-habit-list');
    if (!container) return;

    const habits = getHabits();
    const completions = getCompletions();
    const theme = document.documentElement.getAttribute('data-theme') || 'green';
    const primaryColor = theme === 'blue' ? '#5BA4C9' : '#10B981';
    const lightColor = theme === 'blue' ? '#E0F2FE' : '#D1FAE5';

    if (habits.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500 text-sm font-medium">No habits tracked</p>
                <p class="text-gray-400 text-xs mt-1">Add habits using the + button</p>
            </div>`;
        return;
    }

    let html = '';
    habits.forEach(habit => {
        const completed = isHabitCompleted(habit.id, dateStr);
        const catColor = getCategoryColor(habit.category);

        if (habit.evaluation === 'timer') {
            const ts = getTimerStates();
            const state = ts[habit.id] || { elapsed: 0 };
            const timeStr = formatTime(state.elapsed);

            html += `
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between ${completed ? '' : 'opacity-70'}">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style="background-color: ${completed ? lightColor : '#F3F4F6'}; color: ${completed ? primaryColor : '#6B7280'};">
                        ${habit.iconHtml || '<i class="fa-solid fa-stopwatch"></i>'}
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-gray-900 truncate">${habit.name}</h4>
                        ${habit.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">${habit.description}</p>` : ''}
                        <p class="text-xs font-medium mt-0.5" style="color: ${completed ? primaryColor : '#6B7280'}">
                            <i class="fa-solid fa-stopwatch mr-1"></i>${timeStr} ${completed ? '— Done' : '— Pending'}
                        </p>
                    </div>
                </div>
                ${completed
                    ? `<i class="fa-solid fa-circle-check text-xl shrink-0" style="color: ${primaryColor}"></i>`
                    : `<i class="fa-regular fa-circle text-gray-300 text-xl shrink-0"></i>`
                }
            </div>`;
        } else if (habit.evaluation === 'numeric') {
            const numVal = getNumericValue(habit.id, dateStr);
            html += `
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between ${numVal > 0 ? '' : 'opacity-70'}">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style="background-color: ${numVal > 0 ? lightColor : '#F3F4F6'}; color: ${numVal > 0 ? primaryColor : '#6B7280'};">
                        ${habit.iconHtml || '<i class="fa-solid fa-hashtag"></i>'}
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-gray-900 truncate">${habit.name}</h4>
                        ${habit.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">${habit.description}</p>` : ''}
                        <p class="text-xs font-medium mt-0.5" style="color: ${numVal > 0 ? primaryColor : '#6B7280'}">${numVal > 0 ? 'Completed' : 'Not completed'}</p>
                    </div>
                </div>
                ${numVal > 0
                    ? `<i class="fa-solid fa-circle-check text-xl shrink-0" style="color: ${primaryColor}"></i>`
                    : `<i class="fa-regular fa-circle-xmark text-gray-400 text-xl shrink-0"></i>`
                }
            </div>`;
        } else {
            html += `
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between ${completed ? '' : 'opacity-70'}">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style="background-color: ${completed ? lightColor : '#F3F4F6'}; color: ${completed ? primaryColor : '#6B7280'};">
                        ${habit.iconHtml || '<i class="fa-solid fa-star"></i>'}
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-gray-900 truncate">${habit.name}</h4>
                        ${habit.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">${habit.description}</p>` : ''}
                        <p class="text-xs font-medium mt-0.5" style="color: ${completed ? primaryColor : '#6B7280'}">${completed ? 'Completed ✓' : 'Not completed'}</p>
                    </div>
                </div>
                ${completed
                    ? `<i class="fa-solid fa-circle-check text-xl shrink-0" style="color: ${primaryColor}"></i>`
                    : `<i class="fa-regular fa-circle-xmark text-gray-400 text-xl shrink-0"></i>`
                }
            </div>`;
        }
    });

    container.innerHTML = html;
}

// Render red dots on calendar grid
function renderCalendarRedDots() {
    const habits = getHabits();
    if (habits.length === 0) return;

    const loginDate = getLoginDate();
    const completions = getCompletions();
    const today = new Date().toISOString().slice(0, 10);

    document.querySelectorAll('.calendar-day[data-date]').forEach(dayEl => {
        const dateStr = dayEl.dataset.date;
        if (!dateStr || dateStr < loginDate || dateStr > today) return;

        const allCompleted = habits.every(h => completions[dateStr] && completions[dateStr][h.id]);
        let dot = dayEl.querySelector('.cal-red-dot');
        if (!allCompleted) {
            if (!dot) {
                dot = document.createElement('span');
                dot.className = 'cal-red-dot absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full';
                dayEl.style.position = 'relative';
                dayEl.appendChild(dot);
            }
        } else {
            if (dot) dot.remove();
        }
    });
}

// =============================================
// STATISTICS PAGE — compute data from real habits
// =============================================
function getStatsData(period) {
    const habits = getHabits();
    const completions = getCompletions();
    const today = new Date();

    // Build category distribution from actual habits
    const catCounts = {};
    habits.forEach(h => {
        const cat = h.category || 'Other';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    // Activity data — completion rates per time period
    let labels = [];
    let data = [];

    if (period === 'daily') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            labels.push(dayNames[d.getDay()]);

            if (habits.length === 0) {
                data.push(0);
            } else {
                const completed = habits.filter(h => completions[dateStr] && completions[dateStr][h.id]).length;
                data.push(Math.round((completed / habits.length) * 100));
            }
        }
    } else if (period === 'weekly') {
        // Last 4 weeks
        for (let w = 3; w >= 0; w--) {
            labels.push(`Week ${4 - w}`);
            let totalRate = 0;
            let dayCount = 0;
            for (let d = 0; d < 7; d++) {
                const day = new Date(today);
                day.setDate(day.getDate() - (w * 7 + d));
                const dateStr = day.toISOString().slice(0, 10);
                if (habits.length > 0) {
                    const completed = habits.filter(h => completions[dateStr] && completions[dateStr][h.id]).length;
                    totalRate += (completed / habits.length) * 100;
                }
                dayCount++;
            }
            data.push(Math.round(totalRate / dayCount));
        }
    } else {
        // Monthly — last 6 months
        for (let m = 5; m >= 0; m--) {
            const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
            labels.push(monthDate.toLocaleString('default', { month: 'short' }));
            let totalRate = 0;
            let dayCount = 0;
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = new Date(monthDate.getFullYear(), monthDate.getMonth(), d).toISOString().slice(0, 10);
                if (habits.length > 0) {
                    const completed = habits.filter(h => completions[dateStr] && completions[dateStr][h.id]).length;
                    totalRate += (completed / habits.length) * 100;
                }
                dayCount++;
            }
            data.push(Math.round(totalRate / dayCount));
        }
    }

    // Longest streak
    let longestStreak = 0;
    let currentStreak = 0;
    for (let i = 90; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const allDone = habits.length > 0 && habits.every(h => completions[dateStr] && completions[dateStr][h.id]);
        if (allDone) {
            currentStreak++;
            if (currentStreak > longestStreak) longestStreak = currentStreak;
        } else {
            currentStreak = 0;
        }
    }

    // Completion rate for today
    let completionRate = 0;
    if (habits.length > 0) {
        const todayStr = today.toISOString().slice(0, 10);
        const completed = habits.filter(h => completions[todayStr] && completions[todayStr][h.id]).length;
        completionRate = Math.round((completed / habits.length) * 100);
    }

    return { labels, data, catCounts, longestStreak, completionRate };
}

// =============================================
// SELECTION MODE LOGIC
// =============================================
function toggleSelectMode() {
    _selectMode = !_selectMode;
    _selectedIds.clear();
    
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.innerText = '0';
    
    // Update UI elements
    const selectBtn = document.getElementById('select-mode-btn');
    const actionBar = document.getElementById('select-action-bar');
    
    if (selectBtn) {
        selectBtn.innerText = _selectMode ? 'Done' : 'Select Multiple';
    }
    
    if (actionBar) {
        if (_selectMode) {
            actionBar.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
        } else {
            actionBar.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
        }
    }
    
    renderHomeHabits(); 
}

function toggleHabitSelection(id) {
    if (!_selectMode) return;
    if (_selectedIds.has(id)) {
        _selectedIds.delete(id);
    } else {
        _selectedIds.add(id);
    }
    
    // Update count
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.innerText = _selectedIds.size;
    
    // Re-render
    renderHomeHabits();
}

function confirmDeletion() {
    if (_selectedIds.size === 0) return;
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        const content = modal.querySelector('.popup-content');
        if (content) {
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        }
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) {
        modal.classList.add('opacity-0', 'pointer-events-none');
        const content = modal.querySelector('.popup-content');
        if (content) {
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
        }
    }
}

async function executeDeletion() {
    let habits = getHabits();
    
    const idsToDelete = Array.from(_selectedIds);
    
    // Remove from Supabase first
    await deleteHabitsFromSupabase(idsToDelete);
    
    // Remove from local cache
    habits = habits.filter(h => !_selectedIds.has(h.id));
    saveHabitsCache(habits);
    
    closeDeleteModal();
    toggleSelectMode(); // Exit select mode
}

// Expose selection functions for html inline calls
window.toggleSelectMode = toggleSelectMode;
window.toggleHabitSelection = toggleHabitSelection;
window.confirmDeletion = confirmDeletion;
window.closeDeleteModal = closeDeleteModal;
window.executeDeletion = executeDeletion;
