const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Helper: given viewer role, return the author whose content they see
function otherRole(req) {
  return req.user && req.user.role === 'boy' ? 'girl' : 'boy';
}

// Get all letters (admin)
router.get('/', (req, res) => {
  const letters = db.prepare('SELECT * FROM letters ORDER BY created_at DESC').all();
  res.json(letters);
});

// Get unread letters count
router.get('/unread-count', (req, res) => {
  const author = otherRole(req);
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM letters
     WHERE author = ?
     AND is_read = 0
     AND (scheduled_at IS NULL OR scheduled_at <= datetime("now","localtime"))`
  ).get(author);
  res.json({ count: row.count });
});

// Get available letters for viewer
router.get('/inbox', (req, res) => {
  const author = otherRole(req);
  const letters = db.prepare(`
    SELECT id, title, content, cover_image, audio_url, is_read, reaction, scheduled_at, created_at, author
    FROM letters
    WHERE author = ?
    AND (scheduled_at IS NULL OR REPLACE(scheduled_at, 'T', ' ') <= datetime('now', 'localtime'))
    ORDER BY created_at DESC
  `).all(author);
  res.json(letters);
});

// Create letter
router.post('/', (req, res) => {
  const { title, content, cover_image, audio_url, scheduled_at } = req.body;
  const author = req.user ? req.user.role : 'boy';
  const normalized = scheduled_at ? scheduled_at.replace('T', ' ') : null;
  const result = db.prepare(
    'INSERT INTO letters (title, content, cover_image, audio_url, scheduled_at, author) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, content, cover_image || '', audio_url || '', normalized, author);
  res.json({ id: result.lastInsertRowid, message: '信已写好' });
});

// Mark as read
router.put('/:id/read', (req, res) => {
  db.prepare('UPDATE letters SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: '已读' });
});

// Add reaction
router.put('/:id/react', (req, res) => {
  const { emoji } = req.body;
  db.prepare('UPDATE letters SET reaction = ? WHERE id = ?').run(emoji, req.params.id);
  res.json({ message: '已回复', emoji });
});

// Delete letter
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM letters WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

module.exports = router;
