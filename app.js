const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const healthEl = document.getElementById('health');
const killsEl = document.getElementById('kills');
const messagesEl = document.getElementById('messages');
const bonusHudEl = document.getElementById('bonusHud');
const bonusNameEl = document.getElementById('bonusName');
const victoryModal = document.getElementById('victoryModal');
const shareBtn = document.getElementById('shareBtn');
const shareMessage = document.getElementById('shareMessage');
const reviveModal = document.getElementById('reviveModal');
const enemyListEl = document.getElementById('enemyList');
const nameSelectModal = document.getElementById('nameSelectModal');
const nameButtonsEl = document.getElementById('nameButtons');
const victoryPlayerNameEl = document.getElementById('victoryPlayerName');
const revivePlayerNameEl = document.getElementById('revivePlayerName');

const enemyNames = ["RedFlagRadar", "T3amW1pe", "m3d03d", "Some0neCybers", "Me0ow5_T3aM", "JIEBOE_yXO", "AppSECeRS", "TA57", "Cringe4Shell", "Sn4ke_3aters", "ScriptKiddies", "fail2ban"];

const keys = {};
let gameRunning = false;
let playerName = null;

const player = {
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: 6,
    size: 10,
    acceleration: 0.15,
    friction: 0.95,
    rotationSpeed: 0.03,
    lastShot: 0
};

const bullets = [];
const enemies = [];
const flags = [];
const sparks = [];
const powerups = [];
const eliminatedEnemies = [];
let kills = 0;

const BONUS_TYPES = {
    TRIPLE: { name: 'Triple Shot', color: '#0ff', symbol: '⚡' },
    BIG: { name: 'Big Shot', color: '#ff0', symbol: '⬤' },
    ARMOR: { name: 'Armor', color: '#0f0', symbol: '◈' }
};

let activeBonus = null;
let armorCharges = 0;
let lastEnemySpawn = 0;
let spawnInterval = 3000;
let lastSpawnUpdate = Date.now();
let lastPowerupSpawn = Date.now();

// Управление
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Мобильное управление
const joystick = document.getElementById('joystick');
const joystickStick = document.getElementById('joystickStick');
const fireBtn = document.getElementById('fireBtn');

let joystickActive = false;
let joystickAngle = 0;
let joystickDistance = 0;

if (joystick) {
    joystick.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystick.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystick.addEventListener('touchend', handleJoystickEnd, { passive: false });
}

if (fireBtn) {
    fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[' '] = true;
    }, { passive: false });
    
    fireBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[' '] = false;
    }, { passive: false });
}

function handleJoystickStart(e) {
    e.preventDefault();
    joystickActive = true;
    updateJoystick(e.touches[0]);
}

function handleJoystickMove(e) {
    e.preventDefault();
    if (joystickActive) {
        updateJoystick(e.touches[0]);
    }
}

function handleJoystickEnd(e) {
    e.preventDefault();
    joystickActive = false;
    joystickAngle = 0;
    joystickDistance = 0;
    joystickStick.style.transform = 'translate(-50%, -50%)';
    
    // Отключаем все направления
    keys['w'] = false;
    keys['s'] = false;
    keys['a'] = false;
    keys['d'] = false;
    keys['arrowup'] = false;
    keys['arrowdown'] = false;
    keys['arrowleft'] = false;
    keys['arrowright'] = false;
}

function updateJoystick(touch) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = touch.clientX - centerX;
    const deltaY = touch.clientY - centerY;
    
    joystickAngle = Math.atan2(deltaY, deltaX);
    joystickDistance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), 45);
    
    const stickX = Math.cos(joystickAngle) * joystickDistance;
    const stickY = Math.sin(joystickAngle) * joystickDistance;
    
    joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
}

// Инициализация выбора имени
function initNameSelection() {
    enemyNames.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'name-btn';
        btn.textContent = name;
        btn.addEventListener('click', () => selectPlayerName(name));
        nameButtonsEl.appendChild(btn);
    });
}

function selectPlayerName(name) {
    playerName = name;
    nameSelectModal.classList.remove('show');
    gameRunning = true;
    victoryPlayerNameEl.textContent = playerName;
    revivePlayerNameEl.textContent = playerName;
}

function addMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = text;
    messagesEl.insertBefore(msg, messagesEl.firstChild);
    while (messagesEl.children.length > 5) {
        messagesEl.removeChild(messagesEl.lastChild);
    }
}

