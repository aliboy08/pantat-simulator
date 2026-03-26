const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname)));

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

  // Send init: assign ID + current fish list
  ws.send(JSON.stringify({
    type: 'init',
    id,
    color,
    fishes,
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
      };
      // Tell everyone else a new fish joined
      broadcastExcept(id, { type: 'join', fish: fishes[id] });
    }

    if (msg.type === 'update') {
      if (!fishes[id]) return;
      fishes[id].x = msg.x;
      fishes[id].y = msg.y;
      fishes[id].angle = msg.angle;
      fishes[id].tailAngle = msg.tailAngle;
      // Broadcast updated state to everyone else
      broadcastExcept(id, { type: 'update', id, x: msg.x, y: msg.y, angle: msg.angle, tailAngle: msg.tailAngle });
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
