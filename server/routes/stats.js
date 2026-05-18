const express = require('express');
const router = express.Router();
const { db } = require('../db');

function otherRole(req) {
  return req.user && req.user.role === 'boy' ? 'girl' : 'boy';
}

// Get all stats — identity-aware
router.get('/', (req, res) => {
  const author = otherRole(req);

  const anniversary = db.prepare('SELECT value FROM settings WHERE key = ?').get('anniversary_date');
  const startDate = new Date(anniversary ? anniversary.value : '2026-04-13');
  const now = new Date();
  const daysTogether = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

  const lettersCount = db.prepare('SELECT COUNT(*) as count FROM letters WHERE author = ?').get(author).count;
  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM letters WHERE author = ? AND is_read = 0').get(author).count;
  const wishesCount = db.prepare('SELECT COUNT(*) as count FROM wishes WHERE author = ?').get(author).count;
  const fulfilledCount = db.prepare('SELECT COUNT(*) as count FROM wishes WHERE author = ? AND is_fulfilled = 1').get(author).count;
  const timelineCount = db.prepare('SELECT COUNT(*) as count FROM timeline_items').get().count;
  const dailyCount = db.prepare('SELECT COUNT(*) as count FROM daily_notes').get().count;

  const couple = db.prepare('SELECT value FROM settings WHERE key = ?').get('couple_name');
  const boyName = db.prepare('SELECT value FROM settings WHERE key = ?').get('boy_name');
  const girlName = db.prepare('SELECT value FROM settings WHERE key = ?').get('girl_name');

  res.json({
    days_together: Math.max(0, daysTogether),
    letters_count: lettersCount,
    unread_letters: unreadCount,
    wishes_count: wishesCount,
    wishes_fulfilled: fulfilledCount,
    wishes_pending: wishesCount - fulfilledCount,
    timeline_count: timelineCount,
    daily_count: dailyCount,
    couple_name: couple ? couple.value : '',
    boy_name: boyName ? boyName.value : '',
    girl_name: girlName ? girlName.value : '',
    anniversary_date: anniversary ? anniversary.value : '',
  });
});

// Update settings
router.put('/settings', (req, res) => {
  const updates = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(key, String(value));
  }
  res.json({ message: '设置已更新' });
});

module.exports = router;
