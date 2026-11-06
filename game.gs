// Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0a0e1a');
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRID = 20;
const TILE = canvas.width / GRID; // будет пересчитано в resize

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayBtn = document.getElementById('overlay-btn');
const overlayBtn2 = document.getElementById('overlay-btn2');

const topModal = document.getElementById('top-modal');
const topList = document.getElementById('top-list');

const COLORS = {
    bg: '#121829',
    grid: 'rgba(0, 240, 255, 0.04)',
    snakeHead: '#00f0ff',
    snakeBody: ['#00f0ff', '#00d4e0', '#00b8c1'],
    food: '#ff3366',
    gold: '#ffd700',
    slow: '#39ff14',
    glow: 12,
};

const FOOD_TYPES = {
    NORMAL: { color: '#ff3366', points: 10, chance: 0.80 },
    GOLD:   { color: '#ffd700', points: 50, chance: 0.15 },
    SLOW:   { color: '#39ff14', points: 5,  chance: 0.05 },
};

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
        this.score = 0;
        this.speed = 150;       // мс на шаг
        this.baseSpeed = 150;
        this.running = false;
        this.paused = false;
        this.over = false;
        this.lastTick = 0;
        this.particles = [];
        this.slowUntil = 0;
        this.newBest = false;

        // Рекорды
        this.topScores = this.loadTop();

        this.bindEvents();
        this.updateBestUI();
        this.showOverlay('Готов?', 'Свайпай или используй стрелки', 'Начать игру', () => this.start());
    }

    resize() {
        const size = canvas.clientWidth;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);
        this.tileSize = size / GRID;
        this.canvasSize = size;
        if (this.running) this.draw();
    }

    bindEvents() {
        // Клавиатура
        document.addEventListener('keydown', (e) => {
            const map = {
                ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
                w: 'up', s: 'down', a: 'left', d: 'right',
                W: 'up', S: 'down', A: 'left', D: 'right',
            };
            if (map[e.key]) {
                e.preventDefault();
                this.setDirection(map[e.key]);
            }
            if (e.key === ' ' || e.key === 'Escape') {
                e.preventDefault();
                this.togglePause();
            }
        });

        // Свайпы
        let sx = 0, sy = 0;
        canvas.addEventListener('touchstart', (e) => {
            const t = e.changedTouches[0];
            sx = t.clientX;
            sy = t.clientY;
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            const dx = t.clientX - sx;
            const dy = t.clientY - sy;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (Math.max(absX, absY) < 25) return;

            if (absX > absY) {
                this.setDirection(dx > 0 ? 'right' : 'left');
            } else {
                this.setDirection(dy > 0 ? 'down' : 'up');
            }
        }, { passive: true });

        // Кнопки
        document.getElementById('pause-btn').onclick = () => this.togglePause();
        document.getElementById('restart-btn').onclick = () => this.restart();
        document.getElementById('top-btn').onclick = () => this.showTop();
        document.getElementById('close-top').onclick = () => topModal.classList.add('hidden');

        overlayBtn.onclick = () => {
            if (this.over) this.restart();
            else if (this.paused) this.togglePause();
            else this.start();
        };
        overlayBtn2.onclick = () => this.showTop();
    }

    setDirection(dirName) {
        if (!this.running || this.paused || this.over) return;
        const map = {
            up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
            left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
        };
        const d = map[dirName];
        // Запрет разворота на 180
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
        this.newBest = false;
        this.particles = [];
        this.spawnFood();
        this.updateScoreUI();
        this.hideOverlay();
        this.lastTick = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    restart() {
        this.hideOverlay();
        topModal.classList.add('hidden');
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
            if (!this.paused && !this.over && this.running) {
                requestAnimationFrame((t) => this.loop(t));
            }
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
        const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

        // Стены
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
            return this.gameOver();
        }
        // Себя
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            return this.gameOver();
        }

        this.snake.unshift(head);

        // Еда
        if (this.food && head.x === this.food.x && head.y === this.food.y) {
            const ft = FOOD_TYPES[this.foodType];
            this.score += ft.points;
            this.spawnParticles(head.x, head.y, ft.color);
            this.vibrate();

            if (this.foodType === 'SLOW') {
                this.slowUntil = performance.now() + 5000;
            }

            // Ускорение каждые 50 очков
            if (this.score > 0 && Math.floor(this.score / 50) > Math.floor((this.score - ft.points) / 50)) {
                this.speed = Math.max(70, this.speed - 8);
            }

            this.spawnFood();
            this.updateScoreUI();
            this.checkNewRecord();
        } else {
            this.snake.pop();
        }
    }

    spawnFood() {
        const empty = [];
        for (let x = 0; x < GRID; x++)
            for (let y = 0; y < GRID; y++)
                if (!this.snake.some(s => s.x === x && s.y === y))
                    empty.push({ x, y });

        if (!empty.length) return this.gameOver();

        this.food = empty[Math.floor(Math.random() * empty.length)];
        // Выбор типа
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
            this.particles.push({
                x: px, y: py,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color,
            });
        }
    }

    updateParticles() {
        this.particles = this.particles.filter(p => p.life > 0);
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.life -= 0.03;
        }
    }

    gameOver() {
        this.running = false;
        this.over = true;
        this.vibrate(200);
        this.saveScore(this.score);

        const isRecord = this.score > 0 && this.score === this.topScores[0]?.score;
        this.showOverlay(
            isRecord ? '🏆 Новый рекорд!' : 'Игра окончена',
            `Счёт: ${this.score}`,
            'Играть снова',
            'Топ-10'
        );
        this.draw();
    }

    updateScoreUI() {
        scoreEl.textContent = this.score;
        const best = this.topScores[0]?.score || 0;
        if (this.score > best) {
            this.newBest = true;
            bestEl.textContent = this.score;
        }
    }

    updateBestUI() {
        const best = this.topScores[0]?.score || 0;
        bestEl.textContent = best;
    }

    checkNewRecord() {
        const prevBest = this.topScores[0]?.score || 0;
        if (this.score > prevBest && !this.newBest) {
            this.newBest = true;
            this.vibrate(150);
        }
    }

    vibrate(ms = 15) {
        if (tg?.HapticFeedback) {
            try { tg.HapticFeedback.impactOccurred('light'); } catch {}
        }
        if (navigator.vibrate) navigator.vibrate(ms);
    }

    // Рекорды
    loadTop() {
        try {
            const raw = localStorage.getItem('snake-top');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    saveScore(score) {
        if (score <= 0) return;
        const entry = { score, date: new Date().toLocaleDateString('ru-RU') };
        this.topScores.push(entry);
        this.topScores.sort((a, b) => b.score - a.score);
        this.topScores = this.topScores.slice(0, 10);
        localStorage.setItem('snake-top', JSON.stringify(this.topScores));
        this.updateBestUI();
    }

    showTop() {
        topList.innerHTML = '';
        if (!this.topScores.length) {
            topList.innerHTML = '<li style="justify-content:center;color:var(--text-dim);border:none;background:none;">Пока нет рекордов</li>';
        } else {
            this.topScores.forEach((entry, i) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="rank">#${i + 1}</span>
                    <span class="val">${entry.score}</span>
                    <span class="date">${entry.date}</span>
                `;
                topList.appendChild(li);
            });
        }
        topModal.classList.remove('hidden');
    }

    // Отрисовка
    draw() {
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
            ctx.beginPath();
            ctx.moveTo(p, 0); ctx.lineTo(p, s);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, p); ctx.lineTo(s, p);
            ctx.stroke();
        }

        // Еда
        if (this.food) {
            const color = FOOD_TYPES[this.foodType].color;
            const fx = this.food.x * this.tileSize + this.tileSize / 2;
            const fy = this.food.y * this.tileSize + this.tileSize / 2;
            const r = this.tileSize * 0.32;
            const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;

            // Свечение
            const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 3 * pulse);
            grad.addColorStop(0, color + 'aa');
            grad.addColorStop(1, color + '00');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(fx, fy, r * 3 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Ядро
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(fx, fy, r * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Змейка
        this.snake.forEach((seg, i) => {
            const x = seg.x * this.tileSize;
            const y = seg.y * this.tileSize;
            const pad = 2;
            const size = this.tileSize - pad * 2;

            if (i === 0) {
                ctx.fillStyle = COLORS.snakeHead;
                ctx.shadowColor = COLORS.snakeHead;
                ctx.shadowBlur = COLORS.glow;
                ctx.fillRect(x + pad, y + pad, size, size);
                ctx.shadowBlur = 0;

                // Глаза
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
                ctx.fillStyle = `rgba(0, ${180 + intensity * 60}, ${200 + intensity * 55}, ${0.4 + intensity * 0.6})`;
                ctx.shadowColor = COLORS.snakeHead;
                ctx.shadowBlur = 6;
                ctx.fillRect(x + pad, y + pad, size, size);
                ctx.shadowBlur = 0;
            }
        });

        // Частицы
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Индикатор замедления
        if (performance.now() < this.slowUntil) {
            const remaining = (this.slowUntil - performance.now()) / 5000;
            ctx.fillStyle = 'rgba(57, 255, 20, 0.8)';
            ctx.fillRect(0, s - 4, s * remaining, 4);
        }
    }

    // Оверлеи
    showOverlay(title, text, btnText, btn2Text) {
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        overlayBtn.textContent = btnText;
        if (typeof btn2Text === 'string') {
            overlayBtn2.textContent = btn2Text;
            overlayBtn2.classList.remove('hidden');
        } else {
            overlayBtn2.classList.add('hidden');
        }
        overlay.classList.remove('hidden');
    }

    hideOverlay() {
        overlay.classList.add('hidden');
    }
}

window.addEventListener('DOMContentLoaded', () => new SnakeGame());
