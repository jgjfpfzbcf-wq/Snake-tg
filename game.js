// ============ TELEGRAM ============
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#1c1c1e');
}

// ============ КОНСТАНТЫ ============
const GRID = 20;

const FOOD_TYPES = {
    NORMAL: { color: '#ff453a', points: 10, chance: 0.80, cssClass: 'food-normal' },
    GOLD:   { color: '#ffd700', points: 50, chance: 0.15, cssClass: 'food-gold' },
    SLOW:   { color: '#0a84ff', points: 5,  chance: 0.05, cssClass: 'food-slow' },
};

const SKINS = [
    { id: 'green',  name: 'Классика', color: '#30d158', unlock: { type: 'default' } },
    { id: 'blue',   name: 'Океан',    color: '#0a84ff', unlock: { type: 'score', value: 50 } },
    { id: 'purple', name: 'Аметист',  color: '#bf5af2', unlock: { type: 'score', value: 150 } },
    { id: 'orange', name: 'Закат',    color: '#ff9f0a', unlock: { type: 'score', value: 300 } },
    { id: 'rainbow',name: 'Радуга',   color: 'rainbow', unlock: { type: 'achievement', value: 'score_500' } },
];

const ACHIEVEMENTS = [
    { id: 'first_game',  icon: '🎮', name: 'Первый шаг',       desc: 'Сыграть первую игру' },
    { id: 'score_50',    icon: '⭐', name: 'Разогрев',         desc: 'Набрать 50 очков' },
    { id: 'score_100',   icon: '🌟', name: 'Сотня',            desc: 'Набрать 100 очков' },
    { id: 'score_500',   icon: '💫', name: 'Мастер',           desc: 'Набрать 500 очков' },
    { id: 'gold_1',      icon: '🥇', name: 'Золотая жила',     desc: 'Съесть первое золотое яблоко' },
    { id: 'gold_10',     icon: '👑', name: 'Коллекционер',     desc: 'Съесть 10 золотых яблок' },
    { id: 'long_20',     icon: '🐍', name: 'Длинная змейка',   desc: 'Достичь длины 20' },
    { id: 'no_walls',    icon: '🌌', name: 'Вне границ',       desc: 'Побывать в режиме «Без стен»' },
];

const TASK_POOL = [
    { id: 'score_100_run',  title: 'Набрать 100 очков за игру',  target: 100, reward: 20, type: 'score' },
    { id: 'score_200_run',  title: 'Набрать 200 очков за игру',  target: 200, reward: 40, type: 'score' },
    { id: 'eat_5_gold',     title: 'Съесть 5 золотых яблок',      target: 5,   reward: 30, type: 'gold' },
    { id: 'eat_20_normal',  title: 'Съесть 20 обычных яблок',     target: 20,  reward: 15, type: 'normal' },
    { id: 'length_15',      title: 'Достичь длины 15',            target: 15,  reward: 25, type: 'length' },
    { id: 'play_3_games',   title: 'Сыграть 3 игры',              target: 3,   reward: 10, type: 'games' },
    { id: 'score_50_twice', title: 'Дважды набрать 50 очков',     target: 2,   reward: 20, type: 'score50' },
    { id: 'eat_3_slow',     title: 'Съесть 3 бонуса замедления',  target: 3,   reward: 20, type: 'slow' },
];

// ============ УТИЛИТЫ ============
const $ = id => document.getElementById(id);
const LS = {
    get(key, def) {
        try { const v = localStorage.getItem('snake_' + key); return v ? JSON.parse(v) : def; }
        catch { return def; }
    },
    set(key, val) {
        try { localStorage.setItem('snake_' + key, JSON.stringify(val)); } catch {}
    }
};

// ============ ЗВУК ============
class Sound {
    constructor() {
        this.ctx = null;
        this.enabled = LS.get('sound', true);
    }
    init() {
        if (!this.ctx) {
            try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
        }
    }
    play(freq, duration = 0.08, type = 'sine', volume = 0.15) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch {}
    }
    eat() { this.play(600, 0.08, 'sine', 0.15); setTimeout(() => this.play(900, 0.08), 60); }
    gold() { this.play(800, 0.06); setTimeout(() => this.play(1100, 0.08), 60); setTimeout(() => this.play(1500, 0.1), 130); }
    slow() { this.play(400, 0.15, 'triangle', 0.12); }
    gameOver() { this.play(300, 0.2, 'sawtooth', 0.1); setTimeout(() => this.play(200, 0.3, 'sawtooth', 0.1), 100); }
    achievement() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.play(f, 0.12, 'sine', 0.15), i * 80)); }
    click() { this.play(700, 0.04, 'square', 0.08); }
}
const sound = new Sound();

