const express = require('express');
const router = express.Router();
const { db } = require('../db');

function today() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

// Get today's moods for both people
router.get('/today', (req, res) => {
  const rows = db.prepare('SELECT author, mood FROM moods WHERE date = ?').all(today());
  const result = { boy_mood: null, girl_mood: null };
  rows.forEach(r => {
    if (r.author === 'boy') result.boy_mood = r.mood;
    if (r.author === 'girl') result.girl_mood = r.mood;
  });
  res.json(result);
});

// Set today's mood (upsert) — uses logged-in user's role
router.post('/', (req, res) => {
  const { mood } = req.body;
  const author = req.user ? req.user.role : 'girl';
  db.prepare('INSERT OR REPLACE INTO moods (author, mood, date) VALUES (?, ?, ?)').run(author, mood, today());
  res.json({ message: '心情已记录' });
});

// Get mood streak for current user
router.get('/streak', (req, res) => {
  const author = req.user ? req.user.role : 'girl';
  const rows = db.prepare('SELECT date FROM moods WHERE author = ? ORDER BY date DESC LIMIT 60').all(author);
  if (rows.length === 0) return res.json({ streak: 0 });

  const dates = rows.map(r => r.date);
  const todayStr = today();
  let streak = 0;

  // check if today or yesterday has a mood
  const latest = dates[0];
  if (latest !== todayStr && latest !== yesterday()) return res.json({ streak: 0 });

  // count consecutive days backwards
  let expected = new Date(latest);
  for (const d of dates) {
    const expectedStr = expected.toISOString().split('T')[0];
    if (d === expectedStr) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }
  res.json({ streak });
});

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

module.exports = router;