function updatePlayer() {
    // Мобильное управление джойстиком
    if (joystickActive && joystickDistance > 15) {
        // Поворачиваем корабль в направлении джойстика
        player.angle = joystickAngle;
        
        // Ускорение в направлении джойстика пропорционально отклонению
        const force = joystickDistance / 45; // Нормализованная сила 0-1
        player.vx += Math.cos(joystickAngle) * player.acceleration * force * 2;
        player.vy += Math.sin(joystickAngle) * player.acceleration * force * 2;
    } else {
        // Обычное клавиатурное управление
        // Поворот
        if (keys['a'] || keys['arrowleft']) player.angle -= player.rotationSpeed;
        if (keys['d'] || keys['arrowright']) player.angle += player.rotationSpeed;
        
        // Ускорение
        if (keys['w'] || keys['arrowup']) {
            player.vx += Math.cos(player.angle) * player.acceleration;
            player.vy += Math.sin(player.angle) * player.acceleration;
        }
        
        // Торможение / Задний ход
        if (keys['s'] || keys['arrowdown']) {
            player.vx -= Math.cos(player.angle) * player.acceleration;
            player.vy -= Math.sin(player.angle) * player.acceleration;
        }
    }
    
    // Трение
    player.vx *= player.friction;
    player.vy *= player.friction;
    
    // Ограничение максимальной скорости
    const maxSpeed = 3;
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > maxSpeed) {
        player.vx = (player.vx / speed) * maxSpeed;
        player.vy = (player.vy / speed) * maxSpeed;
    }
    
    // Движение
    player.x += player.vx;
    player.y += player.vy;
    
    // Wrap-around
    if (player.x < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = 0;
    if (player.y < 0) player.y = canvas.height;
    if (player.y > canvas.height) player.y = 0;
    
    // Стрельба
    const now = Date.now();
    if (keys[' '] && now - player.lastShot > 300) {
        if (activeBonus === 'TRIPLE') {
            // Три снаряда
            for (let offset of [-Math.PI/4, 0, Math.PI/4]) {
                const angle = player.angle + offset;
                bullets.push({
                    x: player.x + Math.cos(player.angle) * player.size,
                    y: player.y + Math.sin(player.angle) * player.size,
                    vx: Math.cos(angle) * 4,
                    vy: Math.sin(angle) * 4,
                    life: 100,
                    size: 2
                });
            }
        } else if (activeBonus === 'BIG') {
            // Большой медленный снаряд
            bullets.push({
                x: player.x + Math.cos(player.angle) * player.size,
                y: player.y + Math.sin(player.angle) * player.size,
                vx: Math.cos(player.angle) * 2,
                vy: Math.sin(player.angle) * 2,
                life: 100,
                size: 5,
                isBig: true
            });
        } else {
            // Обычный снаряд
            bullets.push({
                x: player.x + Math.cos(player.angle) * player.size,
                y: player.y + Math.sin(player.angle) * player.size,
                vx: Math.cos(player.angle) * 4,
                vy: Math.sin(player.angle) * 4,
                life: 100,
                size: 2
            });
        }
        player.lastShot = now;
    }
}

function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    
    if (side === 0) { x = Math.random() * canvas.width; y = -10; }
    else if (side === 1) { x = canvas.width + 10; y = Math.random() * canvas.height; }
    else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + 10; }
    else { x = -10; y = Math.random() * canvas.height; }
    
    const angle = Math.atan2(player.y - y, player.x - x);
    const speed = 1 + Math.random() * 0.5;
    
    enemies.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hp: Math.floor(Math.random() * 3) + 1,
        size: 8,
        name: enemyNames[Math.floor(Math.random() * enemyNames.length)]
    });
}

function spawnPowerup() {
    const types = Object.keys(BONUS_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    
    powerups.push({
        x: 50 + Math.random() * (canvas.width - 100),
        y: 50 + Math.random() * (canvas.height - 100),
        type: type,
        size: 12
    });
}

function updateEnemies() {
    const now = Date.now();
    
    // Увеличение частоты спавна каждые 2 секунды
    if (now - lastSpawnUpdate > 2000) {
        spawnInterval = Math.max(500, spawnInterval - 200);
        lastSpawnUpdate = now;
    }
    
    // Спавн новых врагов
    if (now - lastEnemySpawn > spawnInterval) {
        spawnEnemy();
        lastEnemySpawn = now;
    }
    
    // Движение врагов
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        
        // Коллизия с игроком
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < player.size + enemy.size) {
            if (armorCharges > 0) {
                // Броня уничтожает врага
                armorCharges--;
                addMessage(`Враг '${enemy.name}' уничтожен броней`);
                eliminatedEnemies.push(enemy.name);
                enemies.splice(i, 1);
                kills++;
                killsEl.textContent = kills;
                
                if (armorCharges === 0) {
                    activeBonus = null;
                    updateBonusHUD();
                } else {
                    bonusNameEl.textContent = `${BONUS_TYPES.ARMOR.name} (${armorCharges})`;
                }
                
                if (kills === 10) {
                    flags.push({
                        x: enemy.x,
                        y: enemy.y,
                        color: '#f00',
                        createdAt: Date.now(),
                        permanent: true
                    });
                    gameRunning = false;
                    
                    enemyListEl.innerHTML = eliminatedEnemies.map(name => 
                        `<div class="enemy-list-item">☠️ "${name}" | Eliminated</div>`
                    ).join('');
                    
                    setTimeout(() => {
                        victoryModal.classList.add('show');
                    }, 2000);
                }
            } else {
                player.hp--;
                healthEl.textContent = player.hp;
                enemies.splice(i, 1);
                
                if (player.hp <= 0) {
                    gameRunning = false;
                    reviveModal.classList.add('show');
                    setTimeout(() => {
                        reviveModal.classList.remove('show');
                        player.hp = 6;
                        healthEl.textContent = player.hp;
                        gameRunning = true;
                    }, 3000);
                }
            }
            continue;
        }
        
        // Удаление врагов за границами
        if (enemy.x < -50 || enemy.x > canvas.width + 50 || 
            enemy.y < -50 || enemy.y > canvas.height + 50) {
            enemies.splice(i, 1);
        }
    }
}