// ============ ХЕЛПЕРЫ UI ============
function toast(text) {
    const container = document.querySelector('.toast-container') || (() => {
        const c = document.createElement('div');
        c.className = 'toast-container';
        document.body.appendChild(c);
        return c;
    })();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function vibrate(ms = 15) {
    if (!LS.get('vibration', true)) return;
    if (tg?.HapticFeedback) { try { tg.HapticFeedback.impactOccurred('light'); } catch {} }
    if (navigator.vibrate) navigator.vibrate(ms);
}

// ============ ИГРА ============
class SnakeGame {
    constructor() {
        this.boardEl = $('board');
        this.settings = {
            noWalls: LS.get('noWalls', false),
            mazeEnabled: LS.get('mazeEnabled', true),
            sound: LS.get('sound', true),
            vibration: LS.get('vibration', true),
        };
        sound.enabled = this.settings.sound;

        this.topScores = LS.get('top', []);
        this.achievements = LS.get('achievements', {});
        this.skins = LS.get('skins', { active: 'green' });
        this.totalGold = LS.get('totalGold', 0);
        this.maxScore = LS.get('maxScore', 0);
        this.tasks = this.loadTasks();

        this.snake = [];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.food = null;
        this.foodType = 'NORMAL';
        this.maze = [];
        this.score = 0;
        this.speed = 150;
        this.baseSpeed = 150;
        this.running = false;
        this.paused = false;
        this.over = false;
        this.lastTick = 0;
        this.slowUntil = 0;

        this.initUI();
        this.bindEvents();
        this.updateBestUI();
        this.buildGrid();
    }

    buildGrid() {
        this.boardEl.innerHTML = '';
        for (let i = 0; i < GRID * GRID; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${i}`;
            this.boardEl.appendChild(cell);
        }
    }

    initUI() {
        $('btn-play').onclick = () => {
            sound.click();
            $('screen-main').classList.remove('active');
            $('screen-game').classList.add('active');
            this.start();
        };

        $('btn-menu').onclick = () => { sound.click(); this.togglePause(); $('modal-menu').classList.remove('hidden'); };
        $('menu-resume').onclick = () => { sound.click(); $('modal-menu').classList.add('hidden'); this.togglePause(); };
        $('menu-restart').onclick = () => { sound.click(); $('modal-menu').classList.add('hidden'); this.start(); };
        $('menu-exit').onclick = () => {
            sound.click();
            $('modal-menu').classList.add('hidden');
            $('screen-game').classList.remove('active');
            $('screen-main').classList.add('active');
            this.running = false;
            this.paused = false;
            this.updateBestUI();
        };

        $('menu-top').onclick = () => { sound.click(); this.showTop(); };
        $('menu-skins').onclick = () => { sound.click(); this.showSkins(); };
        $('menu-settings').onclick = () => { sound.click(); this.showSettings(); };
        $('menu-tasks').onclick = () => { sound.click(); this.showTasks(); };
        $('menu-achievements').onclick = () => { sound.click(); this.showAchievements(); };

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => {
                sound.click();
                btn.closest('.modal').classList.add('hidden');
            };
        });

        $('overlay-btn').onclick = () => {
            sound.click();
            if (this.over) {
                this.start();
            } else {
                $('overlay').classList.add('hidden');
                this.togglePause();
            }
        };

        $('toggle-walls').checked = this.settings.noWalls;
        $('toggle-maze').checked = this.settings.mazeEnabled;
        $('toggle-sound').checked = this.settings.sound;
        $('toggle-vibration').checked = this.settings.vibration;

        $('toggle-walls').onchange = (e) => { this.settings.noWalls = e.target.checked; LS.set('noWalls', this.settings.noWalls); };
        $('toggle-maze').onchange = (e) => { this.settings.mazeEnabled = e.target.checked; LS.set('mazeEnabled', this.settings.mazeEnabled); };
        $('toggle-sound').onchange = (e) => { this.settings.sound = e.target.checked; LS.set('sound', this.settings.sound); sound.enabled = this.settings.sound; sound.click(); };
        $('toggle-vibration').onchange = (e) => { this.settings.vibration = e.target.checked; LS.set('vibration', this.settings.vibration); vibrate(); };
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
            if (map[e.key]) { e.preventDefault(); this.setDirection(map[e.key]); }
        });

        let sx = 0, sy = 0;
        this.boardEl.addEventListener('touchstart', (e) => {
            const t = e.changedTouches[0];
            sx = t.clientX; sy = t.clientY;
        }, { passive: true });

        this.boardEl.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            const dx = t.clientX - sx;
            const dy = t.clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
            if (Math.abs(dx) > Math.abs(dy)) this.setDirection(dx > 0 ? 'right' : 'left');
            else this.setDirection(dy > 0 ? 'down' : 'up');
        }, { passive: true });

        document.querySelectorAll('.dpad-btn').forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.setDirection(btn.getAttribute('data-dir'));
                sound.click();
            });
        });
    }

    setDirection(dirName) {
        if (!this.running || this.paused || this.over) return;
        const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
        const d = map[dirName];
        if (d.x === -this.dir.x && d.y === -this.dir.y) return;
        this.nextDir = d;
    }

    start() {
        this.snake = [{ x: 10, y: 10 }];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.score = 0;
        this.speed = this.baseSpeed;
        this.slowUntil = 0;
        this.over = false;
        this.paused = false;
        this.running = true;
        this.maze = [];
        
        $('overlay').classList.add('hidden');
        this.spawnFood();
        this.updateScoreUI();
        this.render(); // Первая отрисовка
        this.lastTick = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    togglePause() {
        if (!this.running || this.over) return;
        this.paused = !this.paused;
        if (this.paused) {
            $('overlay-title').textContent = 'Пауза';
            $('overlay-text').textContent = 'Отдохните немного';
            $('overlay-btn').textContent = 'Продолжить';
            $('overlay').classList.remove('hidden');
        } else {
            $('overlay').classList.add('hidden');
            this.lastTick = performance.now();
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    loop(now) {
        if (!this.running || this.paused || this.over) return;
        const speed = now < this.slowUntil ? this.speed * 1.8 : this.speed;
        if (now - this.lastTick >= speed) {
            this.lastTick = now;
            this.tick();
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    tick() {
        this.dir = { ...this.nextDir };
        let head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

        if (this.settings.noWalls) {
            if (head.x < 0) head.x = GRID - 1;
            if (head.x >= GRID) head.x = 0;
            if (head.y < 0) head.y = GRID - 1;
            if (head.y >= GRID) head.y = 0;
        } else {
            if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return this.gameOver();
        }

        if (this.snake.some(s => s.x === head.x && s.y === head.y)) return this.gameOver();
        if (this.maze.some(m => m.x === head.x && m.y === head.y)) return this.gameOver();

        this.snake.unshift(head);

        if (this.food && head.x === this.food.x && head.y === this.food.y) {
            const ft = FOOD_TYPES[this.foodType];
            this.score += ft.points;

            if (this.foodType === 'GOLD') {
                this.totalGold++;
                LS.set('totalGold', this.totalGold);
                sound.gold();
                this.updateTaskProgress('gold', 1);
                this.unlockAchievement('gold_1');
                if (this.totalGold >= 10) this.unlockAchievement('gold_10');
            } else if (this.foodType === 'SLOW') {
                this.slowUntil = performance.now() + 5000;
                sound.slow();
                this.updateTaskProgress('slow', 1);
            } else {
                sound.eat();
                this.updateTaskProgress('normal', 1);
            }
            vibrate();

            if (Math.floor(this.score / 50) > Math.floor((this.score - ft.points) / 50)) {
                this.speed = Math.max(70, this.speed - 8);
            }

            if (this.settings.mazeEnabled && this.score >= 100 && this.maze.length === 0) {
                this.spawnMaze();
            }

            this.updateTaskProgress('score', this.score);
            this.updateTaskProgress('length', this.snake.length);
            if (this.snake.length >= 20) this.unlockAchievement('long_20');

            this.spawnFood();
            this.updateScoreUI();
            this.checkNewRecord();
        } else {
            this.snake.pop();
        }
        
        this.render(); // Отрисовка после каждого шага
    }

    spawnMaze() {
        this.maze = [];
        const count = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const x = 4 + Math.floor(Math.random() * (GRID - 8));
            const y = 4 + Math.floor(Math.random() * (GRID - 8));
            if (this.snake.some(s => Math.abs(s.x - x) < 2 && Math.abs(s.y - y) < 2)) continue;
            if (this.food && this.food.x === x && this.food.y === y) continue;
            if (this.maze.some(m => m.x === x && m.y === y)) continue;
            this.maze.push({ x, y });
        }
    }

    spawnFood() {
        const empty = [];
        for (let x = 0; x < GRID; x++)
            for (let y = 0; y < GRID; y++)
                if (!this.snake.some(s => s.x === x && s.y === y) && !this.maze.some(m => m.x === x && m.y === y))
                    empty.push({ x, y });
        if (!empty.length) return this.gameOver();

        this.food = empty[Math.floor(Math.random() * empty.length)];
        const r = Math.random();
        if (r < FOOD_TYPES.GOLD.chance) this.foodType = 'GOLD';
        else if (r < FOOD_TYPES.GOLD.chance + FOOD_TYPES.SLOW.chance) this.foodType = 'SLOW';
        else this.foodType = 'NORMAL';
    }

    gameOver() {
        this.running = false;
        this.over = true;
        sound.gameOver();
        vibrate(200);

        this.saveScore(this.score);
        this.updateTaskProgress('games', 1);
        this.unlockAchievement('first_game');
        if (this.score >= 50) this.unlockAchievement('score_50');
        if (this.score >= 100) this.unlockAchievement('score_100');
        if (this.score >= 500) this.unlockAchievement('score_500');

        if (this.score > this.maxScore) {
            this.maxScore = this.score;
            LS.set('maxScore', this.maxScore);
        }

        const isRecord = this.score > 0 && this.score === this.topScores[0]?.score;
        $('overlay-title').textContent = isRecord ? '🏆 Новый рекорд!' : 'Игра окончена';
        $('overlay-text').textContent = `Ваш счёт: ${this.score}`;
        $('overlay-btn').textContent = 'Играть снова';
        $('overlay').classList.remove('hidden');
    }

    updateScoreUI() {
        $('score').textContent = this.score;
        const best = this.topScores[0]?.score || 0;
        if (this.score > best) { $('best').textContent = this.score; }
    }

    updateBestUI() {
        const best = this.topScores[0]?.score || 0;
        $('main-best').textContent = best;
        $('best').textContent = best;
    }

    checkNewRecord() {
        const prevBest = this.topScores[0]?.score || 0;
        if (this.score > prevBest) { vibrate(150); }
    }

    saveScore(score) {
        if (score <= 0) return;
        const entry = { score, date: new Date().toLocaleDateString('ru-RU') };
        this.topScores.push(entry);
        this.topScores.sort((a, b) => b.score - a.score);
        this.topScores = this.topScores.slice(0, 10);
        LS.set('top', this.topScores);
        this.updateBestUI();
    }

    unlockAchievement(id) {
        if (this.achievements[id]) return;
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (!ach) return;
        this.achievements[id] = true;
        LS.set('achievements', this.achievements);
        sound.achievement();
        vibrate(100);
        toast(`${ach.icon} Достижение: ${ach.name}`);
    }

    loadTasks() {
        const today = new Date().toDateString();
        const saved = LS.get('tasks', null);
        if (saved && saved.date === today) return saved;
        const shuffled = [...TASK_POOL].sort(() => Math.random() - 0.5);
        const tasks = shuffled.slice(0, 3).map(t => ({ ...t, progress: 0, done: false }));
        const data = { date: today, tasks };
        LS.set('tasks', data);
        return data;
    }

    updateTaskProgress(type, amount = 1) {
        let changed = false;
        this.tasks.tasks.forEach(t => {
            if (t.done) return;
            if (t.type === type) {
                t.progress = Math.min(t.target, t.progress + amount);
                if (t.progress >= t.target) { t.done = true; toast(`✅ Задание: ${t.title}`); }
                changed = true;
            }
        });
        if (changed) LS.set('tasks', this.tasks);
    }

    showTop() {
        const list = $('top-list');
        list.innerHTML = '';
        if (!this.topScores.length) {
            list.innerHTML = '<li style="justify-content:center">Пока нет рекордов</li>';
        } else {
            this.topScores.forEach((entry, i) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>#${i + 1} — ${entry.score}</span><span class="date">${entry.date}</span>`;
                list.appendChild(li);
            });
        }
        $('modal-top').classList.remove('hidden');
    }

    showSkins() {
        const list = $('skins-list');
        list.innerHTML = '';
        SKINS.forEach(skin => {
            const unlocked = skin.unlock.type === 'default' || 
                             (skin.unlock.type === 'score' && this.maxScore >= skin.unlock.value) ||
                             (skin.unlock.type === 'achievement' && this.achievements[skin.unlock.value]);
            const active = this.skins.active === skin.id && unlocked;
            
            const card = document.createElement('div');
            card.className = `skin-card ${unlocked ? '' : 'locked'} ${active ? 'active' : ''}`;
            
            let preview = '';
            if (skin.color === 'rainbow') {
                preview = `<div class="skin-dot" style="background:linear-gradient(45deg,#ff453a,#ffd700,#30d158)"></div>`;
            } else {
                preview = `<div class="skin-dot" style="background:${skin.color}"></div>`;
            }

            card.innerHTML = `
                <div class="skin-preview">${preview}</div>
                <div class="skin-name">${skin.name}</div>
                <div class="skin-status">${active ? 'Активен' : unlocked ? 'Выбрать' : 'Закрыт'}</div>
            `;
            
            if (unlocked) {
                card.onclick = () => {
                    sound.click();
                    this.skins.active = skin.id;
                    LS.set('skins', this.skins);
                    this.showSkins();
                    this.render(); // Перерисовать змейку новым цветом
                };
            }
            list.appendChild(card);
        });
        $('modal-skins').classList.remove('hidden');
    }

    showSettings() { $('modal-settings').classList.remove('hidden'); }

    showTasks() {
        const list = $('tasks-list');
        const reset = $('tasks-reset');
        list.innerHTML = '';
        
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        reset.textContent = `Обновление через ${Math.ceil((tomorrow - now) / 3600000)} ч.`;

        this.tasks.tasks.forEach(t => {
            const card = document.createElement('div');
            card.className = `task-card ${t.done ? 'completed' : ''}`;
            const progress = t.done ? 100 : (t.progress / t.target) * 100;
            card.innerHTML = `
                <div class="task-title">${t.done ? '✅ ' : ''}${t.title}</div>
                <div class="task-progress"><div class="task-progress-bar" style="width:${progress}%"></div></div>
                <div class="task-meta"><span>${t.progress}/${t.target}</span><span>+${t.reward} 🏅</span></div>
            `;
            list.appendChild(card);
        });
        $('modal-tasks').classList.remove('hidden');
    }

    showAchievements() {
        const list = $('achievements-list');
        list.innerHTML = '';
        ACHIEVEMENTS.forEach(ach => {
            const unlocked = this.achievements[ach.id];
            const el = document.createElement('div');
            el.className = `achievement ${unlocked ? '' : 'locked'}`;
            el.innerHTML = `
                <div class="achievement-icon">${unlocked ? ach.icon : '🔒'}</div>
                <div>
                    <div class="achievement-name">${ach.name}</div>
                    <div class="achievement-desc">${ach.desc}</div>
                </div>
            `;
            list.appendChild(el);
        });
        $('modal-achievements').classList.remove('hidden');
    }

    // --- РЕНДЕР БЕЗ CANVAS ---
    render() {
        // Очищаем все ячейки
        for (let i = 0; i < GRID * GRID; i++) {
            $('cell-' + i).className = 'cell';
        }

        // Лабиринт
        this.maze.forEach(m => {
            const idx = m.y * GRID + m.x;
            $('cell-' + idx).classList.add('maze');
        });

        // Еда
        if (this.food) {
            const idx = this.food.y * GRID + this.food.x;
            const cell = $('cell-' + idx);
            cell.classList.add(FOOD_TYPES[this.foodType].cssClass);
        }

        // Змейка
        const skin = SKINS.find(s => s.id === this.skins.active) || SKINS[0];
        this.snake.forEach((seg, i) => {
            const idx = seg.y * GRID + seg.x;
            const cell = $('cell-' + idx);
            
            if (i === 0) {
                cell.classList.add('snake-head');
                if (skin.color === 'rainbow') {
                    cell.style.background = 'hsl(' + ((performance.now() / 10) % 360) + ', 80%, 60%)';
                } else {
                    cell.style.background = skin.color;
                }
            } else {
                cell.classList.add('snake-body');
                if (skin.color === 'rainbow') {
                    cell.style.background = 'hsl(' + ((performance.now() / 10 + i * 20) % 360) + ', 80%, 50%)';
                } else {
                    cell.style.background = skin.color;
                    cell.style.opacity = 0.6 + (1 - i / this.snake.length) * 0.4;
                }
            }
        });

        // Индикаторы
        $('slow-indicator').classList.toggle('hidden', performance.now() >= this.slowUntil);
        $('maze-indicator').classList.toggle('hidden', this.maze.length === 0);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.SnakeGameInstance) return;
    window.SnakeGameInstance = new SnakeGame();
});
