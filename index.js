// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
const gameOverlay = document.getElementById('gameOverlay');
const upgradeModal = document.getElementById('upgradeModal');
const levelSelectModal = document.getElementById('levelSelectModal');
const botInfoModal = document.getElementById('botInfoModal');
const resetConfirmModal = document.getElementById('resetConfirmModal');

// --- Audio Elements ---
const playerShootSound = document.getElementById('playerShootSound');
const botShootSound = document.getElementById('botShootSound');
const playerHitSound = document.getElementById('playerHitSound');
const botHitSound = document.getElementById('botHitSound');
const winSound = document.getElementById('winSound');
const loseSound = document.getElementById('loseSound');
const upgradeSound = document.getElementById('upgradeSound');
const buttonClickSound = document.getElementById('buttonClickSound');
const noGoldSound = document.getElementById('noGoldSound');

// --- Game State & Data ---
let gameState = 'MENU', currentLevel = 1;
let LOGICAL_W = window.innerWidth, LOGICAL_H = window.innerHeight;
let gameData = {
    gold: 0, highestLevelCompleted: 0,
    playerStats: { 
        speedLevel: 1, 
        fireRateLevel: 1, 
        damageLevel: 1,
        hpLevel: 1,
        shotLevel: 1 
    }
};

let particles = [];

// --- Animation Constants ---
const ANIMATION_SQUASH_TIME = 15; // Thời gian nén lại (frames)
const ANIMATION_STRETCH_TIME = 10; // Thời gian giãn ra
const ANIMATION_RECOVER_TIME = 20; // Thời gian trở về bình thường
const ANIMATION_TOTAL_TIME = ANIMATION_SQUASH_TIME + ANIMATION_STRETCH_TIME + ANIMATION_RECOVER_TIME;

// --- Player Base Stats ---
const BASE_PLAYER_HP = 100;
const BASE_PLAYER_DAMAGE = 1;
const BASE_PLAYER_SPEED = 2;
const BASE_PLAYER_FIRERATE_SECONDS = 1.5;

// --- Bot Base Stats ---
const BASE_BOT_HP = 100;
const BASE_BOT_DAMAGE = 1;
const BASE_BOT_SPEED = 2;
const BASE_BOT_FIRERATE_SECONDS = 1.5;

// Thêm thuộc tính scale và animation vào player và bot
const player = { x: 0, y: 0, width: 60, height: 60, hp: 100, maxHp: 100, speed: 2, bullets: [], fireRate: 90, fireTimer: 0, damage: 1, scaleX: 1, scaleY: 1, isAnimating: false, animationTimer: 0 };
const bot = { x: 0, y: 0, width: 80, height: 80, hp: 100, maxHp: 100, speed: 2, damage: 1, bullets: [], dir: 1, changeDirTimer: 0, nextDirChange: 120, fireRateFrames: 90, scaleX: 1, scaleY: 1, isAnimating: false, animationTimer: 0 };

// --- Data Persistence ---
function saveData() { localStorage.setItem('shootingGameData', JSON.stringify(gameData)); }
function loadData() {
    const savedData = localStorage.getItem('shootingGameData');
    if (savedData) {
        gameData = JSON.parse(savedData);
        if (!gameData.playerStats) gameData.playerStats = {};
        if (!gameData.playerStats.speedLevel) gameData.playerStats.speedLevel = 1;
        if (!gameData.playerStats.fireRateLevel) gameData.playerStats.fireRateLevel = 1;
        if (!gameData.playerStats.damageLevel) gameData.playerStats.damageLevel = 1;
        if (!gameData.playerStats.hpLevel) gameData.playerStats.hpLevel = 1;
        if (!gameData.playerStats.shotLevel) gameData.playerStats.shotLevel = 1;
    }
    currentLevel = gameData.highestLevelCompleted + 1;
}

// --- Audio Functions ---
function playSound(soundElement, volume = 1) {
    if (soundElement) {
        soundElement.currentTime = 0;
        soundElement.volume = volume;
        soundElement.play().catch(e => console.log("Lỗi phát âm thanh:", e));
    }
}
function playButtonClick() { playSound(buttonClickSound, 0.5); }

// --- Effects Functions ---
function createExplosion(x, y, color) {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            size: Math.random() * 5 + 2,
            color: color,
            lifespan: 60
        });
    }
}

