const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'niannian.db');

let db = null;
let SQL = null;

// Initialize database
async function initDB() {
  SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode and foreign keys
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS letters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      cover_image TEXT DEFAULT '',
      audio_url TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      reaction TEXT DEFAULT '',
      scheduled_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      author TEXT DEFAULT '她',
      is_fulfilled INTEGER DEFAULT 0,
      fulfilled_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS timeline_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      photos TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      love_note TEXT NOT NULL,
      photo_url TEXT DEFAULT '',
      song_name TEXT DEFAULT '',
      song_url TEXT DEFAULT '',
      show_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS moods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      mood TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(author, date)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS whispers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      author TEXT DEFAULT 'boy',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL
    )
  `);

  // Migration: add is_milestone column if not exists
  try {
    db.run('ALTER TABLE timeline_items ADD COLUMN is_milestone INTEGER DEFAULT 0');
  } catch (e) {
    // column already exists, ignore
  }

  // Migration: add author column to letters
  try {
    db.run("ALTER TABLE letters ADD COLUMN author TEXT DEFAULT 'boy'");
  } catch (e) {
    // column already exists, ignore
  }

  // Migration: add author column to timeline_items
  try {
    db.run("ALTER TABLE timeline_items ADD COLUMN author TEXT DEFAULT 'boy'");
  } catch (e) {
    // column already exists, ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(author, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS song_pool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      artist TEXT DEFAULT ''
    )
  `);

  // Default settings
  const defaults = {
    'anniversary_date': '2026-04-13',
    'couple_name': '张学晟 & 彭子萱',
    'boy_name': '狐狸先生',
    'girl_name': '彭子萱',
  };
  for (const [key, value] of Object.entries(defaults)) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  saveDB();
  console.log('  📦 数据库已就绪');
}

