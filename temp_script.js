
        // ================================================================
        // HabitFlow — Add Habit Page Script
        // Connects to: GET /api/categories, POST /api/categories, POST /api/habits
        // ================================================================

        const API_BASE = '';

        // ── Auth: Ambil userId dari localStorage key yang dipakai app.js ──
        // app.js menyimpan: localStorage.setItem('currentUser', JSON.stringify(result.user))
        // result.user = { id, username, email }

        // Custom icon pool for custom categories
        const CUSTOM_ICONS = [
            'bi-paw', 'bi-music-note', 'bi-airplane', 'bi-camera',
            'bi-egg-fried', 'bi-bicycle', 'bi-tree', 'bi-star',
            'bi-heart', 'bi-lightning', 'bi-cup-hot', 'bi-flower1',
            'bi-house', 'bi-journal', 'bi-moon', 'bi-sun'
        ];

        // Icon → color map for standard categories
        const CAT_COLOR_MAP = {
            'bi-palette': { bg: '#fce7f3', color: '#db2777' },
            'bi-book': { bg: '#dbeafe', color: '#2563eb' },
            'bi-controller': { bg: '#ede9fe', color: '#7c3aed' },
            'bi-moon-stars': { bg: '#ede9fe', color: '#6d28d9' },
            'bi-briefcase': { bg: '#f3f4f6', color: '#374151' },
            'bi-dribbble': { bg: '#ffedd5', color: '#ea580c' },
            'bi-wallet2': { bg: '#d1fae5', color: '#065f46' },
        };

        // ── State ──────────────────────────────────────────────────────
        let selectedCategoryId = null;
        let selectedEval = 'checklist';
        let selectedCustomIcon = CUSTOM_ICONS[0];
        let counterValue = 0;
        let categories = [];

        // ── DOM refs ───────────────────────────────────────────────────
        const categoryGrid = document.getElementById('category-grid');
        const customPanel = document.getElementById('custom-panel');
        const customCatName = document.getElementById('custom-cat-name');
        const customIconGrid = document.getElementById('custom-icon-grid');
        const habitName = document.getElementById('habit-name');
        const habitGoals = document.getElementById('habit-goals');
        const habitDesc = document.getElementById('habit-desc');
        const habitUnit = document.getElementById('habit-unit');
        const numericPreview = document.getElementById('numeric-preview');
        const counterCircle = document.getElementById('counter-circle');
        const errHabitName = document.getElementById('err-habit-name');
        const btnSubmit = document.getElementById('btn-submit');
        const toastEl = document.getElementById('toast-msg');

        // ── Utility: get userId dari localStorage ────────────────────────
        // Sumber kebenaran: app.js simpan user di key 'currentUser' saat login berhasil
        // Format: { id: <number>, username: <string>, email: <string> }
        function getUserId() {
            try {
                // Coba 'currentUser' (key resmi dari app.js)
                const raw = localStorage.getItem('currentUser');
                if (raw) {
                    const u = JSON.parse(raw);
                    if (u && u.id) return String(u.id);
                }
                // Fallback: format lama / alternatif lain
                const alt = localStorage.getItem('habitflow_user') || sessionStorage.getItem('habitflow_user');
                if (alt) {
                    const u = JSON.parse(alt);
                    if (u && u.id) return String(u.id);
                }
                return null;
            } catch {
                return null;
            }
        }

        // ── Guard: jika tidak ada session, redirect ke login ──────────────
        function requireAuth() {
            const userId = getUserId();
            const authLoader = document.getElementById('auth-guard-loader');
            
            if (!userId) {
                // Simpan halaman tujuan agar bisa kembali setelah login
                sessionStorage.setItem('redirectAfterLogin', 'add_habit.html');
                window.location.href = 'login.html';
                return false;
            }
            
            // Hapus loader otentikasi jika sesi valid
            if (authLoader) {
                authLoader.style.opacity = '0';
                setTimeout(() => authLoader.remove(), 300);
            }
            return true;
        }

        // ── Toast ──────────────────────────────────────────────────────
        function showToast(msg, duration = 2800) {
            toastEl.textContent = msg;
            toastEl.classList.add('show');
            setTimeout(() => toastEl.classList.remove('show'), duration);
        }

        // ── Build custom icon picker ───────────────────────────────────
        function buildCustomIconPicker() {
            customIconGrid.innerHTML = '';
            CUSTOM_ICONS.forEach(icon => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('data-icon', icon);
                btn.setAttribute('aria-label', icon);
                btn.style.cssText = `
                width:36px;height:36px;border-radius:10px;
                border:1.5px solid #d1fae5;background:#f0fdf8;
                color:#059669;font-size:1rem;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                transition:all 0.18s ease;
            `;
                btn.innerHTML = `<i class="bi ${icon}"></i>`;
                if (icon === selectedCustomIcon) {
                    btn.style.background = 'linear-gradient(135deg,#34d399,#2dd4bf)';
                    btn.style.color = '#fff';
                    btn.style.borderColor = 'transparent';
                    btn.style.boxShadow = '0 4px 12px rgba(52,211,153,0.4)';
                }
                btn.addEventListener('click', () => {
                    selectedCustomIcon = icon;
                    customIconGrid.querySelectorAll('button').forEach(b => {
                        b.style.background = '#f0fdf8';
                        b.style.color = '#059669';
                        b.style.borderColor = '#d1fae5';
                        b.style.boxShadow = '';
                    });
                    btn.style.background = 'linear-gradient(135deg,#34d399,#2dd4bf)';
                    btn.style.color = '#fff';
                    btn.style.borderColor = 'transparent';
                    btn.style.boxShadow = '0 4px 12px rgba(52,211,153,0.4)';
                });
                customIconGrid.appendChild(btn);
            });
        }

        // ── Build category card ────────────────────────────────────────
        function buildCategoryCard(cat) {
            const colors = CAT_COLOR_MAP[cat.icon_name] || { bg: '#f0fdf4', color: '#16a34a' };
            const isCustomType = cat.type === 'custom';

            const card = document.createElement('div');
            card.className = 'category-card';
            card.setAttribute('data-cat-id', cat.id);
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', cat.name);
            card.dataset.cat = cat.name.toLowerCase();
            card.dataset.icon = cat.icon_name;

            card.innerHTML = `
            <div class="cat-icon-wrap" style="background:${isCustomType ? 'linear-gradient(135deg,#34d399,#2dd4bf)' : colors.bg};color:${isCustomType ? '#fff' : colors.color};">
                <i class="bi ${cat.icon_name}"></i>
            </div>
            <span class="cat-label">${cat.name}</span>
        `;

            card.addEventListener('click', () => selectCategory(cat.id, card));
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectCategory(cat.id, card); });
            return card;
        }

        // ── Build "+" Custom button ────────────────────────────────────
        function buildAddCustomCard() {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.id = 'card-add-custom';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', 'Add custom category');

            card.innerHTML = `
            <div class="cat-icon-wrap" style="background:linear-gradient(135deg,#34d399,#2dd4bf);color:#fff;">
                <i class="bi bi-plus-lg"></i>
            </div>
            <span class="cat-label">Custom</span>
        `;

            card.addEventListener('click', () => {
                // Deselect all categories, show custom panel
                document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedCategoryId = 'custom';
                customPanel.classList.add('visible');
            });
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') card.click(); });
            return card;
        }

        // ── Select category ────────────────────────────────────────────
        function selectCategory(catId, cardEl) {
            document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
            cardEl.classList.add('selected');
            selectedCategoryId = catId;
            customPanel.classList.remove('visible');
        }

        // ── Load categories from API (EMERGENCY FIX: HARDCODED) ─────────
        function loadCategories() {
            if (!requireAuth()) return; // Stop if not authenticated
            
            // 1. Hardcode the Categories (No API Fetching)
            const predefinedCategories = [
                { id: 'art', name: 'Art', icon_name: 'bi-palette', type: 'standard' },
                { id: 'study', name: 'Study', icon_name: 'bi-book', type: 'standard' },
                { id: 'entertain', name: 'Entertain', icon_name: 'bi-controller', type: 'standard' },
                { id: 'meditate', name: 'Meditate', icon_name: 'bi-moon-stars', type: 'standard' },
                { id: 'work', name: 'Work', icon_name: 'bi-briefcase', type: 'standard' },
                { id: 'sport', name: 'Sport', icon_name: 'bi-dribbble', type: 'standard' },
                { id: 'finance', name: 'Finance', icon_name: 'bi-wallet2', type: 'standard' },
            ];

            // 2. Remove the Skeleton/Loading Condition
            categories = predefinedCategories;
            categoryGrid.innerHTML = ''; // Clear skeleton loader instantly

            // Map over predefined categories and render immediately
            predefinedCategories.forEach(cat => {
                categoryGrid.appendChild(buildCategoryCard(cat));
            });

            categoryGrid.appendChild(buildAddCustomCard());
            
            // Auto-select first category
            const firstCard = categoryGrid.querySelector('.category-card');
            if (firstCard) {
                const catId = firstCard.dataset.catId || 'custom';
                selectCategory(catId, firstCard);
            }
        }

        // ── Evaluation method and Counter logic removed ──────────────

        // ── Form validation ────────────────────────────────────────────
        function validateForm() {
            let valid = true;

            // Habit name
            if (!habitName.value.trim()) {
                habitName.classList.add('error');
                errHabitName.style.display = 'block';
                valid = false;
            } else {
                habitName.classList.remove('error');
                errHabitName.style.display = 'none';
            }

            // Category
            if (!selectedCategoryId) {
                showToast('⚠️ Please select a category first.');
                valid = false;
            }

            return valid;
        }

        habitName.addEventListener('input', () => {
            if (habitName.value.trim()) {
                habitName.classList.remove('error');
                errHabitName.style.display = 'none';
            }
        });

        // ── Submit ─────────────────────────────────────────────────────
        btnSubmit.addEventListener('click', async () => {
            if (!validateForm()) return;

            const userId = getUserId();
            if (!userId) {
                showToast('❌ Please login first.');
                setTimeout(() => window.location.href = 'login.html', 1200);
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="bi bi-arrow-repeat" style="font-size:1.1rem;animation:spin 0.8s linear infinite;"></i> Creating…`;

            try {
                let finalCategoryName = '';
                let finalCategoryIcon = '';

                if (selectedCategoryId === 'custom') {
                    finalCategoryName = customCatName.value.trim();
                    finalCategoryIcon = selectedCustomIcon;
                    if (!finalCategoryName) {
                        showToast('⚠️ Please enter a custom category name.');
                        resetSubmitBtn();
                        return;
                    }
                } else {
                    // Extract name and icon from selected category card
                    const selectedCatEl = document.querySelector('.cat-card.selected');
                    if (selectedCatEl) {
                        finalCategoryName = selectedCatEl.dataset.cat || selectedCatEl.querySelector('span').innerText.trim().toLowerCase();
                        finalCategoryIcon = selectedCatEl.dataset.icon;
                    }
                }

                // Create the habit
                const payload = {
                    habit_name: habitName.value.trim(),
                    description: habitDesc.value.trim() || null,
                    category: finalCategoryName,
                    icon: finalCategoryIcon
                };

                const habitResp = await fetch(`${API_BASE}/api/habits`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': userId
                    },
                    body: JSON.stringify(payload)
                });
                const habitData = await habitResp.json();

                if (!habitData.success) throw new Error(habitData.message || 'Failed to create habit');

                // Success! Update local cache if exists
                try {
                    const cached = JSON.parse(localStorage.getItem('habitflow_habits') || '[]');
                    cached.push({
                        id: habitData.habitId,
                        habit_name: payload.habit_name,
                        category_id: habitData.habitId, // Placeholder until refetched
                        evaluation_type: 'checklist'
                    });
                    localStorage.setItem('habitflow_habits', JSON.stringify(cached));
                } catch { }

                showToast('✅ Habit created successfully!');
                btnSubmit.innerHTML = `<i class="bi bi-check-circle-fill" style="font-size:1.1rem;"></i> Created!`;
                btnSubmit.style.background = 'linear-gradient(135deg,#059669,#047857)';

                setTimeout(() => window.location.href = 'index.html', 1100);

            } catch (err) {
                console.error('Create habit error:', err);
                showToast(`❌ ${err.message || 'Failed to create habit. Try again.'}`);
                resetSubmitBtn();
            }
        });

        function resetSubmitBtn() {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="bi bi-plus-circle-fill" style="font-size:1.1rem;"></i> Create Habit`;
            btnSubmit.style.background = '';
        }

        // ── CSS spinner keyframe (injected) ───────────────────────────
        const styleTag = document.createElement('style');
        styleTag.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
        document.head.appendChild(styleTag);

        // ── Init ───────────────────────────────────────────────────────
        buildCustomIconPicker();
        loadCategories();
    