// ============ TELEGRAM ============
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0a0e1a');
}

// ============ КОНСТАНТЫ ============
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const GRID = 20;

const FOOD_TYPES = {
    NORMAL: { color: '#ff3366', points: 10, chance: 0.80 },
    GOLD:   { color: '#ffd700', points: 50, chance: 0.15 },
    SLOW:   { color: '#39ff14', points: 5,  chance: 0.05 },
};

const SKINS = [
    { id: 'cyan',   name: 'Неон',       color: '#00f0ff', head: '#00f0ff', unlock: { type: 'default' } },
    { id: 'pink',   name: 'Магента',    color: '#ff00d4', head: '#ff00d4', unlock: { type: 'score', value: 50 } },
    { id: 'green',  name: 'Токсин',     color: '#39ff14', head: '#39ff14', unlock: { type: 'score', value: 150 } },
    { id: 'gold',   name: 'Золото',     color: '#ffd700', head: '#ffd700', unlock: { type: 'score', value: 300 } },
    { id: 'purple', name: 'Фиолет',     color: '#9d4edd', head: '#9d4edd', unlock: { type: 'achievement', value: 'gold_10' } },
    { id: 'rainbow',name: 'Радуга',     color: 'rainbow', head: '#ffffff', unlock: { type: 'achievement', value: 'score_500' } },
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

        // Состояние
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

        // Статистика сессии
        this.stats = { gold: 0, normal: 0, slow: 0 };
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
        this.skins = LS.get('skins', { active: 'cyan' });
        this.totalGold = LS.get('totalGold', 0);
        this.maxScore = LS.get('maxScore', 0);
        this.tasks = this.loadTasks();

        this.initUI();
        this.bindEvents();
        this.updateBestUI();
        this.showOverlay('Готов?', 'Свайпай или используй стрелки', 'Начать игру', null);
    }

    resize() {
        const size = canvas.clientWidth;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.tileSize = size / GRID;
        this.canvasSize = size;
        if (this.running) this.draw();
    }

    // ---------- ЗАДАНИЯ ----------
    loadTasks() {
        const today = new Date().toDateString();
        const saved = LS.get('tasks', null);
        if (saved && saved.date === today) return saved;
        // Новые задания
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
                if (t.progress >= t.target) {
                    t.done = true;
                    toast(`✅ Задание выполнено: ${t.title}`);
                    this.unlockAchievement('task_' + t.id);
                }
                changed = true;
            }
        });
        if (changed) LS.set('tasks', this.tasks);
    }

    // ---------- ДОСТИЖЕНИЯ ----------
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

    checkAchievements() {
        if (!this.achievements.first_game) this.unlockAchievement('first_game');
        if (this.score >= 50)   this.unlockAchievement('score_50');
        if (this.score >= 100)  this.unlockAchievement('score_100');
        if (this.score >= 500)  this.unlockAchievement('score_500');
        if (this.snake.length >= 20) this.unlockAchievement('long_20');
        if (this.totalGold >= 1)  this.unlockAchievement('gold_1');
        if (this.totalGold >= 10) this.unlockAchievement('gold_10');
        if (this.settings.noWalls) this.unlockAchievement('no_walls');
    }

    // ---------- СКИНЫ ----------
    isSkinUnlocked(skin) {
        if (skin.unlock.type === 'default') return true;
        if (skin.unlock.type === 'score') return this.maxScore >= skin.unlock.value;
        if (skin.unlock.type === 'achievement') return !!this.achievements[skin.unlock.value];
        return false;
    }

    getCurrentSkin() {
        const skin = SKINS.find(s => s.id === this.skins.active) || SKINS[0];
        return this.isSkinUnlocked(skin) ? skin : SKINS[0];
    }

    // ---------- UI ----------
    initUI() {
        // Топ
        $('close-top').onclick = () => { sound.click(); $('top-modal').classList.add('hidden'); };
        $('top-btn').onclick = () => { sound.click(); this.showTop(); };

        // Скины
        $('close-skins').onclick = () => { sound.click(); $('skins-modal').classList.add('hidden'); };
        $('skins-btn').onclick = () => { sound.click(); this.showSkins(); };

        // Настройки
        $('close-settings').onclick = () => { sound.click(); $('settings-modal').classList.add('hidden'); };
        $('settings-btn').onclick = () => { sound.click(); this.showSettings(); };
        $('toggle-walls').checked = this.settings.noWalls;
        $('toggle-maze').checked = this.settings.mazeEnabled;
        $('toggle-sound').checked = this.settings.sound;
        $('toggle-vibration').checked = this.settings.vibration;

        $('toggle-walls').onchange = (e) => {
            this.settings.noWalls = e.target.checked;
            LS.set('noWalls', this.settings.noWalls);
            if (this.settings.noWalls) this.unlockAchievement('no_walls');
        };
        $('toggle-maze').onchange = (e) => {
            this.settings.mazeEnabled = e.target.checked;
            LS.set('mazeEnabled', this.settings.mazeEnabled);
        };
        $('toggle-sound').onchange = (e) => {
            this.settings.sound = e.target.checked;
            LS.set('sound', this.settings.sound);
            sound.enabled = this.settings.sound;
            sound.click();
        };
        $('toggle-vibration').onchange = (e) => {
            this.settings.vibration = e.target.checked;
            LS.set('vibration', this.settings.vibration);
            vibrate();
        };

        // Задания
        $('close-tasks').onclick = () => { sound.click(); $('tasks-modal').classList.add('hidden'); };
        $('tasks-btn').onclick = () => { sound.click(); this.showTasks(); };

        // Достижения
        $('close-achievements').onclick = () => { sound.click(); $('achievements-modal').classList.add('hidden'); };

        // Кнопки управления
        $('pause-btn').onclick = () => { sound.click(); this.togglePause(); };
        $('restart-btn').onclick = () => { sound.click(); this.restart(); };

        // Оверлей
        $('overlay-btn').onclick = () => {
            sound.click();
            if (this.over) this.restart();
            else if (this.paused) this.togglePause();
            else this.start();
        };
        $('overlay-btn2').onclick = () => { sound.click(); this.showTop(); };

        // Тап по заголовку = достижения
        document.querySelector('.neon-title').onclick = () => { sound.click(); this.showAchievements(); };
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            const map = {
                ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                w: 'up', s: 'down', a: 'left', d: 'right',
                W: 'up', S: 'down', A: 'left', D: 'right',
            };
            if (map[e.key]) { e.preventDefault(); this.setDirection(map[e.key]); }
            if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); this.togglePause(); }
        });

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
    }

    setDirection(dirName) {
        if (!this.running || this.paused || this.over) return;
        const map = {
            up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
            left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
        };
        const d = map[dirName];
        if (d.x === -this.dir.x && d.y === -this.dir.y) return;
        this.nextDir = d;
    }

    // ---------- ЖИЗНЕННЫЙ ЦИКЛ ----------
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
        this.newBest = false;
        this.particles = [];
        this.maze = [];
        this.gameStats = { gold: 0, normal: 0, slow: 0 };

        this.spawnFood();
        this.updateScoreUI();
        this.hideOverlay();
        this.lastTick = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    restart() {
        this.hideOverlay();
        $('top-modal').classList.add('hidden');
        this.start();
    }

    togglePause() {
        if (!this.running || this.over) return;
        this.paused = !this.paused;
        if (this.paused) {
            this.showOverlay('Пауза', 'Продолжим?', 'Продолжить', null);
        } else {
            this.hideOverlay();
            this.lastTick = performance.now();
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    loop(now) {
        if (!this.running || this.paused || this.over) {
            this.draw();
            if (!this.paused && !this.over && this.running) requestAnimationFrame((t) => this.loop(t));
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

        // Телепорт (без стен)
        if (this.settings.noWalls) {
            if (head.x < 0) head.x = GRID - 1;
            if (head.x >= GRID) head.x = 0;
            if (head.y < 0) head.y = GRID - 1;
            if (head.y >= GRID) head.y = 0;
        } else {
            if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return this.gameOver();
        }

        // Столкновение с собой
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) return this.gameOver();
        // Столкновение с лабиринтом
        if (this.maze.some(m => m.x === head.x && m.y === head.y)) return this.gameOver();

        this.snake.unshift(head);

        if (this.food && head.x === this.food.x && head.y === this.food.y) {
            const ft = FOOD_TYPES[this.foodType];
            this.score += ft.points;
            this.spawnParticles(head.x, head.y, ft.color);

            // Статистика
            this.gameStats[this.foodType.toLowerCase()]++;
            if (this.foodType === 'GOLD') {
                this.totalGold++;
                LS.set('totalGold', this.totalGold);
                sound.gold();
                this.updateTaskProgress('gold', 1);
            } else if (this.foodType === 'SLOW') {
                this.slowUntil = performance.now() + 5000;
                sound.slow();
                this.updateTaskProgress('slow', 1);
            } else {
                sound.eat();
                this.updateTaskProgress('normal', 1);
            }
            vibrate();

            // Ускорение каждые 50 очков
            if (Math.floor(this.score / 50) > Math.floor((this.score - ft.points) / 50)) {
                this.speed = Math.max(70, this.speed - 8);
            }

            // Лабиринт со 100 очков
            if (this.settings.mazeEnabled && this.score >= 100 && this.maze.length === 0) {
                this.spawnMaze();
            }

            // Задания
            this.updateTaskProgress('score', this.score);
            this.updateTaskProgress('length', this.snake.length);

            this.spawnFood();
            this.updateScoreUI();
            this.checkNewRecord();
            this.checkAchievements();
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
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 2 + Math.random() * 2;
            this.particles.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
        }
    }

    updateParticles() {
        this.particles = this.particles.filter(p => p.life > 0);
        for (const p of this.particles) {
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.94; p.vy *= 0.94;
            p.life -= 0.03;
        }
    }

    gameOver() {
        this.running = false;
        this.over = true;
        sound.gameOver();
        vibrate(200);

        this.saveScore(this.score);
        this.updateTaskProgress('games', 1);
        this.checkAchievements();

        // Обновляем maxScore
        if (this.score > this.maxScore) {
            this.maxScore = this.score;
            LS.set('maxScore', this.maxScore);
        }

        const isRecord = this.score > 0 && this.score === this.topScores[0]?.score;
        this.showOverlay(isRecord ? '🏆 Новый рекорд!' : 'Игра окончена', `Счёт: ${this.score}`, 'Играть снова', 'Топ-10');
        this.draw();
    }

    updateScoreUI() {
        $('score').textContent = this.score;
        const best = this.topScores[0]?.score || 0;
        if (this.score > best) { this.newBest = true; $('best').textContent = this.score; }
    }

    updateBestUI() {
        $('best').textContent = this.topScores[0]?.score || 0;
    }

    checkNewRecord() {
        const prevBest = this.topScores[0]?.score || 0;
        if (this.score > prevBest && !this.newBest) { this.newBest = true; vibrate(150); }
    }

    // ---------- РЕКОРДЫ ----------
    saveScore(score) {
        if (score <= 0) return;
        const entry = { score, date: new Date().toLocaleDateString('ru-RU') };
        this.topScores.push(entry);
        this.topScores.sort((a, b) => b.score - a.score);
        this.topScores = this.topScores.slice(0, 10);
        LS.set('top', this.topScores);
        this.updateBestUI();
    }

    // ---------- МОДАЛКИ ----------
    showTop() {
        const list = $('top-list');
        list.innerHTML = '';
        if (!this.topScores.length) {
            list.innerHTML = '<li style="justify-content:center;color:var(--text-dim);border:none;background:none;">Пока нет рекордов</li>';
        } else {
            this.topScores.forEach((entry, i) => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="rank">#${i + 1}</span><span class="val">${entry.score}</span><span class="date">${entry.date}</span>`;
                list.appendChild(li);
            });
        }
        $('top-modal').classList.remove('hidden');
    }

    showSkins() {
        const list = $('skins-list');
        list.innerHTML = '';
        SKINS.forEach(skin => {
            const unlocked = this.isSkinUnlocked(skin);
            const active = this.skins.active === skin.id && unlocked;
            const card = document.createElement('div');
            card.className = 'skin-card' + (unlocked ? '' : ' locked') + (active ? ' active' : '');

            let previewHtml = '';
            if (skin.color === 'rainbow') {
                previewHtml = `<div class="skin-dot" style="color:#ff00d4;background:linear-gradient(45deg,#ff00d4,#00f0ff,#39ff14)"></div>
                               <div class="skin-dot" style="color:#00f0ff;background:linear-gradient(45deg,#ffd700,#ff00d4)"></div>
                               <div class="skin-dot" style="color:#39ff14;background:linear-gradient(45deg,#39ff14,#00f0ff)"></div>`;
            } else {
                previewHtml = `<div class="skin-dot" style="color:${skin.color};background:${skin.color}"></div>
                               <div class="skin-dot" style="color:${skin.color};background:${skin.color};opacity:0.6"></div>
                               <div class="skin-dot" style="color:${skin.color};background:${skin.color};opacity:0.3"></div>`;
            }

            let statusText = '';
            if (active) statusText = '✓ Активен';
            else if (unlocked) statusText = 'Нажми';
            else if (skin.unlock.type === 'score') statusText = `Нужно ${skin.unlock.value} очков`;
            else if (skin.unlock.type === 'achievement') {
                const ach = ACHIEVEMENTS.find(a => a.id === skin.unlock.value);
                statusText = `🏅 ${ach?.name || '?'}`;
            }

            card.innerHTML = `
                <div class="skin-preview">${previewHtml}</div>
                <div class="skin-name">${skin.name}</div>
                <div class="skin-status">${statusText}</div>
            `;

            if (unlocked) {
                card.onclick = () => {
                    sound.click();
                    this.skins.active = skin.id;
                    LS.set('skins', this.skins);
                    this.showSkins();
                    toast(`Скин «${skin.name}» выбран`);
                };
            }
            list.appendChild(card);
        });
        $('skins-modal').classList.remove('hidden');
    }

    showSettings() {
        $('settings-modal').classList.remove('hidden');
    }

    showTasks() {
        const list = $('tasks-list');
        const reset = $('tasks-reset');
        list.innerHTML = '';

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const hoursLeft = Math.ceil((tomorrow - now) / 3600000);
        reset.textContent = `Обновление через ${hoursLeft} ч.`;

        this.tasks.tasks.forEach(t => {
            const card = document.createElement('div');
            card.className = 'task-card' + (t.done ? ' completed' : '');
            const progress = t.done ? 100 : (t.progress / t.target) * 100;
            card.innerHTML = `
                <div class="task-title">${t.done ? '✅ ' : ''}${t.title}</div>
                <div class="task-progress"><div class="task-progress-bar" style="width:${progress}%"></div></div>
                <div class="task-meta">
                    <span>${t.progress}/${t.target}</span>
                    <span class="task-reward">+${t.reward} 🏅</span>
                </div>
            `;
            list.appendChild(card);
        });
        $('tasks-modal').classList.remove('hidden');
    }

    showAchievements() {
        const list = $('achievements-list');
        list.innerHTML = '';
        ACHIEVEMENTS.forEach(ach => {
            const unlocked = this.achievements[ach.id];
            const el = document.createElement('div');
            el.className = 'achievement' + (unlocked ? ' unlocked' : ' locked');
            el.innerHTML = `
                <div class="achievement-icon">${unlocked ? ach.icon : '🔒'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${ach.name}</div>
                    <div class="achievement-desc">${ach.desc}</div>
                </div>
            `;
            list.appendChild(el);
        });
        $('achievements-modal').classList.remove('hidden');
    }

    // ---------- ОВЕРЛЕЙ ----------
    showOverlay(title, text, btnText, btn2Text) {
        $('overlay-title').textContent = title;
        $('overlay-text').textContent = text;
        $('overlay-btn').textContent = btnText;
        if (typeof btn2Text === 'string') {
            $('overlay-btn2').textContent = btn2Text;
            $('overlay-btn2').classList.remove('hidden');
        } else {
            $('overlay-btn2').classList.add('hidden');
        }
        $('overlay').classList.remove('hidden');
    }

    hideOverlay() { $('overlay').classList.add('hidden'); }

    // ---------- ОТРИСОВКА ----------
    draw() {
        const s = this.canvasSize;
        ctx.clearRect(0, 0, s, s);
        ctx.fillStyle = '#121829';
        ctx.fillRect(0, 0, s, s);

        // Сетка
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= GRID; i++) {
            const p = i * this.tileSize;
            ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
        }

        // Лабиринт
        for (const m of this.maze) {
            const x = m.x * this.tileSize;
            const y = m.y * this.tileSize;
            ctx.fillStyle = '#9d4edd';
            ctx.shadowColor = '#9d4edd';
            ctx.shadowBlur = 12;
            ctx.fillRect(x + 3, y + 3, this.tileSize - 6, this.tileSize - 6);
            ctx.shadowBlur = 0;
        }

        // Еда
        if (this.food) {
            const color = FOOD_TYPES[this.foodType].color;
            const fx = this.food.x * this.tileSize + this.tileSize / 2;
            const fy = this.food.y * this.tileSize + this.tileSize / 2;
            const r = this.tileSize * 0.32;
            const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;

            const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 3 * pulse);
            grad.addColorStop(0, color + 'aa');
            grad.addColorStop(1, color + '00');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(fx, fy, r * 3 * pulse, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(fx, fy, r * pulse, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
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
                const hue = (performance.now() / 20 + i * 25) % 360;
                color = `hsl(${hue}, 100%, 60%)`;
            }

            if (i === 0) {
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
                ctx.fillRect(x + pad, y + pad, size, size);
                ctx.shadowBlur = 0;

                ctx.fillStyle = '#0a0e1a';
                const eye = size * 0.18;
                const cx = x + pad + size / 2;
                const cy = y + pad + size / 2;
                const off = size * 0.22;
                const ex = this.dir.x !== 0 ? this.dir.x * off : 0;
                const ey = this.dir.y !== 0 ? this.dir.y * off : 0;
                const px = this.dir.x !== 0 ? 0 : off * 0.7;
                const py = this.dir.y !== 0 ? 0 : off * 0.7;
                ctx.beginPath(); ctx.arc(cx + ex + px, cy + ey + py, eye, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + ex - px, cy + ey - py, eye, 0, Math.PI * 2); ctx.fill();
            } else {
                const intensity = 1 - i / this.snake.length;
                if (skin.color === 'rainbow') {
                    ctx.fillStyle = color;
                    ctx.globalAlpha = 0.4 + intensity * 0.6;
                } else {
                    // Разбор hex в rgba
                    const hex = skin.color.replace('#', '');
                    const r2 = parseInt(hex.substr(0, 2), 16);
                    const g2 = parseInt(hex.substr(2, 2), 16);
                    const b2 = parseInt(hex.substr(4, 2), 16);
                    ctx.fillStyle = `rgba(${r2}, ${g2}, ${b2}, ${0.4 + intensity * 0.6})`;
                }
                ctx.shadowColor = color;
                ctx.shadowBlur = 6;
                ctx.fillRect(x + pad, y + pad, size, size);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }
        });

        // Частицы
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Индикатор замедления
        if (performance.now() < this.slowUntil) {
            const remaining = (this.slowUntil - performance.now()) / 5000;
            ctx.fillStyle = 'rgba(57, 255, 20, 0.8)';
            ctx.fillRect(0, s - 4, s * remaining, 4);
        }

        // HUD-индикаторы
        $('slow-indicator').classList.toggle('hidden', performance.now() >= this.slowUntil);
        $('maze-indicator').classList.toggle('hidden', this.maze.length === 0);
    }
}

window.addEventListener('DOMContentLoaded', () => new SnakeGame());
