const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Get all timeline items — shared, both see all
router.get('/', (req, res) => {
  let items;
  if (req.query.milestone === '1') {
    items = db.prepare('SELECT * FROM timeline_items WHERE is_milestone = 1 ORDER BY date DESC').all();
  } else {
    items = db.prepare('SELECT * FROM timeline_items ORDER BY date DESC').all();
  }
  res.json(items.map(item => ({
    ...item,
    photos: JSON.parse(item.photos || '[]'),
    is_milestone: !!item.is_milestone
  })));
});

// "On this day" — memories from same month+day in previous years
router.get('/on-this-day', (req, res) => {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const thisYear = today.getFullYear();
  const items = db.prepare(
    `SELECT * FROM timeline_items
     WHERE substr(date, 6, 5) = ? AND substr(date, 1, 4) < ?
     ORDER BY date DESC`
  ).all(mm + '-' + dd, String(thisYear));
  res.json(items.map(item => ({
    ...item,
    photos: JSON.parse(item.photos || '[]'),
    is_milestone: !!item.is_milestone
  })));
});

// Timeline stats — shared
router.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM timeline_items').get();
  const milestones = db.prepare('SELECT COUNT(*) as count FROM timeline_items WHERE is_milestone = 1').get();
  const first = db.prepare('SELECT date FROM timeline_items ORDER BY date ASC LIMIT 1').get();
  const last = db.prepare('SELECT date FROM timeline_items ORDER BY date DESC LIMIT 1').get();
  const months = db.prepare(
    `SELECT COUNT(DISTINCT substr(date,1,7)) as count FROM timeline_items`
  ).get();
  res.json({
    total: total.count,
    milestones: milestones.count,
    first_date: first ? first.date : null,
    last_date: last ? last.date : null,
    months_span: months.count
  });
});

// Create timeline item
router.post('/', (req, res) => {
  const { date, title, content, photos, is_milestone } = req.body;
  const author = req.user ? req.user.role : 'boy';
  const result = db.prepare(
    'INSERT INTO timeline_items (date, title, content, photos, is_milestone, author) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(date, title, content, JSON.stringify(photos || []), is_milestone ? 1 : 0, author);
  res.json({ id: result.lastInsertRowid, message: '已添加到时光墙' });
});

// Toggle milestone
router.patch('/:id/milestone', (req, res) => {
  const item = db.prepare('SELECT is_milestone FROM timeline_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  const next = item.is_milestone ? 0 : 1;
  db.prepare('UPDATE timeline_items SET is_milestone = ? WHERE id = ?').run(next, req.params.id);
  res.json({ is_milestone: !!next, message: next ? '已标记为重要时刻' : '已取消标记' });
});

// Update timeline item
router.patch('/:id', (req, res) => {
  const { date, title, content, photos, is_milestone } = req.body;
  const item = db.prepare('SELECT * FROM timeline_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  db.prepare(
    'UPDATE timeline_items SET date=?, title=?, content=?, photos=?, is_milestone=? WHERE id=?'
  ).run(
    date || item.date,
    title || item.title,
    content || item.content,
    photos !== undefined ? JSON.stringify(photos) : item.photos,
    is_milestone !== undefined ? (is_milestone ? 1 : 0) : item.is_milestone,
    req.params.id
  );
  res.json({ message: '已更新' });
});

// Delete timeline item
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM timeline_items WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

// ── Comments ──

// Get comments for a timeline item
router.get('/:id/comments', (req, res) => {
  const comments = db.prepare(
    'SELECT * FROM timeline_comments WHERE timeline_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(comments);
});

// Add a comment
router.post('/:id/comments', (req, res) => {
  const { content } = req.body;
  const author = req.user ? req.user.role : 'boy';
  const result = db.prepare(
    'INSERT INTO timeline_comments (timeline_id, author, content) VALUES (?, ?, ?)'
  ).run(req.params.id, author, content);
  res.json({ id: result.lastInsertRowid, author, content, message: '评论已发送' });
});

// Delete a comment
router.delete('/:id/comments/:commentId', (req, res) => {
  db.prepare('DELETE FROM timeline_comments WHERE id = ? AND timeline_id = ?')
    .run(req.params.commentId, req.params.id);
  res.json({ message: '已删除' });
});

module.exports = router;