// --- Core Game Logic ---
function configureLevel(level) {
    player.maxHp = BASE_PLAYER_HP + (gameData.playerStats.hpLevel - 1) * 10;
    player.hp = player.maxHp;
    player.damage = BASE_PLAYER_DAMAGE + (gameData.playerStats.damageLevel - 1) * 1;
    player.speed = Math.min(5, BASE_PLAYER_SPEED + (gameData.playerStats.speedLevel - 1) * 0.2);
    const fireRateInSeconds = Math.max(0.5, BASE_PLAYER_FIRERATE_SECONDS - (gameData.playerStats.fireRateLevel - 1) * 0.2);
    player.fireRate = fireRateInSeconds * 60;
    
    player.bullets = []; 
    player.x = LOGICAL_W / 2 - player.width / 2; 
    player.y = LOGICAL_H - 150;

    bot.maxHp = BASE_BOT_HP + (level - 1) * 10;
    bot.hp = bot.maxHp;
    bot.damage = BASE_BOT_DAMAGE + (level - 1) * 1;
    bot.speed = Math.min(5, BASE_BOT_SPEED + (level - 1) * 0.2);
    const botFireRateInSeconds = Math.max(0.5, BASE_BOT_FIRERATE_SECONDS - (level - 1) * 0.2);
    bot.fireRateFrames = botFireRateInSeconds * 60;

    bot.bullets = []; 
    bot.x = LOGICAL_W / 2 - bot.width / 2; 
    bot.y = 80;

    updateUI();
}

function startGame(level) {
    playButtonClick();
    currentLevel = level; gameState = 'PLAYING';
    configureLevel(level);
    gameOverlay.style.display = 'none';
}

// --- UI & Modal Controls ---
function updateUI() {
    document.getElementById('playerGold').textContent = gameData.gold;
    document.getElementById('currentLevelDisplay').textContent = currentLevel;
    const botHpFill = document.getElementById('botHPFill');
    const botHpText = document.getElementById('botHPText');
    const botHpPercent = (bot.hp / bot.maxHp) * 100;
    botHpFill.style.width = `${botHpPercent}%`;
    botHpText.textContent = `${Math.ceil(bot.hp)} / ${bot.maxHp}`;
}

function showOverlay(type, details = {}) {
    gameState = 'MENU';
    const titleEl = document.getElementById('overlayTitle');
    const textEl = document.getElementById('overlayText');
    const mainActionBtn = document.getElementById('btnMainAction');

    switch (type) {
        case 'start':
            titleEl.textContent = "Bắn Vịt";
            textEl.textContent = `Sẵn sàng cho màn ${currentLevel}?`;
            mainActionBtn.textContent = "Tiếp Tục";
            mainActionBtn.onclick = () => startGame(currentLevel);
            break;
        case 'win':
            playSound(winSound, 0.7);
            titleEl.textContent = "Chiến Thắng!";
            textEl.textContent = `Bạn nhận được ${details.gold}🟡.`;
            mainActionBtn.textContent = "Màn Kế Tiếp";
            mainActionBtn.onclick = () => startGame(currentLevel + 1);
            break;
        case 'lose':
            playSound(loseSound, 0.7);
            titleEl.textContent = "Thất Bại!";
            textEl.textContent = "Hãy thử lại và nâng cấp sức mạnh nhé.";
            mainActionBtn.textContent = "Chơi Lại";
            mainActionBtn.onclick = () => startGame(currentLevel);
            break;
    }
    gameOverlay.style.display = 'flex';
}

function calculateUpgradeCost(level) {
    const baseCost = 100;
    const increment = 50;
    return baseCost + (level - 1) * increment;
}

