const express = require('express');
const router = express.Router();
const { db, getDailyLoveNote, getRandomLoveNote } = require('../db');

// Get today's daily note (auto-fallback to love note library)
router.get('/today', (req, res) => {
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const note = db.prepare('SELECT * FROM daily_notes WHERE show_date = ?').get(today);

  // Pick a random song from the pool (always random for rotation)
  const songs = db.prepare('SELECT * FROM song_pool ORDER BY RANDOM() LIMIT 1').all();
  const song = songs[0] || null;

  if (note) {
    res.json({
      ...note,
      song_name: song ? song.name : note.song_name,
      song_url: song ? song.url : note.song_url,
    });
  } else {
    const loveNote = getDailyLoveNote();
    res.json({
      love_note: loveNote,
      photo_url: '',
      song_name: song ? song.name : '',
      song_url: song ? song.url : '',
      from_library: true
    });
  }
});

// Get random love note from library (for inspiration)
router.get('/random', (req, res) => {
  res.json({ love_note: getRandomLoveNote() });
});

// Get all daily notes (admin)
router.get('/', (req, res) => {
  const notes = db.prepare('SELECT * FROM daily_notes ORDER BY show_date DESC').all();
  res.json(notes);
});

// Create/update daily note
router.post('/', (req, res) => {
  const { love_note, photo_url, song_name, song_url, show_date } = req.body;
  const existing = db.prepare('SELECT id FROM daily_notes WHERE show_date = ?').get(show_date);
  if (existing) {
    db.prepare(
      'UPDATE daily_notes SET love_note=?, photo_url=?, song_name=?, song_url=? WHERE show_date=?'
    ).run(love_note, photo_url || '', song_name || '', song_url || '', show_date);
    res.json({ message: '已更新' });
  } else {
    db.prepare(
      'INSERT INTO daily_notes (love_note, photo_url, song_name, song_url, show_date) VALUES (?, ?, ?, ?, ?)'
    ).run(love_note, photo_url || '', song_name || '', song_url || '', show_date);
    res.json({ message: '已创建' });
  }
});

// Delete daily note
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM daily_notes WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

// ── Daily Messages ──
function otherRole(req) {
  return req.user && req.user.role === 'boy' ? 'girl' : 'boy';
}

// Get today's messages from both
router.get('/messages/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare('SELECT author, content FROM daily_messages WHERE date = ?').all(today);
  const result = { boy_msg: null, girl_msg: null };
  rows.forEach(r => {
    if (r.author === 'boy') result.boy_msg = r.content;
    if (r.author === 'girl') result.girl_msg = r.content;
  });
  res.json(result);
});

// Set today's message for current user
router.post('/messages', (req, res) => {
  const { content } = req.body;
  const author = req.user ? req.user.role : 'girl';
  const today = new Date().toISOString().split('T')[0];
  db.prepare('INSERT OR REPLACE INTO daily_messages (author, content, date) VALUES (?, ?, ?)').run(author, content, today);
  res.json({ message: '已发送' });
});

// "Thinking of you" — broadcast to partner
router.post('/thinking', (req, res) => {
  const author = req.user ? req.user.role : 'boy';
  const broadcast = req.app.get('broadcast');
  if (broadcast) broadcast('thinking', { author, time: new Date().toISOString() });
  res.json({ message: '已发送 💕' });
});

module.exports = router;
