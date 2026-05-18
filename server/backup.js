const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'niannian.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function doBackup() {
  if (!fs.existsSync(DB_PATH)) return;

  ensureDir();
  const dest = path.join(BACKUP_DIR, `niannian-${timestamp()}.db`);
  fs.copyFileSync(DB_PATH, dest);
  console.log(`  💾 备份: ${path.basename(dest)}`);

  cleanup();
}

function cleanup() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('niannian-') && f.endsWith('.db'))
    .sort(); // oldest first

  // Keep last 72 hourly backups, delete older
  while (files.length > 72) {
    const old = files.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, old));
    console.log(`  🗑️  清理旧备份: ${old}`);
  }
}

function start(intervalMs = 60 * 60 * 1000) {
  ensureDir();
  console.log('  💾 自动备份已启动（每小时）');
  doBackup(); // backup on start
  setInterval(doBackup, intervalMs);
}

module.exports = { start, doBackup, BACKUP_DIR };