function openUpgradeModal() {
    playButtonClick();
    document.getElementById('currentHP').textContent = BASE_PLAYER_HP + (gameData.playerStats.hpLevel - 1) * 10;
    document.getElementById('currentDamage').textContent = BASE_PLAYER_DAMAGE + (gameData.playerStats.damageLevel - 1) * 1;
    
    const currentSpeedValue = BASE_PLAYER_SPEED + (gameData.playerStats.speedLevel - 1) * 0.2;
    document.getElementById('currentSpeed').textContent = Math.min(5, currentSpeedValue).toFixed(1);
    
    document.querySelector('#upgradeHP .cost').textContent = `(${calculateUpgradeCost(gameData.playerStats.hpLevel)}🟡)`;
    document.querySelector('#upgradeDamage .cost').textContent = `(${calculateUpgradeCost(gameData.playerStats.damageLevel)}🟡)`;
    
    const upgradeSpeedBtn = document.getElementById('upgradeSpeed');
    if (currentSpeedValue >= 5) {
        upgradeSpeedBtn.disabled = true;
        document.querySelector('#upgradeSpeed .cost').textContent = `(Tối đa)`;
    } else {
        upgradeSpeedBtn.disabled = false;
        document.querySelector('#upgradeSpeed .cost').textContent = `(${calculateUpgradeCost(gameData.playerStats.speedLevel)}🟡)`;
    }

    const fireRateBtn = document.getElementById('upgradeFireRate');
    const fireRateInfo = document.getElementById('currentFireRate');
    const fireRateCostText = document.querySelector('#upgradeFireRate .cost');
    const currentFireRate = Math.max(0.5, BASE_PLAYER_FIRERATE_SECONDS - (gameData.playerStats.fireRateLevel - 1) * 0.2);

    fireRateInfo.textContent = `${(1 / currentFireRate).toFixed(1)}/s (${gameData.playerStats.shotLevel} tia)`;
    fireRateBtn.disabled = false;

    if (currentFireRate > 0.5) {
        fireRateBtn.childNodes[0].nodeValue = "Nâng Cấp ";
        fireRateCostText.textContent = `(${calculateUpgradeCost(gameData.playerStats.fireRateLevel)}🟡)`;
    } else {
        if (gameData.playerStats.shotLevel === 1) {
            fireRateBtn.childNodes[0].nodeValue = "Nâng lên 2 Tia ";
            fireRateCostText.textContent = `(500🟡)`;
        } else if (gameData.playerStats.shotLevel === 2) {
            fireRateBtn.childNodes[0].nodeValue = "Nâng lên 3 Tia ";
            fireRateCostText.textContent = `(1000🟡)`;
        } else {
            fireRateBtn.childNodes[0].nodeValue = "Tối Đa ";
            fireRateCostText.textContent = ``;
            fireRateBtn.disabled = true;
        }
    }

    upgradeModal.style.display = 'flex';
}

function buyUpgrade(stat) {
    playButtonClick();
    let cost;
    if (stat !== 'fireRate') {
        cost = calculateUpgradeCost(gameData.playerStats[stat + 'Level']);
        if (gameData.gold >= cost) {
            gameData.gold -= cost;
            gameData.playerStats[stat + 'Level']++;
            playSound(upgradeSound);
        } else {
            playSound(noGoldSound);
            alert("Không đủ 🟡!");
            return;
        }
    } else {
        const currentFireRate = Math.max(0.5, BASE_PLAYER_FIRERATE_SECONDS - (gameData.playerStats.fireRateLevel - 1) * 0.2);
        
        if (currentFireRate > 0.5) {
            cost = calculateUpgradeCost(gameData.playerStats.fireRateLevel);
            if (gameData.gold >= cost) {
                gameData.gold -= cost;
                gameData.playerStats.fireRateLevel++;
                playSound(upgradeSound);
            } else { playSound(noGoldSound); alert("Không đủ 🟡!"); return; }
        } else {
            if (gameData.playerStats.shotLevel === 1) {
                cost = 500;
                if (gameData.gold >= cost) {
                    gameData.gold -= cost;
                    gameData.playerStats.shotLevel++;
                    playSound(upgradeSound);
                } else { playSound(noGoldSound); alert("Không đủ 🟡!"); return; }
            } else if (gameData.playerStats.shotLevel === 2) {
                cost = 1000;
                if (gameData.gold >= cost) {
                    gameData.gold -= cost;
                    gameData.playerStats.shotLevel++;
                    playSound(upgradeSound);
                } else { playSound(noGoldSound); alert("Không đủ 🟡!"); return; }
            }
        }
    }
    
    saveData();
    updateUI();
    openUpgradeModal();
}

function openLevelSelectModal() {
    playButtonClick();
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';
    for (let i = 1; i <= gameData.highestLevelCompleted + 1; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = 'level-button';
        if (i <= gameData.highestLevelCompleted) { button.classList.add('unlocked'); }
        button.onclick = () => { levelSelectModal.style.display = 'none'; startGame(i); }
        grid.appendChild(button);
    }
    levelSelectModal.style.display = 'flex';
}

