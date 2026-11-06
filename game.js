// ============ TELEGRAM ============
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#1c1c1e');
}

// ============ КОНСТАНТЫ ============
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const GRID = 20;

const COLORS = {
    bg: '#2c2c2e',
    grid: 'rgba(255, 255, 255, 0.03)',
    snakeHead: '#30d158',
    snakeBody: '#28b74d',
    food: '#ff453a',
    gold: '#ffd700',
    slow: '#0a84ff',
    maze: '#bf5af2',
    particle: '#ffffff'
};

const FOOD_TYPES = {
    NORMAL: { color: COLORS.food, points: 10, chance: 0.80 },
    GOLD:   { color: COLORS.gold, points: 50, chance: 0.15 },
    SLOW:   { color: COLORS.slow, points: 5,  chance: 0.05 },
};

const SKINS = [
    { id: 'green',  name: 'Классика', color: '#30d158', head: '#30d158', unlock: { type: 'default' } },
    { id: 'blue',   name: 'Океан',    color: '#0a84ff', head: '#0a84ff', unlock: { type: 'score', value: 50 } },
    { id: 'purple', name: 'Аметист',  color: '#bf5af2', head: '#bf5af2', unlock: { type: 'score', value: 150 } },
    { id: 'orange', name: 'Закат',    color: '#ff9f0a', head: '#ff9f0a', unlock: { type: 'score', value: 300 } },
    { id: 'rainbow',name: 'Радуга',   color: 'rainbow', head: '#ffffff', unlock: { type: 'achievement', value: 'score_500' } },
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
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Состояние игры
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
        this.particles = [];
        this.slowUntil = 0;
        this.newBest = false;
        this.gameStats = { gold: 0, normal: 0, slow: 0 };

        // Настройки
        this.settings = {
            noWalls: LS.get('noWalls', false),
            mazeEnabled: LS.get('mazeEnabled', true),
            sound: LS.get('sound', true),
            vibration: LS.get('vibration', true),
        };
        sound.enabled = this.settings.sound;

        // Прогресс
        this.topScores = LS.get('top', []);
        this.achievements = LS.get('achievements', {});
        this.skins = LS.get('skins', { active: 'green' });
        this.totalGold = LS.get('totalGold', 0);
        this.maxScore = LS.get('maxScore', 0);
        this.tasks = this.loadTasks();

        this.initUI();
        this.bindEvents();
        this.updateBestUI();
        this.draw(); // Отрисовать пустое поле на фоне
    }

    resize() {
        const size = canvas.clientWidth;
        if (!size) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.tileSize = size / GRID;
        this.canvasSize = size;
        if (this.running) this.draw();
    }

    // ---------- UI ИНИЦИАЛИЗАЦИЯ ----------
    initUI() {
        // Экраны
        $('btn-play').onclick = () => {
            sound.click();
            $('screen-main').classList.remove('active');
            $('screen-game').classList.add('active');
            setTimeout(() => this.resize(), 50); // Пересчитать размер canvas
            this.start();
        };

        // Меню
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

        // Открытие модалок из меню
        $('menu-top').onclick = () => { sound.click(); this.showTop(); };
        $('menu-skins').onclick = () => { sound.click(); this.showSkins(); };
        $('menu-settings').onclick = () => { sound.click(); this.showSettings(); };
        $('menu-tasks').onclick = () => { sound.click(); this.showTasks(); };
        $('menu-achievements').onclick = () => { sound.click(); this.showAchievements(); };

        // Закрытие модалок
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => {
                sound.click();
                btn.closest('.modal').classList.add('hidden');
            };
        });

        // Оверлей (пауза / смерть)
        $('overlay-btn').onclick = () => {
            sound.click();
            if (this.over) {
                this.start();
            } else {
                $('overlay').classList.add('hidden');
                this.togglePause();
            }
        };

        // Настройки
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
        // Клавиатура
        document.addEventListener('keydown', (e) => {
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
            if (map[e.key]) { e.preventDefault(); this.setDirection(map[e.key]); }
        });

        // Свайпы
        let sx = 0, sy = 0;
        canvas.addEventListener('touchstart', (e) => {
            const t = e.changedTouches[0];
            sx = t.clientX; sy = t.clientY;
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            const dx = t.clientX - sx;
            const dy = t.clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
            if (Math.abs(dx) > Math.abs(dy)) this.setDirection(dx > 0 ? 'right' : 'left');
            else this.setDirection(dy > 0 ? 'down' : 'up');
        }, { passive: true });

        // Джойстик
        document.querySelectorAll('.dpad-btn').forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.setDirection(btn.getAttribute('data-dir'));
                sound.click();
            });
        });
    }

    // ---------- ЛОГИКА ИГРЫ ----------
    setDirection(dirName) {
        if (!this.running || this.paused || this.over) return;
        const map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
        const d = map[dirName];
        if (d.x === -this.dir.x && d.y === -this.dir.y) return;
        this.nextDir = d;
    }

    start() {
        this.resize();
        this.snake = [{ x: 10, y: 10 }];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.score = 0;
        this.speed = this.baseSpeed;
        this.slowUntil = 0;
        this.over = false;
        this.paused = false;
        this.running = true;
        this.particles = [];
        this.maze = [];
        this.gameStats = { gold: 0, normal: 0, slow: 0 };
        
        $('overlay').classList.add('hidden');
        this.spawnFood();
        this.updateScoreUI();
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
        if (!this.running || this.paused || this.over) {
            this.draw();
            return;
        }
        const speed = now < this.slowUntil ? this.speed * 1.8 : this.speed;
        if (now - this.lastTick >= speed) {
            this.lastTick = now;
            this.tick();
        }
        this.updateParticles();
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    tick() {
        this.dir = { ...this.nextDir };
        let head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

        // Телепорт
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
            this.spawnParticles(head.x, head.y, ft.color);

            this.gameStats[this.foodType.toLowerCase()]++;
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

    spawnParticles(gx, gy, color) {
        const px = gx * this.tileSize + this.tileSize / 2;
        const py = gy * this.tileSize + this.tileSize / 2;
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 * i) / 10;
            const speed = 2 + Math.random() * 2;
            this.particles.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
        }
    }

    updateParticles() {
        this.particles = this.particles.filter(p => p.life > 0);
        for (const p of this.particles) {
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.94; p.vy *= 0.94;
            p.life -= 0.04;
        }
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
        this.draw();
    }

    updateScoreUI() {
        $('score').textContent = this.score;
        const best = this.topScores[0]?.score || 0;
        if (this.score > best) { this.newBest = true; $('best').textContent = this.score; }
    }

    updateBestUI() {
        const best = this.topScores[0]?.score || 0;
        $('main-best').textContent = best;
        $('best').textContent = best;
    }

    checkNewRecord() {
        const prevBest = this.topScores[0]?.score || 0;
        if (this.score > prevBest && !this.newBest) { this.newBest = true; vibrate(150); }
    }

    // ---------- ПРОГРЕСС ----------
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

    // ---------- МОДАЛКИ ----------
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
                };
            }
            list.appendChild(card);
        });
        $('modal-skins').classList.remove('hidden');
    }

    showSettings() {
        $('modal-settings').classList.remove('hidden');
    }

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

    // ---------- ОТРИСОВКА ----------
    getCurrentSkin() {
        return SKINS.find(s => s.id === this.skins.active) || SKINS[0];
    }

    draw() {
        if (!this.canvasSize) return;
        const s = this.canvasSize;
        ctx.clearRect(0, 0, s, s);
        
        // Фон
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, s, s);

        // Сетка
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let i = 0; i <= GRID; i++) {
            const p = i * this.tileSize;
            ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
        }

        // Лабиринт
        this.maze.forEach(m => {
            ctx.fillStyle = COLORS.maze;
            ctx.beginPath();
            ctx.roundRect(m.x * this.tileSize + 2, m.y * this.tileSize + 2, this.tileSize - 4, this.tileSize - 4, 4);
            ctx.fill();
        });

        // Еда
        if (this.food) {
            const ft = FOOD_TYPES[this.foodType];
            const fx = this.food.x * this.tileSize + this.tileSize / 2;
            const fy = this.food.y * this.tileSize + this.tileSize / 2;
            const r = this.tileSize * 0.35;
            
            ctx.fillStyle = ft.color;
            ctx.beginPath();
            ctx.arc(fx, fy, r, 0, Math.PI * 2);
            ctx.fill();
            
            // Блик (объем)
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(fx - r*0.3, fy - r*0.3, r*0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Змейка
        const skin = this.getCurrentSkin();
        this.snake.forEach((seg, i) => {
            const x = seg.x * this.tileSize;
            const y = seg.y * this.tileSize;
            const pad = 2;
            const size = this.tileSize - pad * 2;
            
            let color = skin.color;
            if (color === 'rainbow') {
                color = `hsl(${(performance.now() / 10 + i * 20) % 360}, 80%, 60%)`;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(x + pad, y + pad, size, size, i === 0 ? 8 : 4);
            ctx.fill();

            // Объем (блик)
            if (i === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.roundRect(x + pad + 2, y + pad + 2, size - 4, size / 2.5, 6);
                ctx.fill();
                
                // Глаза
                ctx.fillStyle = '#000';
                const eye = size * 0.15;
                const cx = x + pad + size / 2;
                const cy = y + pad + size / 2;
                const off = size * 0.22;
                const ex = this.dir.x !== 0 ? this.dir.x * off : 0;
                const ey = this.dir.y !== 0 ? this.dir.y * off : 0;
                const px = this.dir.x !== 0 ? 0 : off * 0.7;
                const py = this.dir.y !== 0 ? 0 : off * 0.7;
                ctx.beginPath(); ctx.arc(cx + ex + px, cy + ey + py, eye, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + ex - px, cy + ey - py, eye, 0, Math.PI * 2); ctx.fill();
            }
        });

        // Частицы
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Индикатор замедления
        if (performance.now() < this.slowUntil) {
            const remaining = (this.slowUntil - performance.now()) / 5000;
            ctx.fillStyle = COLORS.slow;
            ctx.fillRect(0, s - 4, s * remaining, 4);
        }

        $('slow-indicator').classList.toggle('hidden', performance.now() >= this.slowUntil);
        $('maze-indicator').classList.toggle('hidden', this.maze.length === 0);
    }
}

// Запуск
window.addEventListener('DOMContentLoaded', () => {
    if (window.SnakeGameInstance) return;
    window.SnakeGameInstance = new SnakeGame();
});
