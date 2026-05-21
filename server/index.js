const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDB, seedIfEmpty } = require('./db');
const { start: startBackup, doBackup } = require('./backup');

const app = express();
const server = http.createServer(app);

// ═══ Middleware ═══
app.use(require('compression')());
app.use(cors());
app.use(express.json());

// ═══ File upload ═══
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const uploadDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
app.use('/uploads', express.static(uploadDir));
app.use('/music', express.static(path.join(__dirname, '..', 'music')));

// ═══ Static frontends ═══
app.use('/app', express.static(path.join(__dirname, '..', 'app')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// ═══ Public routes (no auth required) ═══
app.use('/api/auth', require('./routes/auth'));
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件' });
  const ext = path.extname(req.file.originalname);
  const newName = Date.now() + ext;
  fs.renameSync(req.file.path, path.join(uploadDir, newName));
  res.json({ url: '/uploads/' + newName });
});

// ═══ Auth middleware ═══
const { requireAuth } = require('./middleware/auth');
app.use('/api', requireAuth);

// ═══ Protected API Routes ═══
app.use('/api/letters', require('./routes/letters'));
app.use('/api/wishes', require('./routes/wishes'));
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/daily', require('./routes/daily'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/moods', require('./routes/moods'));
app.use('/api/whispers', require('./routes/whispers'));

// ═══ WebSocket ═══
const wss = new WebSocketServer({ server });
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}
app.set('broadcast', broadcast);

// ═══ Manual backup endpoint ═══
app.post('/api/backup', (req, res) => {
  try {
    doBackup();
    res.json({ message: '备份完成' });
  } catch (err) {
    res.status(500).json({ error: '备份失败: ' + err.message });
  }
});

// ═══ Redirect root to app ═══
app.get('/', (req, res) => {
  res.redirect('/app');
});

// ═══ Start ═══
const PORT = process.env.PORT || 3456;

async function start() {
  await initDB();
  seedIfEmpty();
  startBackup();

  server.listen(PORT, () => {
    console.log('');
    console.log('  ✨ 念念 — 两个人的私密空间');
    console.log('  ───────────────────────────');
    console.log(`  📱 她的页面:  http://localhost:${PORT}/app`);
    console.log(`  ⚙️  管理后台:  http://localhost:${PORT}/admin`);
    console.log(`  🔌 WebSocket: ws://localhost:${PORT}`);
    console.log('');
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