function openBotInfoModal() {
    playButtonClick();
    document.getElementById('botInfoTitle').textContent = `Thông tin Bot - Màn ${currentLevel}`;
    document.getElementById('botInfoHP').textContent = bot.maxHp;
    document.getElementById('botInfoDamage').textContent = bot.damage;
    document.getElementById('botInfoSpeed').textContent = bot.speed.toFixed(1);
    
    const shotsPerSecond = (60 / bot.fireRateFrames).toFixed(1);
    document.getElementById('botInfoFireRate').textContent = `${shotsPerSecond}/s`;

    botInfoModal.style.display = 'flex';
}

function openResetConfirmModal() {
    playButtonClick();
    resetConfirmModal.style.display = 'flex';
}

function executeReset() {
    playButtonClick();
    localStorage.removeItem('shootingGameData');
    window.location.reload();
}

// Button event listeners
document.getElementById('btnUpgrades').onclick = openUpgradeModal;
document.getElementById('closeUpgradeModal').onclick = () => { playButtonClick(); upgradeModal.style.display = 'none'; };
document.getElementById('upgradeSpeed').onclick = () => buyUpgrade('speed');
document.getElementById('upgradeFireRate').onclick = () => buyUpgrade('fireRate');
document.getElementById('upgradeDamage').onclick = () => buyUpgrade('damage');
document.getElementById('upgradeHP').onclick = () => buyUpgrade('hp');
document.getElementById('btnLevelSelect').onclick = openLevelSelectModal;
document.getElementById('closeLevelSelectModal').onclick = () => { playButtonClick(); levelSelectModal.style.display = 'none'; };
document.getElementById('btnBotInfo').onclick = openBotInfoModal;
document.getElementById('closeBotInfoModal').onclick = () => { playButtonClick(); botInfoModal.style.display = 'none'; };
document.getElementById('btnReset').onclick = openResetConfirmModal;
document.getElementById('btnCancelReset').onclick = () => { playButtonClick(); resetConfirmModal.style.display = 'none'; };
document.getElementById('btnConfirmReset').onclick = executeReset;
let botShootTimer = 0;
// --- Game Loop and Updates ---

