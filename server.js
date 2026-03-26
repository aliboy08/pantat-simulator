const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// fish colors pool
const COLORS = [
  { body: '#f4a460', fin: '#e8935a' },
  { body: '#ff6b6b', fin: '#cc4444' },
  { body: '#6bcfff', fin: '#3a9ecc' },
  { body: '#b8f06b', fin: '#7ab83a' },
  { body: '#f0c060', fin: '#c89030' },
  { body: '#d06bff', fin: '#9a3acc' },
  { body: '#ff9f40', fin: '#cc6a10' },
  { body: '#40ffd0', fin: '#10cc90' },
];

const fishes = {}; // id -> fish state

// --- Food ---
const FOOD_COUNT = 40;
const food = {}; // id -> { id, x, y }

function spawnFood() {
  const id = randomUUID();
  food[id] = { id, x: Math.random() * 2000, y: Math.random() * 1200 };
  return food[id];
}

for (let i = 0; i < FOOD_COUNT; i++) spawnFood();

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function broadcastExcept(excludeId, data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.fishId !== excludeId) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  const id = randomUUID();
  ws.fishId = id;

  const colorIndex = Object.keys(fishes).length % COLORS.length;
  const color = COLORS[colorIndex];

  // Send init: assign ID + current fish list + food
  ws.send(JSON.stringify({
    type: 'init',
    id,
    color,
    fishes,
    food,
  }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      const name = String(msg.name || 'Fish').slice(0, 20);
      fishes[id] = {
        id,
        name,
        color,
        x: msg.x,
        y: msg.y,
        angle: msg.angle,
        tailAngle: 0,
        size: 40,
      };
      // Tell everyone else a new fish joined
      broadcastExcept(id, { type: 'join', fish: fishes[id] });
    }

    if (msg.type === 'kill') {
      const attacker = fishes[id];
      const victim = fishes[msg.victimId];
      if (!attacker || !victim) return;
      if (attacker.size <= victim.size) return; // server validates

      // Grow attacker
      attacker.size = Math.min(attacker.size + Math.floor(victim.size * 0.3), 200);
      broadcast({ type: 'size_update', id, size: attacker.size });

      // Respawn victim at random position
      const respawnX = Math.random() * 1600 + 100;
      const respawnY = Math.random() * 900 + 100;
      victim.size = 40;
      victim.x = respawnX;
      victim.y = respawnY;

      // Tell victim they were eaten
      wss.clients.forEach(client => {
        if (client.fishId === msg.victimId && client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'respawn',
            killedBy: attacker.name,
            x: respawnX,
            y: respawnY,
          }));
        }
      });

      // Tell everyone else victim respawned
      broadcastExcept(msg.victimId, { type: 'size_update', id: msg.victimId, size: 40 });
    }

    if (msg.type === 'eat') {
      const pellet = food[msg.foodId];
      if (!pellet) return;
      delete food[msg.foodId];
      broadcast({ type: 'food_remove', id: msg.foodId });
      // Spawn a replacement
      const newPellet = spawnFood();
      broadcast({ type: 'food_add', pellet: newPellet });
    }

    if (msg.type === 'update') {
      if (!fishes[id]) return;
      fishes[id].x = msg.x;
      fishes[id].y = msg.y;
      fishes[id].angle = msg.angle;
      fishes[id].tailAngle = msg.tailAngle;
      if (msg.size) fishes[id].size = Math.min(msg.size, 200);
      // Broadcast updated state to everyone else
      broadcastExcept(id, { type: 'update', id, x: msg.x, y: msg.y, angle: msg.angle, tailAngle: msg.tailAngle, size: fishes[id].size });
    }
  });

  ws.on('close', () => {
    delete fishes[id];
    broadcast({ type: 'leave', id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Fish Simulator running at http://localhost:${PORT}`);
});
