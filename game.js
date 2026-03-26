const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lobby = document.getElementById('lobby');
const joinBtn = document.getElementById('join-btn');
const nameInput = document.getElementById('name-input');
const playerCountEl = document.getElementById('player-count');
const chatLog = document.getElementById('chat-log');
const chatInputWrap = document.getElementById('chat-input-wrap');
const chatInput = document.getElementById('chat-input');
const chatHint = document.getElementById('chat-hint');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// --- Fish class (used for both local and remote) ---
class Fish {
  constructor({ id, name, color, x, y, angle }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.x = x ?? canvas.width / 2;
    this.y = y ?? canvas.height / 2;
    this.angle = angle ?? Math.random() * Math.PI * 2;
    this.tailAngle = 0;
    this.size = 40;
  }

  // Local player control
  initPlayer() {
    this.speed = 2.5;
    this.turnRate = 0.045;
  }

  updatePlayer() {
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) this.angle -= this.turnRate;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) this.angle += this.turnRate;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Wrap around screen edges
    if (this.x < -this.size)              this.x = canvas.width  + this.size;
    if (this.x > canvas.width  + this.size) this.x = -this.size;
    if (this.y < -this.size)              this.y = canvas.height + this.size;
    if (this.y > canvas.height + this.size) this.y = -this.size;

    this.tailAngle = Math.sin(Date.now() * 0.18) * 0.4;
  }

  // Apply remote state
  applyRemote(data) {
    this.x = data.x;
    this.y = data.y;
    this.angle = data.angle;
    this.tailAngle = data.tailAngle;
    if (data.size) this.size = data.size;
  }

  draw(isLocal = false) {
    const s = this.size;
    const { body, fin } = this.color;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Tail
    ctx.save();
    ctx.rotate(this.tailAngle);
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, 0);
    ctx.lineTo(-s * 1.2, -s * 0.5);
    ctx.lineTo(-s * 1.2, s * 0.5);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
    ctx.restore();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    // Top fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.42);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.85, s * 0.35, -s * 0.42);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();

    // Pectoral fin
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.3, s * 0.28, s * 0.13, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = fin;
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(s * 0.55, -s * 0.1, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.57, -s * 0.1, s * 0.055, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.arc(s * 0.92, s * 0.05, s * 0.07, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // Name tag (drawn in world space, always upright)
    ctx.save();
    ctx.translate(this.x, this.y - s * 0.7);
    ctx.font = `bold 13px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = isLocal ? `${this.name} (you)` : this.name;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-tw / 2 - 4, -16, tw + 8, 18);
    ctx.fillStyle = isLocal ? '#7dd4fc' : '#fff';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}

// --- Bubbles ---
class Bubble {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = canvas.height + 10;
    this.r = randomBetween(3, 8);
    this.speed = randomBetween(0.4, 1.2);
    this.wobble = Math.random() * Math.PI * 2;
  }
  update() {
    this.y -= this.speed;
    this.wobble += 0.04;
    this.x += Math.sin(this.wobble) * 0.4;
    if (this.y < -20) this.reset();
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// --- Helpers ---
function randomBetween(a, b) { return a + Math.random() * (b - a); }

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0a1a3a');
  grad.addColorStop(1, '#0d4f6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  for (let i = 0; i < 5; i++) {
    const x = (canvas.width / 5) * i + canvas.width / 10;
    const grad2 = ctx.createLinearGradient(x, 0, x + 60, canvas.height * 0.6);
    grad2.addColorStop(0, 'rgba(255,255,255,0.04)');
    grad2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 60, canvas.height * 0.6);
    ctx.lineTo(x - 20, canvas.height * 0.6);
    ctx.closePath();
    ctx.fillStyle = grad2;
    ctx.fill();
  }
  ctx.restore();
}

// --- Keyboard state ---
const keys = {};
window.addEventListener('keydown', (e) => {
  if (document.activeElement === chatInput) return;
  if (e.key === 'Enter' && localFish) { openChat(); return; }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// --- Food ---
let foodPellets = {}; // id -> { id, x, y }

function drawFood() {
  const t = Date.now() * 0.004;
  for (const pellet of Object.values(foodPellets)) {
    const pulse = 1 + Math.sin(t + pellet.x) * 0.3;
    const r = 5 * pulse;

    // Glow
    const glow = ctx.createRadialGradient(pellet.x, pellet.y, 0, pellet.x, pellet.y, r * 2.5);
    glow.addColorStop(0, 'rgba(160, 255, 100, 0.6)');
    glow.addColorStop(1, 'rgba(160, 255, 100, 0)');
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#aaff55';
    ctx.fill();
  }
}

// --- Chat ---
const chatBubbles = {}; // fishId -> { text, timer }
const BUBBLE_DURATION = 5000; // ms

function addChatBubble(fishId, text) {
  chatBubbles[fishId] = { text, born: Date.now() };
}

function drawChatBubbles() {
  const now = Date.now();
  for (const [fishId, bubble] of Object.entries(chatBubbles)) {
    const age = now - bubble.born;
    if (age > BUBBLE_DURATION) { delete chatBubbles[fishId]; continue; }

    const fish = fishId === 'local' ? localFish : remoteFishes[fishId];
    if (!fish) continue;

    const alpha = age > BUBBLE_DURATION * 0.7
      ? 1 - (age - BUBBLE_DURATION * 0.7) / (BUBBLE_DURATION * 0.3)
      : 1;

    const bx = fish.x;
    const by = fish.y - fish.size * 1.4;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const tw = Math.min(ctx.measureText(bubble.text).width, 180);
    const bw = tw + 20;
    const bh = 26;

    // Bubble background
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2, by - bh, bw, bh, 6);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(bx - 6, by);
    ctx.lineTo(bx + 6, by);
    ctx.lineTo(bx, by + 8);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = '#111';
    ctx.fillText(bubble.text, bx, by - 7, 180);
    ctx.restore();
  }
}

function addChatLogEntry(name, text) {
  const entry = document.createElement('div');
  entry.className = 'chat-entry';
  entry.innerHTML = `<span>${name}:</span> ${text}`;
  chatLog.appendChild(entry);
  // Keep only last 5 messages
  while (chatLog.children.length > 5) chatLog.removeChild(chatLog.firstChild);
  // Fade out after 8s
  setTimeout(() => entry.style.opacity = '0', 8000);
  setTimeout(() => entry.remove(), 8500);
}

function openChat() {
  chatInputWrap.style.display = 'block';
  chatHint.style.display = 'none';
  chatInput.value = '';
  chatInput.focus();
}

function closeChat() {
  chatInputWrap.style.display = 'none';
  chatHint.style.display = 'block';
  canvas.focus();
}

function sendChat() {
  const text = chatInput.value.trim();
  closeChat();
  if (!text || !localFish) return;
  addChatBubble('local', text);
  addChatLogEntry(localFish.name, text);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', text }));
  }
}

chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation(); // prevent game keys while typing
  if (e.key === 'Enter') sendChat();
  if (e.key === 'Escape') closeChat();
});

// --- Kill feed ---
const killFeed = []; // { text, alpha, y }

function showKillMessage(text) {
  killFeed.push({ text, alpha: 1, y: canvas.height / 2 - 40 });
}

function drawKillFeed() {
  for (let i = killFeed.length - 1; i >= 0; i--) {
    const k = killFeed[i];
    k.alpha -= 0.008;
    k.y -= 0.4;
    if (k.alpha <= 0) { killFeed.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = k.alpha;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.fillText(k.text, canvas.width / 2, k.y);
    ctx.restore();
  }
}

// --- Player collision ---
function checkPlayerCollision() {
  if (!localFish) return;
  // Head position (front of fish)
  const hx = localFish.x + Math.cos(localFish.angle) * localFish.size * 0.8;
  const hy = localFish.y + Math.sin(localFish.angle) * localFish.size * 0.8;

  for (const remote of Object.values(remoteFishes)) {
    const dx = hx - remote.x;
    const dy = hy - remote.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const collideRange = (localFish.size + remote.size) * 0.5;
    if (dist < collideRange) {
      if (localFish.size > remote.size * 1.1) {
        // We eat them
        localFish.size = Math.min(localFish.size + Math.floor(remote.size * 0.3), 200);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'kill', victimId: remote.id }));
        }
        showKillMessage(`You ate ${remote.name}!`);
      }
    }
  }
}

function checkFoodCollision() {
  if (!localFish) return;
  for (const pellet of Object.values(foodPellets)) {
    const dx = localFish.x - pellet.x;
    const dy = localFish.y - pellet.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < localFish.size * 0.9) {
      delete foodPellets[pellet.id];
      localFish.size = Math.min(localFish.size + 3, 120);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'eat', foodId: pellet.id }));
      }
    }
  }
}

// --- State ---
const bubbles = Array.from({ length: 20 }, () => {
  const b = new Bubble();
  b.y = Math.random() * canvas.height;
  return b;
});

let localFish = null;
let remoteFishes = {}; // id -> Fish
let ws = null;
let lastSendTime = 0;
const SEND_INTERVAL = 50; // ms, ~20 updates/sec

// --- WebSocket ---
function connect(name) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({
      type: 'join',
      name,
      x: localFish.x,
      y: localFish.y,
      angle: localFish.angle,
    }));
  });

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'init') {
      for (const [id, data] of Object.entries(msg.fishes)) {
        remoteFishes[id] = new Fish(data);
      }
      foodPellets = msg.food || {};
      updatePlayerCount();
    }

    if (msg.type === 'join') {
      remoteFishes[msg.fish.id] = new Fish(msg.fish);
      updatePlayerCount();
    }

    if (msg.type === 'update') {
      if (remoteFishes[msg.id]) {
        remoteFishes[msg.id].applyRemote(msg);
      }
    }

    if (msg.type === 'leave') {
      delete remoteFishes[msg.id];
      updatePlayerCount();
    }

    if (msg.type === 'respawn') {
      // We were eaten — reset position and size
      if (localFish) {
        localFish.x = msg.x;
        localFish.y = msg.y;
        localFish.angle = Math.random() * Math.PI * 2;
        localFish.size = 40;
        showKillMessage(`You were eaten by ${msg.killedBy}!`);
      }
    }

    if (msg.type === 'size_update') {
      if (remoteFishes[msg.id]) remoteFishes[msg.id].size = msg.size;
    }

    if (msg.type === 'chat') {
      const sender = remoteFishes[msg.id];
      if (sender) {
        addChatBubble(msg.id, msg.text);
        addChatLogEntry(sender.name, msg.text);
      }
    }

    if (msg.type === 'food_add') {
      foodPellets[msg.pellet.id] = msg.pellet;
    }

    if (msg.type === 'food_remove') {
      delete foodPellets[msg.id];
    }
  });

  ws.addEventListener('close', () => {
    setTimeout(() => connect(name), 2000); // auto-reconnect
  });
}

function updatePlayerCount() {
  const total = Object.keys(remoteFishes).length + 1;
  playerCountEl.textContent = `${total} fish in the ocean`;
}

// --- Join flow ---
function joinGame() {
  const name = nameInput.value.trim() || 'Fish';
  lobby.style.display = 'none';

  localFish = new Fish({
    id: 'local',
    name,
    color: { body: '#f4a460', fin: '#e8935a' }, // placeholder, server will assign real color
    x: randomBetween(200, canvas.width - 200),
    y: randomBetween(200, canvas.height - 200),
    angle: Math.random() * Math.PI * 2,
  });
  localFish.initPlayer();

  // Connect to server; color will be set on init response — for now fish swims immediately
  connect(name);
  updatePlayerCount();
}

joinBtn.addEventListener('click', joinGame);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinGame(); });

// --- Game loop ---
function loop() {
  drawBackground();
  bubbles.forEach(b => { b.update(); b.draw(); });

  drawFood();
  checkFoodCollision();
  checkPlayerCollision();
  drawKillFeed();

  // Draw remote fish
  for (const fish of Object.values(remoteFishes)) {
    fish.draw(false);
  }

  // Draw & update local fish
  if (localFish) {
    localFish.updatePlayer();
    localFish.draw(true);
  }

  drawChatBubbles();

  if (localFish) {

    // Send state to server
    const now = Date.now();
    if (ws && ws.readyState === WebSocket.OPEN && now - lastSendTime > SEND_INTERVAL) {
      lastSendTime = now;
      ws.send(JSON.stringify({
        type: 'update',
        x: localFish.x,
        y: localFish.y,
        angle: localFish.angle,
        tailAngle: localFish.tailAngle,
        size: localFish.size,
      }));
    }
  }

  requestAnimationFrame(loop);
}

loop();