// Hàm xử lý animation cho một đối tượng
function handleEntityAnimation(entity, shootFunction, sound) {
    if (entity.isAnimating) {
        entity.animationTimer++;
        const timer = entity.animationTimer;

        // Giai đoạn 1: Nén lại (SQUASH)
        if (timer <= ANIMATION_SQUASH_TIME) {
            const progress = timer / ANIMATION_SQUASH_TIME;
            entity.scaleY = 1 - 0.1 * progress; // Nén xuống 90% chiều cao
            entity.scaleX = 1 + 0.1 * progress; // Giãn ra 110% chiều rộng
        }
        // Giai đoạn 2: Bắn và giãn ra (STRETCH)
        else if (timer === ANIMATION_SQUASH_TIME + 1) {
            shootFunction(); // Bắn đạn ngay tại thời điểm này
            playSound(sound, 0.3);
        } else if (timer <= ANIMATION_SQUASH_TIME + ANIMATION_STRETCH_TIME) {
            const progress = (timer - ANIMATION_SQUASH_TIME) / ANIMATION_STRETCH_TIME;
            entity.scaleY = 0.9 + 0.2 * progress; // Từ 90% vươn lên 110%
            entity.scaleX = 1.1 - 0.2 * progress; // Từ 110% co lại 90%
        }
        // Giai đoạn 3: Trở về bình thường
        else if (timer < ANIMATION_TOTAL_TIME) {
            const progress = (timer - (ANIMATION_SQUASH_TIME + ANIMATION_STRETCH_TIME)) / ANIMATION_RECOVER_TIME;
            entity.scaleY = 1.1 - 0.1 * progress; // Từ 110% về 100%
            entity.scaleX = 0.9 + 0.1 * progress; // Từ 90% về 100%
        }
        // Kết thúc animation
        else {
            entity.isAnimating = false;
            entity.animationTimer = 0;
            entity.scaleX = 1;
            entity.scaleY = 1;
        }
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    // --- Player Logic ---
    if (keys['ArrowLeft']) player.x -= player.speed;
    if (keys['ArrowRight']) player.x += player.speed;
    player.x = Math.max(0, Math.min(LOGICAL_W - player.width, player.x));
    
    // Logic bắn của player, chuyển sang kích hoạt animation
    player.fireTimer++;
    if (player.fireTimer >= player.fireRate && !player.isAnimating) {
        player.isAnimating = true;
        player.animationTimer = 0;
        player.fireTimer = 0;
    }
    handleEntityAnimation(player, shootPlayer, playerShootSound);

    // --- Bot Logic ---
    bot.changeDirTimer++;
    if (bot.changeDirTimer > bot.nextDirChange) {
        bot.dir = Math.random() > 0.5 ? 1 : -1;
        bot.changeDirTimer = 0;
    }
    bot.x += bot.speed * bot.dir;
    if (bot.x <= 0) { bot.x = 0; bot.dir = 1; }
    if (bot.x + bot.width >= LOGICAL_W) { bot.x = LOGICAL_W - bot.width; bot.dir = -1; }
    
    // Logic bắn của bot, chuyển sang kích hoạt animation
    botShootTimer++;
    if (botShootTimer > bot.fireRateFrames && !bot.isAnimating) {
        bot.isAnimating = true;
        bot.animationTimer = 0;
        botShootTimer = 0;
    }
    handleEntityAnimation(bot, shootBot, botShootSound);
    
    // --- Bullets and Collisions ---
    player.bullets.forEach(b => b.y -= b.speed); 
    bot.bullets.forEach(b => b.y += b.speed);
    player.bullets = player.bullets.filter(b => b.y + b.height > 0);
    bot.bullets = bot.bullets.filter(b => b.y < LOGICAL_H);

    player.bullets.forEach(b => { 
        if (isColliding(b, bot)) {
            createExplosion(b.x + b.width / 2, b.y, '#ff8503ff');
            bot.hp -= player.damage; 
            b.y = -9999;
            playSound(botHitSound, 0.4);
        }
    });
    bot.bullets.forEach(b => { 
        if (isColliding(b, player)) {
            createExplosion(b.x + b.width / 2, b.y + b.height, '#ff0202ff');
            player.hp -= bot.damage; 
            b.y = LOGICAL_H + 9999;
            playSound(playerHitSound, 0.5);
        }
    });

    // --- Particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.lifespan--;
        if (p.lifespan <= 0) {
            particles.splice(i, 1);
        }
    }
    
    updateUI();

    // --- Win/Lose Check ---
    if (bot.hp <= 0) {
        gameState = 'GAMEOVER';
        let goldEarned = 0;
        if (currentLevel > gameData.highestLevelCompleted) {
            goldEarned = 100 + (currentLevel - 1) * 20;
            gameData.highestLevelCompleted = currentLevel;
        } else {
            goldEarned = 20;
        }
        gameData.gold += goldEarned;
        saveData();
        showOverlay('win', { gold: goldEarned });
    } else if (player.hp <= 0) {
        gameState = 'GAMEOVER';
        showOverlay('lose');
    }
}