function updatePowerups() {
    const now = Date.now();
    
    // Спавн бонусов каждые 5 секунд
    if (now - lastPowerupSpawn > 5000) {
        spawnPowerup();
        lastPowerupSpawn = now;
    }
    
    // Проверка подбора бонусов
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        const dx = powerup.x - player.x;
        const dy = powerup.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < player.size + powerup.size) {
            // Подобрали бонус
            activeBonus = powerup.type;
            if (powerup.type === 'ARMOR') {
                armorCharges = 3;
            } else {
                armorCharges = 0;
            }
            updateBonusHUD();
            powerups.splice(i, 1);
        }
    }
}

function updateBonusHUD() {
    if (activeBonus) {
        bonusHudEl.style.display = 'block';
        const bonus = BONUS_TYPES[activeBonus];
        if (activeBonus === 'ARMOR') {
            bonusNameEl.textContent = `${bonus.name} (${armorCharges})`;
        } else {
            bonusNameEl.textContent = bonus.name;
        }
    } else {
        bonusHudEl.style.display = 'none';
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life--;
        
        // Wrap-around для пуль
        if (bullet.x < 0) bullet.x = canvas.width;
        if (bullet.x > canvas.width) bullet.x = 0;
        if (bullet.y < 0) bullet.y = canvas.height;
        if (bullet.y > canvas.height) bullet.y = 0;
        
        // Удаление старых пуль
        if (bullet.life <= 0) {
            bullets.splice(i, 1);
            continue;
        }
        
        // Коллизия с врагами
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < enemy.size + (bullet.size || 2)) {
                // Big Shot уничтожает врага с одного попадания
                if (bullet.isBig) {
                    enemy.hp = 0;
                } else {
                    enemy.hp--;
                }
                bullets.splice(i, 1);
                
                // Искры при попадании
                for (let k = 0; k < 8; k++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1 + Math.random() * 2;
                    sparks.push({
                        x: enemy.x,
                        y: enemy.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 20 + Math.random() * 10
                    });
                }
                
                if (enemy.hp <= 0) {
                    addMessage(`Враг '${enemy.name}' уничтожен`);
                    eliminatedEnemies.push(enemy.name);
                    
                    // Белый флаг
                    flags.push({
                        x: enemy.x,
                        y: enemy.y,
                        color: '#fff',
                        createdAt: Date.now()
                    });
                    
                    enemies.splice(j, 1);
                    kills++;
                    killsEl.textContent = kills;
                    
                    if (kills === 10) {
                        // Красный флаг
                        flags.push({
                            x: enemy.x,
                            y: enemy.y,
                            color: '#f00',
                            createdAt: Date.now(),
                            permanent: true
                        });
                        gameRunning = false;
                        
                        // Заполняем список уничтоженных врагов
                        enemyListEl.innerHTML = eliminatedEnemies.map(name => 
                            `<div class="enemy-list-item">☠️ "${name}" | Eliminated</div>`
                        ).join('');
                        
                        setTimeout(() => {
                            victoryModal.classList.add('show');
                        }, 2000);
                    }
                }
                break;
            }
        }
    }
}

