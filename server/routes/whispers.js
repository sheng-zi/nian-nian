const express = require('express');
const router = express.Router();
const { db } = require('../db');

function otherRole(req) {
  return req.user && req.user.role === 'boy' ? 'girl' : 'boy';
}

// Get inbox: whispers from the other person
router.get('/inbox', (req, res) => {
  const author = otherRole(req);
  const whispers = db.prepare(
    `SELECT id, content, author, is_read, created_at
     FROM whispers
     WHERE author = ? AND is_read = 0
     ORDER BY created_at DESC`
  ).all(author);
  res.json(whispers);
});

// Get sent whispers
router.get('/sent', (req, res) => {
  const author = req.user ? req.user.role : 'boy';
  const whispers = db.prepare(
    'SELECT id, content, author, is_read, created_at FROM whispers WHERE author = ? ORDER BY created_at DESC LIMIT 20'
  ).all(author);
  res.json(whispers);
});

// Send a whisper
router.post('/', (req, res) => {
  const { content } = req.body;
  const author = req.user ? req.user.role : 'boy';
  const result = db.prepare(
    'INSERT INTO whispers (content, author) VALUES (?, ?)'
  ).run(content, author);
  const broadcast = req.app.get('broadcast');
  if (broadcast) broadcast('whisper', { id: result.lastInsertRowid, content, author });
  res.json({ id: result.lastInsertRowid, message: '悄悄话已发送' });
});

// Mark as read
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE whispers SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: '已阅' });
});

module.exports = router;
