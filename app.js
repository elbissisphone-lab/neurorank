/**
 * Elite Routines - Application Logic V5 (Multi-Function & Penalties)
 */

window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert('GLOBAL ERROR: ' + msg + '\nLine: ' + lineNo + '\nCol: ' + columnNo);
    return false;
};

console.log("NeuroRank Script Loaded");

const App = {
    state: {
        routines: [],
        completions: {}, 
        totalCompleted: 0,
        lastLoginDate: null,
        mastery: {
            "Ni": { xp: 0, level: 1 }, "Ne": { xp: 0, level: 1 },
            "Ti": { xp: 0, level: 1 }, "Te": { xp: 0, level: 1 },
            "Fi": { xp: 0, level: 1 }, "Fe": { xp: 0, level: 1 },
            "Si": { xp: 0, level: 1 }, "Se": { xp: 0, level: 1 }
        }
    },

    init: function() {
        try {
            this.loadData();
            this.processMissedTasks();
            this.updateHeader();
            this.render();
            this.setupEventListeners();
        } catch (e) {
            console.error("App Init Crash: " + e.message);
        }
    },

    loadData: function() {
        const saved = localStorage.getItem('elite_app_state_v5');
        if (saved) {
            this.state = JSON.parse(saved);
        } else {
            // Migration from V3/V4
            const oldSaved = localStorage.getItem('elite_app_state_v3');
            if (oldSaved) {
                const oldData = JSON.parse(oldSaved);
                this.state = { ...this.state, ...oldData };
                
                // Convert single focus string to focus object for all routines
                this.state.routines = this.state.routines.map(r => {
                    if (typeof r.focus === 'string') {
                        return { 
                            ...r, 
                            focus: { primary: r.focus, secondary: 'none', tertiary: 'none' } 
                        };
                    }
                    return r;
                });
            }
            this.saveData();
        }
    },

    saveData: function() {
        localStorage.setItem('elite_app_state_v5', JSON.stringify(this.state));
    },

    getXPRequired: function(level) {
        if (level >= 30) return Infinity;
        return Math.floor(100 + (level * 20));
    },

    processMissedTasks: function() {
        const today = this.getDateKey();
        if (!this.state.lastLoginDate) {
            this.state.lastLoginDate = today;
            this.saveData();
            return;
        }

        if (this.state.lastLoginDate === today) return;

        // Find all dates between lastLogin and today (exclusive of today)
        let d = new Date(this.state.lastLoginDate);
        d.setDate(d.getDate() + 1); // Start with day after last login
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);

        let penaltyApplied = false;

        while (d < todayObj) {
            const dateKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
            const dayOfWeek = d.getDay().toString();
            
            const scheduledRoutines = this.state.routines.filter(r => r.days.includes(dayOfWeek));
            const completedIds = this.state.completions[dateKey] || [];

            scheduledRoutines.forEach(routine => {
                if (!completedIds.includes(routine.id)) {
                    // APPLY 50% PENALTY
                    this.distributeXP(routine, -0.5);
                    penaltyApplied = true;
                }
            });

            d.setDate(d.getDate() + 1);
        }

        this.state.lastLoginDate = today;
        this.saveData();

        if (penaltyApplied) {
            setTimeout(() => alert("DORMANT SESSIONS DETECTED: 50% penalty applied to missed cognitive directives."), 500);
        }
    },

    distributeXP: function(routine, multiplier) {
        // Multiplier is 1.0 for completion, -1.0 for unchecking, -0.5 for penalty
        const baseXP = routine.xpValue || 20;
        const focus = routine.focus;

        // Primary (100%)
        this.addXP(Math.floor(baseXP * multiplier), focus.primary);

        // Secondary (50%)
        if (focus.secondary && focus.secondary !== 'none') {
            this.addXP(Math.floor((baseXP * 0.5) * multiplier), focus.secondary);
        }

        // Tertiary (25%)
        if (focus.tertiary && focus.tertiary !== 'none') {
            this.addXP(Math.floor((baseXP * 0.25) * multiplier), focus.tertiary);
        }
    },

    addXP: function(amount, func) {
        if (!this.state.mastery[func]) return;
        let m = this.state.mastery[func];

        // Cap Level 30
        if (m.level >= 30 && amount > 0) return;

        m.xp += amount;
        if (m.xp < 0 && m.level === 1) m.xp = 0;

        // Level Up
        while (m.xp >= this.getXPRequired(m.level) && m.level < 30) {
            m.xp -= this.getXPRequired(m.level);
            m.level++;
            if (amount > 0) this.showLevelUp(func, m.level); // Only show overlay on positive gain
        }
        
        // Level Down
        while (m.level > 1 && m.xp < 0) {
            m.level--;
            m.xp += this.getXPRequired(m.level);
        }
    },

    toggleTask: function(id) {
        const dateKey = this.getDateKey();
        if (!this.state.completions[dateKey]) this.state.completions[dateKey] = [];

        const index = this.state.completions[dateKey].indexOf(id);
        const routine = this.state.routines.find(r => r.id === id);
        if (!routine) return;

        if (index === -1) {
            this.state.completions[dateKey].push(id);
            this.distributeXP(routine, 1.0);
            this.state.totalCompleted++;
        } else {
            this.state.completions[dateKey].splice(index, 1);
            this.distributeXP(routine, -1.0);
            this.state.totalCompleted = Math.max(0, this.state.totalCompleted - 1);
        }

        this.saveData();
        this.render();
    },

    updateHeader: function() {
        const now = new Date();
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options).toUpperCase();
        
        // Dynamic greeting handled by a specific span if we want, or just leave as is.
        // Let's add a small greeting span below NeuroRank for that premium feel.
        this.updateXPUI();
    },

    updateXPUI: function() {
        const totalLevels = Object.values(this.state.mastery).reduce((sum, m) => sum + m.level, 0);
        const avgLevel = Math.floor(totalLevels / 8);
        const headerLevel = document.getElementById('header-level');
        if (headerLevel) headerLevel.textContent = `Rank ${avgLevel}`;

        const totalCompletedEl = document.getElementById('stat-total-completed');
        const activeRoutinesEl = document.getElementById('stat-active-routines');
        if (totalCompletedEl) totalCompletedEl.textContent = this.state.totalCompleted;
        if (activeRoutinesEl) activeRoutinesEl.textContent = this.state.routines.length;

        this.renderMasteryGrid();
    },

    renderMasteryGrid: function() {
        const viewProgress = document.getElementById('view-progress');
        if (viewProgress && viewProgress.offsetParent === null) return;

        const container = document.getElementById('mastery-grid') || this.createMasteryGrid();
        container.innerHTML = '';

        Object.entries(this.state.mastery).forEach(([func, data]) => {
            const xpReq = this.getXPRequired(data.level);
            const progress = data.level >= 30 ? 100 : (data.xp / xpReq) * 100;
            const card = document.createElement('div');
            card.className = 'function-mastery-card';
            card.innerHTML = `
                <div class="func-header">
                    <span class="func-name">${func} Focus</span>
                    <span class="func-level">LVL ${data.level}</span>
                </div>
                <div class="xp-mini-bar" style="width: 100%; height: 6px; margin: 10px 0;"><div class="xp-mini-fill" style="width: ${progress}%"></div></div>
                <div class="func-xp-text">${data.level >= 30 ? 'MAX' : `${data.xp}/${xpReq} XP`}</div>
            `;
            container.appendChild(card);
        });

        this.renderCalculator();
    },

    renderCalculator: function() {
        const selector = document.getElementById('calc-routine-selector');
        if (!selector) return;

        const currentVal = selector.value;
        selector.innerHTML = '<option value="">Select Routine...</option>';
        
        this.state.routines.forEach(r => {
            const option = document.createElement('option');
            option.value = r.id;
            option.textContent = r.name;
            selector.appendChild(option);
        });

        if (currentVal) selector.value = currentVal;
    },

    calculatePrediction: function() {
        const routineId = document.getElementById('calc-routine-selector').value;
        const targetLevel = parseInt(document.getElementById('calc-level-selector').value);
        const output = document.getElementById('prediction-output');

        if (!routineId) {
            output.innerHTML = '<div class="result-placeholder">Select a routine to analyze path to mastery.</div>';
            return;
        }

        const routine = this.state.routines.find(r => r.id === routineId);
        const primaryFunc = routine.focus.primary;
        const currentData = this.state.mastery[primaryFunc];
        
        if (currentData.level >= targetLevel) {
            output.innerHTML = `<div class="result-placeholder" style="color: var(--gold)">Target achieved. You have already mastered ${primaryFunc} to Level ${targetLevel} or higher.</div>`;
            return;
        }

        // Calculate Cumulative XP Needed
        let totalXPNeeded = 0;
        
        // 1. XP for current level's remainder
        totalXPNeeded += (this.getXPRequired(currentData.level) - currentData.xp);

        // 2. XP for all intermediate levels
        for (let l = currentData.level + 1; l < targetLevel; l++) {
            totalXPNeeded += this.getXPRequired(l);
        }

        const completions = Math.ceil(totalXPNeeded / (routine.xpValue || 20));
        const daysPerWeek = routine.days.length;
        
        let timeEstimate = "";
        if (daysPerWeek > 0) {
            const totalDays = Math.ceil((completions / daysPerWeek) * 7);
            if (totalDays < 30) {
                timeEstimate = `${Math.ceil(totalDays / 7)} Weeks`;
            } else {
                timeEstimate = `${(totalDays / 30.44).toFixed(1)} Months`;
            }
        } else {
            timeEstimate = "Not Scheduled";
        }

        output.innerHTML = `
            <div class="prediction-data">
                <div class="pred-item">
                    <span class="pred-label">Target Mastery [${primaryFunc}]</span>
                    <span class="pred-value">Lvl ${targetLevel}</span>
                </div>
                <div class="pred-item">
                    <span class="pred-label">Required Completions</span>
                    <span class="pred-value">${completions}</span>
                </div>
                <div class="pred-sub">At ${routine.xpValue || 20} XP per session</div>
                <div class="pred-item" style="margin-top: 10px;">
                    <span class="pred-label">Estimated Timeline</span>
                    <span class="pred-value">${timeEstimate}</span>
                </div>
                <div class="pred-sub">Based on ${daysPerWeek} days/week frequency</div>
            </div>
        `;
    },

    createMasteryGrid: function() {
        const view = document.getElementById('view-progress');
        const old = view.querySelector('.mastery-card');
        if (old) old.remove();
        const grid = document.createElement('div');
        grid.id = 'mastery-grid'; grid.className = 'mastery-grid-v3';
        view.insertBefore(grid, view.querySelector('.stats-grid'));
        return grid;
    },

    render: function() {
        this.renderToday();
        this.renderManage();
        this.updateXPUI();
    },

    renderToday: function() {
        const todayList = document.getElementById('today-list');
        const dayOfWeek = new Date().getDay().toString();
        const dateKey = this.getDateKey();

        let todaysTasks = this.state.routines.filter(r => r.days.includes(dayOfWeek));
        todaysTasks.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

        document.getElementById('today-count').textContent = `${todaysTasks.length} DIRECTIVES`;
        todayList.innerHTML = todaysTasks.length === 0 ? '<div class="empty-state">No directives today.</div>' : '';

        todaysTasks.forEach(task => {
            const isChecked = (this.state.completions[dateKey] || []).includes(task.id);
            const card = document.createElement('div');
            card.className = 'task-card';
            const stack = [task.focus.primary, task.focus.secondary, task.focus.tertiary].filter(f => f && f !== 'none').join(' / ');
            card.innerHTML = `
                <div class="task-info">
                    <span class="task-name">${task.name} <span class="xp-tag">+${task.xpValue || 20} XP</span></span>
                    <span class="task-meta">${this.formatTime(task.time || "00:00")} • [${stack}]</span>
                </div>
                <div class="checkbox ${isChecked ? 'checked' : ''}" onclick="App.toggleTask('${task.id}')"></div>
            `;
            todayList.appendChild(card);
        });
    },

    renderManage: function() {
        const fullList = document.getElementById('full-routine-list');
        fullList.innerHTML = this.state.routines.length === 0 ? '<div class="empty-state">No routines architecture defined.</div>' : '';

        this.state.routines.forEach(task => {
            const card = document.createElement('div');
            card.className = 'task-card';
            const stack = [task.focus.primary, task.focus.secondary, task.focus.tertiary].filter(f => f && f !== 'none').join(' / ');
            card.innerHTML = `
                <div class="task-info">
                    <span class="task-name">${task.name} <span class="xp-tag">+${task.xpValue || 20} XP</span></span>
                    <span class="task-meta">${this.formatTime(task.time || "00:00")} • [${stack}]</span>
                </div>
                <div class="task-actions">
                    <button class="btn-edit" onclick="App.editRoutine('${task.id}')">EDIT</button>
                    <button class="btn-delete" onclick="App.deleteRoutine('${task.id}')">REMOVE</button>
                </div>
            `;
            fullList.appendChild(card);
        });
    },

    getDateKey: function() {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    },

    formatTime: function(timeStr) {
        const [hours, mins] = timeStr.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mins} ${ampm}`;
    },

    showLevelUp: function(func, level) {
        const overlay = document.createElement('div');
        overlay.className = 'level-up-overlay';
        overlay.innerHTML = `<h2 class="lu-title">LEVEL UP</h2><p class="lu-func">${func} EVOLUTION</p><div class="level-badge lu-badge">LVL ${level}</div><button class="btn-save lu-btn" onclick="this.parentElement.remove()">CONTINUE</button>`;
        document.body.appendChild(overlay);
    },

    editRoutine: function(id) {
        const routine = this.state.routines.find(r => r.id === id);
        if (!routine) return;

        document.getElementById('editing-task-id').value = routine.id;
        document.getElementById('task-name').value = routine.name;
        document.getElementById('task-focus-primary').value = routine.focus.primary;
        document.getElementById('task-focus-secondary').value = routine.focus.secondary || 'none';
        document.getElementById('task-focus-tertiary').value = routine.focus.tertiary || 'none';
        document.getElementById('task-time').value = routine.time || "08:00";
        document.getElementById('task-importance').value = routine.importance || "6";
        document.getElementById('task-difficulty').value = routine.difficulty || "6";
        document.getElementById('task-duration').value = routine.duration || "30";

        document.querySelectorAll('.days-selector input').forEach(cb => { cb.checked = routine.days.includes(cb.value); });
        document.getElementById('modal-title').textContent = "Edit Routine";
        document.getElementById('btn-submit-task').textContent = "UPDATE ROUTINE";
        openModal();
    },

    deleteRoutine: function(id) {
        if (confirm('Delete this routine architecture?')) {
            this.state.routines = this.state.routines.filter(r => r.id !== id);
            this.saveData();
            this.render();
        }
    },

    setupEventListeners: function() {
        const form = document.getElementById('task-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const id = document.getElementById('editing-task-id').value;
                const name = document.getElementById('task-name').value;
                const focus = {
                    primary: document.getElementById('task-focus-primary').value,
                    secondary: document.getElementById('task-focus-secondary').value,
                    tertiary: document.getElementById('task-focus-tertiary').value
                };
                const time = document.getElementById('task-time').value;
                const importance = document.getElementById('task-importance').value;
                const difficulty = document.getElementById('task-difficulty').value;
                const duration = document.getElementById('task-duration').value;
                const xpValue = parseInt(importance) + parseInt(difficulty) + parseInt(duration);
                const days = Array.from(document.querySelectorAll('.days-selector input:checked')).map(i => i.value);

                if (days.length === 0) return alert('Select at least one day.');

                if (id) {
                    const idx = this.state.routines.findIndex(r => r.id === id);
                    if (idx !== -1) this.state.routines[idx] = { ...this.state.routines[idx], name, focus, days, time, xpValue, importance, difficulty, duration };
                } else {
                    this.state.routines.push({ id: 'rt-' + Date.now(), name, focus, days, time, xpValue, importance, difficulty, duration });
                }

                this.saveData(); this.render(); closeModal();
            };
        }
    }
};

function switchView(viewId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    el.classList.add('active');
    if (viewId === 'progress') App.renderMasteryGrid();
}

function openModal() { document.getElementById('task-modal').classList.add('active'); }
function closeModal() { 
    document.getElementById('task-modal').classList.remove('active'); 
    document.getElementById('task-form').reset();
    document.getElementById('editing-task-id').value = "";
    document.getElementById('modal-title').textContent = "New Task";
    document.getElementById('btn-submit-task').textContent = "ADD ROUTINE";
}

window.onload = () => App.init();

// Aggressive init for iOS
if (document.readyState === "complete" || document.readyState === "interactive") {
    App.init();
} else {
    document.addEventListener("DOMContentLoaded", () => App.init());
}