// Hàm tiện ích để vẽ một đối tượng có co giãn
function drawEntity(entity, img) {
    if (!img.complete || img.naturalHeight === 0) return;

    ctx.save();
    // Di chuyển gốc tọa độ đến TÂM của đối tượng
    ctx.translate(entity.x + entity.width / 2, entity.y + entity.height / 2);
    // Áp dụng co giãn
    ctx.scale(entity.scaleX, entity.scaleY);
    // Vẽ ảnh tại gốc tọa độ mới (đã được dời về tâm)
    ctx.drawImage(img, -entity.width / 2, -entity.height / 2, entity.width, entity.height);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Sử dụng hàm drawEntity để vẽ player và bot
    drawEntity(player, playerImg);
    drawEntity(bot, botImg);

    // Vẽ thanh máu của player
    // Dịch chuyển vị trí thanh máu theo hiệu ứng nén của player
    //const playerBottom = player.y + player.height / 2 + (player.height / 2) * player.scaleY;
    const playerBottom = player.y + player.height;
    const pBarW = player.width + 20, pBarH = 14;
    const pBarX = player.x + (player.width - pBarW) / 2, pBarY = playerBottom + 8;
    const pFillW = (player.hp / player.maxHp) * pBarW;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.fillRect(pBarX, pBarY, pBarW, pBarH);
    ctx.fillStyle = '#4ade80'; ctx.fillRect(pBarX, pBarY, pFillW > 0 ? pFillW : 0, pBarH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`, pBarX + pBarW / 2, pBarY + pBarH / 2 + 1);
    
    // Vẽ đạn và hạt nổ
    player.bullets.forEach(b => { if (playerBulletImg.complete) ctx.drawImage(playerBulletImg, b.x, b.y, b.width, b.height); });
    bot.bullets.forEach(b => { if (botBulletImg.complete) ctx.drawImage(botBulletImg, b.x, b.y, b.width, b.height); });
    
    particles.forEach(p => {
        ctx.globalAlpha = p.lifespan / 60;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;
}

function loop() { 
    update(); 
    draw(); 
    requestAnimationFrame(loop); 
}

// --- Setup and Initialization ---
function fitCanvasToScreen() {
    const dpr = window.devicePixelRatio || 1;
    const screenWidth = window.innerWidth; const screenHeight = window.innerHeight;
    LOGICAL_W = screenWidth; LOGICAL_H = screenHeight;
    canvas.style.width = screenWidth + 'px'; canvas.style.height = screenHeight + 'px';
    canvas.width = Math.floor(screenWidth * dpr); canvas.height = Math.floor(screenHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (gameState === 'MENU') { player.x = LOGICAL_W / 2 - player.width / 2; player.y = LOGICAL_H - 150; }
}
function init() {
    fitCanvasToScreen(); 
    loadData();
    configureLevel(currentLevel); 
    updateUI();
    showOverlay('start');
    loop();
}

const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; }); 
window.addEventListener('keyup', e => { keys[e.code] = false; });
function isColliding(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function bindButton(el, keyName) {
    el.addEventListener('touchstart', e => { e.preventDefault(); keys[keyName] = true; }, { passive: false });
    el.addEventListener('touchend', e => { e.preventDefault(); keys[keyName] = false; }, { passive: false });
    el.addEventListener('mousedown', e => { e.preventDefault(); keys[keyName] = true; });
    window.addEventListener('mouseup', e => { if (keys[keyName]) { keys[keyName] = false; } });
    el.addEventListener('touchcancel', e => { keys[keyName] = false; }, { passive: false });
}
bindButton(document.getElementById('btnLeft'), 'ArrowLeft');
bindButton(document.getElementById('btnRight'), 'ArrowRight');
window.addEventListener('resize', fitCanvasToScreen);

const playerImg = new Image(); playerImg.src = 'cannon.png';
const botImg = new Image(); botImg.src = 'rubber-duck.png';
const playerBulletImg = new Image(); playerBulletImg.src = 'ball.png';
const botBulletImg = new Image(); botBulletImg.src = 'egg.png';

function shootPlayer() { 
    const shotCount = gameData.playerStats.shotLevel;
    const bulletWidth = 20;
    const bulletSpacing = 25;
    const centerX = player.x + player.width / 2 - bulletWidth / 2;
    const shootY = player.y + player.height / 2 - (player.height / 2) * player.scaleY - 20; // Bắn từ đỉnh của cannon co giãn
    
    if (shotCount === 1) {
        player.bullets.push({ x: centerX, y: shootY, width: bulletWidth, height: 20, speed: 8 });
    } else if (shotCount === 2) {
        player.bullets.push({ x: centerX - bulletSpacing / 2, y: shootY, width: bulletWidth, height: 20, speed: 8 });
        player.bullets.push({ x: centerX + bulletSpacing / 2, y: shootY, width: bulletWidth, height: 20, speed: 8 });
    } else if (shotCount === 3) {
        player.bullets.push({ x: centerX, y: shootY, width: bulletWidth, height: 20, speed: 8 });
        player.bullets.push({ x: centerX - bulletSpacing, y: shootY, width: bulletWidth, height: 20, speed: 8 });
        player.bullets.push({ x: centerX + bulletSpacing, y: shootY, width: bulletWidth, height: 20, speed: 8 });
    }
}
function shootBot() { 
    const shootY = bot.y + bot.height / 2 + (bot.height / 2) * bot.scaleY; // Bắn từ đáy của con vịt co giãn
    bot.bullets.push({ x: bot.x + bot.width / 2 - 10, y: shootY, width: 20, height: 20, speed: 4.5 }); 
}

init();