function drawRadarGrid() {
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 1;
    
    // Радиальные линии
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, canvas.height / 2);
        ctx.lineTo(
            canvas.width / 2 + Math.cos(angle) * 500,
            canvas.height / 2 + Math.sin(angle) * 500
        );
        ctx.stroke();
    }
    
    // Концентрические круги
    for (let r = 50; r < 500; r += 50) {
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawPlayer() {
    // Кольца брони
    if (armorCharges > 0) {
        ctx.strokeStyle = BONUS_TYPES.ARMOR.color;
        ctx.lineWidth = 2;
        
        for (let i = 0; i < armorCharges; i++) {
            const radius = player.size + 8 + (i * 6);
            ctx.beginPath();
            ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
    ctx.strokeStyle = '#0f0';
    ctx.fillStyle = '#0f0';
    ctx.lineWidth = 2;
    
    // Треугольник корабля
    ctx.beginPath();
    ctx.moveTo(player.size, 0);
    ctx.lineTo(-player.size, -player.size / 2);
    ctx.lineTo(-player.size, player.size / 2);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
}

function drawBullets() {
    ctx.fillStyle = '#0ff';
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size || 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPowerups() {
    powerups.forEach(powerup => {
        const bonus = BONUS_TYPES[powerup.type];
        
        // Мигающий квадрат
        ctx.strokeStyle = bonus.color;
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(powerup.x, powerup.y);
        ctx.rotate(Date.now() * 0.002);
        ctx.strokeRect(-powerup.size/2, -powerup.size/2, powerup.size, powerup.size);
        ctx.restore();
        
        // Символ
        ctx.fillStyle = bonus.color;
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bonus.symbol, powerup.x, powerup.y);
    });
}

function drawEnemies() {
    ctx.lineWidth = 1.5;
    
    enemies.forEach(enemy => {
        // Цвет в зависимости от имени (союзники - зелёные)
        const isAlly = enemy.name === playerName;
        ctx.strokeStyle = isAlly ? '#0f0' : '#f00';
        ctx.fillStyle = isAlly ? '#0f0' : '#f00';
        
        // Разное отображение в зависимости от HP
        if (enemy.hp === 1) {
            // 1 HP - один круг
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.stroke();
        } else if (enemy.hp === 2) {
            // 2 HP - двойной круг
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size * 0.6, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // 3 HP - тройной круг
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size * 0.4, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

function updateFlags() {
    const now = Date.now();
    for (let i = flags.length - 1; i >= 0; i--) {
        if (!flags[i].permanent && now - flags[i].createdAt > 500) {
            flags.splice(i, 1);
        }
    }
}

function updateSparks() {
    for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.life--;
        
        if (spark.life <= 0) {
            sparks.splice(i, 1);
        }
    }
}

function drawSparks() {
    sparks.forEach(spark => {
        const alpha = spark.life / 30;
        ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFlags() {
    flags.forEach(flag => {
        ctx.save();
        ctx.translate(flag.x, flag.y);
        
        // Флагшток
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -15);
        ctx.stroke();
        
        // Флаг
        ctx.fillStyle = flag.color;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(10, -12);
        ctx.lineTo(0, -9);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    });
}

function render() {
    ctx.fillStyle = '#001a00';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawRadarGrid();
    drawSparks();
    drawPowerups();
    drawPlayer();
    drawBullets();
    drawEnemies();
    drawFlags();
}

function gameLoop() {
    if (gameRunning) {
        updatePlayer();
        updateEnemies();
        updateBullets();
        updatePowerups();
    }
    
    updateFlags();
    updateSparks();
    render();
    requestAnimationFrame(gameLoop);
}

// Кнопка "Поделиться"
shareBtn.addEventListener('click', async () => {
    // Рисуем текст победы на canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Рамка
    const modalHeight = 100 + eliminatedEnemies.length * 20 + 100;
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width / 2 - 250, canvas.height / 2 - modalHeight / 2, 500, modalHeight);
    
    // Фон модального окна
    ctx.fillStyle = '#001a00';
    ctx.fillRect(canvas.width / 2 - 250, canvas.height / 2 - modalHeight / 2, 500, modalHeight);
    ctx.strokeRect(canvas.width / 2 - 250, canvas.height / 2 - modalHeight / 2, 500, modalHeight);
    
    // Текст победы
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 15;
    ctx.fillText(`${playerName} победил!`, canvas.width / 2, canvas.height / 2 - modalHeight / 2 + 50);
    ctx.shadowBlur = 0;
    
    // Список уничтоженных врагов
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    eliminatedEnemies.forEach((name, index) => {
        ctx.fillText(`☠️ "${name}" | Eliminated`, canvas.width / 2 - 230, canvas.height / 2 - modalHeight / 2 + 100 + index * 20);
    });
    
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
        if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            shareMessage.textContent = 'А теперь сделай CTRL+V в CTF чат!';
        } else {
            throw new Error('Clipboard API not available');
        }
    } catch (err) {
        // Fallback: скачивание
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'redflagradar-victory.png';
        a.click();
        URL.revokeObjectURL(url);
        shareMessage.textContent = 'Скриншот скачан! Отправь его в CTF чат!';
    }
});

initNameSelection();
gameLoop();
