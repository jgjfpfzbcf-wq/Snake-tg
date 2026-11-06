// Тестовый скрипт для проверки
window.addEventListener('DOMContentLoaded', () => {
    console.log("Скрипт загружен!");
    const canvas = document.getElementById('game');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = 300;
        canvas.height = 300;
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(50, 50, 200, 200);
        alert("Если вы видите этот алерт и квадрат - скрипт работает!");
    } else {
        alert("Canvas не найден!");
    }
});
