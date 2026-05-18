const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { setToken, removeToken, requireAuth } = require('../middleware/auth');

// Login (public)
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const hash = crypto.pbkdf2Sync(password, user.salt, 10000, 64, 'sha512').toString('hex');
  if (hash !== user.password_hash) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = setToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
    },
  });
});

// Get current user (protected)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Logout (protected)
router.post('/logout', requireAuth, (req, res) => {
  removeToken(req.headers.authorization.slice(7));
  res.json({ message: '已退出' });
});

module.exports = router;