// Save database to disk
function saveDB() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// ── Helper: convert sql.js result to array of objects ──
function toRows(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ── Wrapper with better-sqlite3-like API ──
const dbWrapper = {
  prepare: (sql) => ({
    get: (...params) => {
      const result = db.exec(sql, params);
      const rows = toRows(result);
      return rows[0] || null;
    },
    all: (...params) => {
      const result = db.exec(sql, params);
      return toRows(result);
    },
    run: (...params) => {
      db.run(sql, params);
      const idResult = db.exec('SELECT last_insert_rowid() as id');
      const lastID = toRows(idResult)[0] ? toRows(idResult)[0].id : null;
      saveDB();
      return { lastInsertRowid: lastID };
    },
  }),
  exec: (sql) => {
    db.run(sql);
    saveDB();
  },
};

// ── 情话语录库 (60条) ──
const LOVE_NOTES = [
  '认识你之前，我以为生活就是一天天过。认识你之后，每一天都有了期待。',
  '你是银河赠予我的糖，让平凡的日子都变得闪闪发光。',
  '世界很大，大到我们花了很久才相遇。世界很小，小到我的眼里只容得下你。',
  '无论今天发生什么，想到你就觉得人间值得。',
  '你是我白开水般的日子里，偷偷加的一颗糖。',
  '遇见你之后，我的每个晚安都有了归属，每个早安都有了期待。',
  '如果人生是一场电影，那你就是我唯一的彩蛋。',
  '你一笑，我的世界就亮了。',
  '在这个什么都善变的世间，我想和你看一看永远。',
  '我想和你一起虚度时光，比如低头看鱼，比如把茶杯留在桌子上离开，浪费它们好看的阴影。',
  '你是我的半截的诗，不许别人更改一个字。',
  '想和你并肩走在夏天的晚风里，看月亮慢慢爬上树梢。',
  '我没有什么伟大的梦想，最大的梦想就是你。',
  '你今天真好看，比昨天还好看一点，比明天差一点——因为明天的你会更好看。',
  '如果说生活是一张拼图，那你就是最中间那一块，没有你，一切都不完整。',
  '谢谢你来到我身边，带着山谷的风，带着原始的阳光，带着郁郁葱葱的森林。',
  '我想你的次数，比天上的星星还多。',
  '你让我的世界从黑白变成了彩色。',
  '所有的不期而遇，都是我的蓄谋已久。',
  '你是我坚定不移的选择，不是权衡利弊后的将就。',
  '我们可以吵架，可以冷战，但你不可以喜欢别人。',
  '每次手机响了，我都希望是你。',
  '我想和你在一起，从晨光熹微到暮色四合。',
  '你是我日记里出现最多的名字。',
  '我们慢慢来，谁不是翻山越岭去爱。',
  '你陪着我的时候，我从来没有羡慕过任何人。',
  '我想用一辈子的时间，和你做遍所有无聊的小事。',
  '你笑起来眼睛弯弯的，像我第一次见到你的那个晴天。',
  '我以为我见过世面，直到遇见了你。',
  '你是我的例外，也是我的偏爱。',
  '喜欢你这件事，我打算坚持一辈子。',
  '春天应该暗恋一个人，然后夏天和他私奔。',
  '你是我遇到的所有美好里，最好的那一个。',
  '每天早上醒来，看到你和阳光都在，就是我想要的未来。',
  '我对你，大概就是简简单单的四个字：非你不可。',
  '你是我写不出的诗，唱不完的歌，画不出的画。',
  '爱是和你在一起，年年念念，念念年年。',
  '想成为你任何时候回头看，都在的那个人。',
  '你让我觉得，以前受过的所有委屈都值了。',
  '我的浪漫和极端全都给了你。',
  '等我们老了，就在院子里种满花，你浇花我看你。',
  '能让我努力奔跑的人是你，能让我停下来的人也是你。',
  '你一笑，我就觉得所有的等待都有了意义。',
  '这辈子很短，但爱你很长。',
  '想和你一起看日出日落，看云卷云舒，看四季更替，看人间冷暖。',
  '遇见你，是我这辈子最美丽的意外。',
  '你是我的心跳，是我的呼吸，是我生命里不可或缺的一部分。',
  '我想要的很简单：你在身边，在你身边。',
  '不论异地还是同城，只要心在一起，距离就不是问题。',
  '你是我所有灵感的来源，是我疲惫时最温暖的港湾。',
  '和喜欢的人在一起，连沉默都是甜的。',
  '你不需要多好，我喜欢就好。',
  '有些路很远，走下去会很累。可是不走，会后悔。有你在，我愿意走。',
  '这世界太吵，你来我身边就好。',
  '最好的关系是：我懂你的言外之意，也心疼你的欲言又止。',
  '和你在一起的时光，全都很耀眼。因为天气好，因为天气不好，因为天气刚刚好。',
  '我想成为你的夜晚，也成为你的早晨。',
  '唯一有效的安慰方式，就是你在我身边。',
  '月亮不会奔你而来，但我会。',
  '你是年少的欢喜，这句话倒过来，也是你。',
];

// 根据日期获取固定的情话索引（同一天返回相同，不同天返回不同）
function getDailyLoveNoteIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  // 使用质数 137 做乘数，保证分布均匀且周期长
  return (dayOfYear * 137) % LOVE_NOTES.length;
}

function getDailyLoveNote() {
  return LOVE_NOTES[getDailyLoveNoteIndex()];
}

function getRandomLoveNote() {
  const idx = Math.floor(Math.random() * LOVE_NOTES.length);
  return LOVE_NOTES[idx];
}

function getAllLoveNotes() {
  return LOVE_NOTES;
}

