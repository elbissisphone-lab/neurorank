/**
 * Elite Routines - Application Logic V5 (Multi-Function & Penalties)
 */

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

            // Migration for XP V6 (Importance/Difficulty x2, Duration 15/45/60)
            if (!this.state.xpSystemV6) {
                this.state.routines = this.state.routines.map(r => {
                    let imp = parseInt(r.importance);
                    if (imp <= 10) r.importance = (imp * 2).toString();
                    
                    let diff = parseInt(r.difficulty);
                    if (diff <= 10) r.difficulty = (diff * 2).toString();
                    
                    let dur = parseInt(r.duration);
                    if (dur === 10) r.duration = "15";
                    else if (dur === 50) r.duration = "45";
                    else if (dur === 80) r.duration = "60";
                    
                    r.xpValue = parseInt(r.importance) + parseInt(r.difficulty) + parseInt(r.duration);
                    return r;
                });
                this.state.xpSystemV6 = true;
                this.saveData();
            }
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
            this.state.xpSystemV6 = true;
            this.saveData();
        }
    },

    saveData: function() {
        localStorage.setItem('elite_app_state_v5', JSON.stringify(this.state));
    },

    getXPRequired: function(level) {
        if (level >= 30) return Infinity;
        return Math.floor(120 + Math.pow(level, 2.5) * 2);
    },

    getFunctionCumulativeXP: function(funcData) {
        let total = funcData.xp;
        for (let l = 1; l < funcData.level; l++) {
            total += this.getXPRequired(l);
        }
        return total;
    },

    getRankInfo: function() {
        const totalXP = Object.values(this.state.mastery).reduce((sum, m) => sum + this.getFunctionCumulativeXP(m), 0);
        let rank = 1;
        let tempXP = totalXP;
        while (rank < 30) {
            let req = this.getXPRequired(rank) * 8;
            if (tempXP >= req) {
                tempXP -= req;
                rank++;
            } else {
                break;
            }
        }
        const nextReq = this.getXPRequired(rank) * 8;
        return { rank, currentXP: tempXP, nextReq, totalXP };
    },

    getRankTitle: function(level) {
        if (level >= 28) return "ELITE";        // Rank 10
        if (level >= 25) return "MASTER";       // Rank 9
        if (level >= 22) return "PROFESSIONAL"; // Rank 8
        if (level >= 19) return "EXPERT";       // Rank 7
        if (level >= 16) return "SPECIALIST";   // Rank 6
        if (level >= 13) return "PRINCIPAL";    // Rank 5
        if (level >= 10) return "LEAD";         // Rank 4
        if (level >= 7)  return "SENIOR";       // Rank 3
        if (level >= 4)  return "ASSOCIATE";    // Rank 2
        return "JUNIOR";                        // Rank 1
    },

    processMissedTasks: function() {
        const today = this.getDateKey();
        if (!this.state.lastLoginDate) {
            this.state.lastLoginDate = today;
            this.saveData();
            return;
        }

        if (this.state.lastLoginDate === today) return;

        let d = new Date(this.state.lastLoginDate);
        d.setDate(d.getDate() + 1);
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
                    this.distributeXP(routine, -0.5);
                    penaltyApplied = true;
                }
            });

            d.setDate(d.getDate() + 1);
        }

        this.state.lastLoginDate = today;
        this.saveData();

        if (penaltyApplied) {
            setTimeout(() => {
                this.showAlert("DORMANT SESSIONS", "Significant inactivity detected. A 50% XP penalty has been applied to missed cognitive directives.");
            }, 500);
        }
    },

    distributeXP: function(routine, multiplier) {
        const baseXP = routine.xpValue || 20;
        const focus = routine.focus;
        this.addXP(Math.floor(baseXP * multiplier), focus.primary);
        if (focus.secondary && focus.secondary !== 'none') {
            this.addXP(Math.floor((baseXP * 0.5) * multiplier), focus.secondary);
        }
        if (focus.tertiary && focus.tertiary !== 'none') {
            this.addXP(Math.floor((baseXP * 0.25) * multiplier), focus.tertiary);
        }
    },

    addXP: function(amount, func) {
        if (!this.state.mastery[func]) return;
        let m = this.state.mastery[func];
        if (m.level >= 30 && amount > 0) return;
        m.xp += amount;
        if (m.xp < 0 && m.level === 1) m.xp = 0;
        while (m.xp >= this.getXPRequired(m.level) && m.level < 30) {
            m.xp -= this.getXPRequired(m.level);
            m.level++;
            if (amount > 0) this.showLevelUp(func, m.level);
        }
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
        this.updateXPUI();
    },

    updateXPUI: function() {
        const rankInfo = this.getRankInfo();
        const headerLevel = document.getElementById('header-level');
        if (headerLevel) headerLevel.textContent = `RANK ${rankInfo.rank}`;
        const headerFill = document.getElementById('header-xp-fill');
        if (headerFill) {
            const headerProgress = (rankInfo.currentXP / rankInfo.nextReq) * 100;
            headerFill.style.width = `${headerProgress}%`;
        }
        const totalCompletedEl = document.getElementById('stat-total-completed');
        const activeRoutinesEl = document.getElementById('stat-active-routines');
        if (totalCompletedEl) totalCompletedEl.textContent = this.state.totalCompleted;
        if (activeRoutinesEl) activeRoutinesEl.textContent = this.state.routines.length;
        const masteryLevel = document.getElementById('mastery-level');
        const masteryRank = document.querySelector('.mastery-rank');
        const xpRatio = document.getElementById('xp-ratio');
        const masteryFill = document.getElementById('mastery-xp-fill');
        if (masteryLevel) masteryLevel.textContent = `RANK ${rankInfo.rank}`;
        if (masteryRank) masteryRank.textContent = this.getRankTitle(rankInfo.rank);
        if (xpRatio) xpRatio.textContent = `${Math.floor(rankInfo.currentXP)} / ${rankInfo.nextReq} XP`;
        if (masteryFill) {
            const progress = (rankInfo.currentXP / rankInfo.nextReq) * 100;
            masteryFill.style.width = `${progress}%`;
        }
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
            card.innerHTML = `<div class="func-header"><span class="func-name">${func} Level</span><span class="func-level">LVL ${data.level}</span></div><div class="xp-mini-bar" style="width: 100%; height: 6px; margin: 10px 0;"><div class="xp-mini-fill" style="width: ${progress}%"></div></div><div class="func-xp-text">${data.level >= 30 ? 'MAX' : `${data.xp}/${xpReq} XP`}</div>`;
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
            option.value = r.id; option.textContent = r.name;
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
        let totalXPNeeded = (this.getXPRequired(currentData.level) - currentData.xp);
        for (let l = currentData.level + 1; l < targetLevel; l++) { totalXPNeeded += this.getXPRequired(l); }
        const completions = Math.ceil(totalXPNeeded / (routine.xpValue || 20));
        const daysPerWeek = routine.days.length;
        let timeEstimate = "";
        if (daysPerWeek > 0) {
            const totalDays = Math.ceil((completions / daysPerWeek) * 7);
            timeEstimate = totalDays < 30 ? `${Math.ceil(totalDays / 7)} Weeks` : `${(totalDays / 30.44).toFixed(1)} Months`;
        } else {
            timeEstimate = "Not Scheduled";
        }
        output.innerHTML = `<div class="prediction-data"><div class="pred-item"><span class="pred-label">Target Level [${primaryFunc}]</span><span class="pred-value">Lvl ${targetLevel}</span></div><div class="pred-item"><span class="pred-label">Required Completions</span><span class="pred-value">${completions}</span></div><div class="pred-sub">At ${routine.xpValue || 20} XP per session</div><div class="pred-item" style="margin-top: 10px;"><span class="pred-label">Estimated Timeline</span><span class="pred-value">${timeEstimate}</span></div><div class="pred-sub">Based on ${daysPerWeek} days/week frequency</div></div>`;
    },

    createMasteryGrid: function() {
        const view = document.getElementById('view-progress');
        let grid = document.getElementById('mastery-grid');
        if (!grid) {
            grid = document.createElement('div');
            grid.id = 'mastery-grid'; grid.className = 'mastery-grid-v3';
            const masteryCard = view.querySelector('.mastery-card');
            if (masteryCard) { masteryCard.after(grid); } else { view.prepend(grid); }
        }
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
            card.onclick = () => this.toggleTask(task.id);
            const stack = [task.focus.primary, task.focus.secondary, task.focus.tertiary].filter(f => f && f !== 'none').join(' / ');
            card.innerHTML = `<div class="task-info"><span class="task-name">${task.name} <span class="xp-tag">+${task.xpValue || 20} XP</span></span><span class="task-meta">${this.formatTime(task.time || "00:00")} • [${stack}]</span></div><div class="checkbox ${isChecked ? 'checked' : ''}"></div>`;
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
            card.innerHTML = `<div class="task-info"><span class="task-name">${task.name} <span class="xp-tag">+${task.xpValue || 20} XP</span></span><span class="task-meta">${this.formatTime(task.time || "00:00")} • [${stack}]</span></div><div class="task-actions"><button class="btn-edit" onclick="App.editRoutine('${task.id}')">EDIT</button><button class="btn-delete" onclick="App.deleteRoutine('${task.id}')">REMOVE</button></div>`;
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
        document.getElementById('task-importance').value = routine.importance || "12";
        document.getElementById('task-difficulty').value = routine.difficulty || "12";
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

        const resetBtn = document.getElementById('reset-btn');
        const resetFill = document.getElementById('reset-fill');
        if (resetBtn && resetFill) {
            let resetTimer = null;
            let resetStartTime = 0;
            const startReset = (e) => {
                e.preventDefault();
                resetStartTime = Date.now();
                resetFill.style.width = '0%';
                resetBtn.textContent = "RESETTING DATA...";
                resetBtn.style.background = "rgba(255, 68, 68, 0.15)";
                resetTimer = setInterval(() => {
                    const elapsed = Date.now() - resetStartTime;
                    const progress = Math.min((elapsed / 5000) * 100, 100);
                    resetFill.style.width = progress + '%';
                    if (elapsed >= 5000) { clearInterval(resetTimer); this.hardReset(); }
                }, 50);
            };
            const cancelReset = () => {
                if (resetTimer) {
                    clearInterval(resetTimer);
                    resetTimer = null;
                    resetFill.style.width = '0%';
                    resetBtn.textContent = "RESET ALL PROGRESS (HOLD 5S)";
                    resetBtn.style.background = "none";
                }
            };
            resetBtn.addEventListener('pointerdown', startReset);
            resetBtn.addEventListener('pointerup', cancelReset);
            resetBtn.addEventListener('pointerleave', cancelReset);
            resetBtn.addEventListener('pointercancel', cancelReset);
            resetBtn.addEventListener('contextmenu', e => e.preventDefault());
        }
    },

    showAlert: function(title, message, callback = null) {
        const existing = document.querySelector('.custom-alert');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert';
        overlay.innerHTML = `<div class="alert-card"><h3 class="alert-title">${title}</h3><p class="alert-msg">${message}</p><button class="alert-btn" id="alert-confirm-btn" style="cursor: pointer; -webkit-appearance: none;">CONTINUE</button></div>`;
        document.body.appendChild(overlay);
        const btn = document.getElementById('alert-confirm-btn');
        const handleConfirm = (e) => { if (e) e.preventDefault(); overlay.remove(); if (callback) callback(); };
        btn.addEventListener('click', handleConfirm);
        btn.addEventListener('touchend', handleConfirm);
    },

    hardReset: function() {
        localStorage.clear();
        this.showAlert("SYSTEM RESET", "All application data and progress have been successfully cleared.", () => {
            window.location.reload();
        });
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
App.init();
