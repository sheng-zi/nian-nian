const crypto = require('crypto');

// In-memory token store: token → user
const tokens = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setToken(user) {
  const token = generateToken();
  tokens.set(token, { id: user.id, username: user.username, role: user.role, display_name: user.display_name });
  return token;
}

function removeToken(token) {
  tokens.delete(token);
}

// Auth middleware — attaches user to req if valid token, otherwise 401
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }
  const token = header.slice(7);
  const user = tokens.get(token);
  if (!user) {
    return res.status(401).json({ error: '登录已过期' });
  }
  req.user = user;
  next();
}

// Optional auth — attaches user if valid, but allows through without
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    const user = tokens.get(token);
    if (user) req.user = user;
  }
  next();
}

module.exports = { requireAuth, optionalAuth, setToken, removeToken, tokens };
