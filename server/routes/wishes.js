const express = require('express');
const router = express.Router();
const { db } = require('../db');

function otherRole(req) {
  return req.user && req.user.role === 'boy' ? 'girl' : 'boy';
}

// Get wishes — show "their" wishes for me to fulfill
router.get('/', (req, res) => {
  const author = otherRole(req);
  const wishes = db.prepare(
    'SELECT * FROM wishes WHERE author = ? ORDER BY is_fulfilled ASC, created_at DESC'
  ).all(author);
  res.json(wishes);
});

// Get my own wishes (to track fulfillment status)
router.get('/mine', (req, res) => {
  const author = req.user ? req.user.role : 'girl';
  const wishes = db.prepare(
    'SELECT * FROM wishes WHERE author = ? ORDER BY is_fulfilled ASC, created_at DESC'
  ).all(author);
  res.json(wishes);
});

// Get pending wishes count
router.get('/pending-count', (req, res) => {
  const author = otherRole(req);
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM wishes WHERE is_fulfilled = 0 AND author = ?'
  ).get(author);
  res.json({ count: row.count });
});

// Create wish
router.post('/', (req, res) => {
  const { content } = req.body;
  const author = req.user ? req.user.role : 'girl';
  const result = db.prepare('INSERT INTO wishes (content, author) VALUES (?, ?)').run(content, author);
  res.json({ id: result.lastInsertRowid, message: '愿望已许下' });
});

// Fulfill wish
router.put('/:id/fulfill', (req, res) => {
  db.prepare('UPDATE wishes SET is_fulfilled = 1, fulfilled_at = datetime("now","localtime") WHERE id = ?').run(req.params.id);
  res.json({ message: '愿望已实现 ✨' });
});

// Delete wish
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM wishes WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

module.exports = router;