// Seed some initial data if database is empty
function seedIfEmpty() {
  const count = dbWrapper.prepare('SELECT COUNT(*) as count FROM letters').get();
  if (count && count.count === 0) {
    dbWrapper.prepare(
      'INSERT INTO letters (title, content, is_read) VALUES (?, ?, ?)'
    ).run('💌 欢迎来到念念', '嗨，彭子萱。\n\n这是属于我们两个人的私密空间。\n\n以后我会在这里给你写信，你随时可以回来看。每一封信都是我想对你说的话。\n\n你可以去许愿池扔愿望，我会一个一个帮你实现。\n\n你可以去时光墙看看我们的故事。\n\n你也可以每天来这里看看"今日心动"，那里有我为你准备的每日一份甜。\n\n—— 永远爱你的狐狸先生 🦊', 0);

    dbWrapper.prepare(
      'INSERT INTO wishes (content, author) VALUES (?, ?)'
    ).run('想和你一起看一次日落', 'girl');

    dbWrapper.prepare(
      'INSERT INTO wishes (content, is_fulfilled, fulfilled_at, author) VALUES (?, ?, ?, ?)'
    ).run('收到一封手写信', 1, '2026-04-13', 'girl');

    dbWrapper.prepare(
      'INSERT INTO timeline_items (date, title, content, author) VALUES (?, ?, ?, ?)'
    ).run('2026-02-13', '第一次联系', '凌晨00:17，你给我发了第一条抖音消息。两颗星星在浩瀚宇宙中有了第一次交集。', 'boy');

    dbWrapper.prepare(
      'INSERT INTO timeline_items (date, title, content, author) VALUES (?, ?, ?, ?)'
    ).run('2026-03-13', '第一次见面', '因为省考我们第一次见面了。那天很特别——考试很重要，但见到你这件事更让人心跳加速。', 'boy');

    dbWrapper.prepare(
      'INSERT INTO timeline_items (date, title, content, author) VALUES (?, ?, ?, ?)'
    ).run('2026-04-13', '正式在一起', '我们的纪念日。从这一天起，狐狸先生有了最想守护的人。以后的每一个4月13日都会陪在你身边。', 'boy');

    dbWrapper.prepare(
      'INSERT INTO daily_notes (love_note, song_name, show_date) VALUES (?, ?, ?)'
    ).run('认识你之前，我以为生活就是一天天过。认识你之后，每一天都有了期待。', '今天也想见到你', new Date().toISOString().split('T')[0]);

    saveDB();
    console.log('  🌱 已初始化示例数据');
  }

  // Seed default users if users table is empty
  const userCount = dbWrapper.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount && userCount.count === 0) {
    const hashPassword = (pw) => {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(pw, salt, 10000, 64, 'sha512').toString('hex');
      return { salt, hash };
    };
    const boy = hashPassword('fox123');
    const girl = hashPassword('peng123');
    dbWrapper.prepare(
      'INSERT INTO users (username, password_hash, salt, role, display_name) VALUES (?, ?, ?, ?, ?)'
    ).run('boy', boy.hash, boy.salt, 'boy', '狐狸先生');
    dbWrapper.prepare(
      'INSERT INTO users (username, password_hash, salt, role, display_name) VALUES (?, ?, ?, ?, ?)'
    ).run('girl', girl.hash, girl.salt, 'girl', '彭子萱');
    saveDB();
    console.log('  👤 已创建默认账号: boy/fox123, girl/peng123');
  }

  // Seed song pool if empty
  const songCount = dbWrapper.prepare('SELECT COUNT(*) as count FROM song_pool').get();
  if (songCount && songCount.count === 0) {
    const songs = [
      ['Summer (菊次郎的夏天)', '/music/summer-hisaishi.mp3', '久石让'],
      ['天空之城', '/music/castle-in-sky.mp3', '久石让'],
      ['One Summer\'s Day', '/music/one-summers-day.mp3', '久石让'],
      ['River Flows in You', '/music/river-flows.mp3', 'Yiruma'],
      ['Canon in D', '/music/canon.mp3', 'Pachelbel'],
      ['Wedding Dream', '/music/wedding-dream.mp3', 'Daydream'],
    ];
    const insert = dbWrapper.prepare('INSERT INTO song_pool (name, url, artist) VALUES (?, ?, ?)');
    for (const s of songs) insert.run(...s);
    saveDB();
    console.log('  🎵 已初始化 6 首默认音乐');
  }
}

module.exports = { initDB, db: dbWrapper, seedIfEmpty, saveDB, getDailyLoveNote, getRandomLoveNote, getAllLoveNotes };
