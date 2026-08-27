// Auth helpers for the Express API.
import { Manager } from '../core/manager.js';

export function authMiddleware(manager) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    let token = null;
    if (header.startsWith('Bearer ')) token = header.slice(7);
    else if (req.cookies && req.cookies.session) token = req.cookies.session;
    const user = token ? manager.sessionFor(token) : null;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  };
}

export function optionalAuth(manager) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    let token = header.startsWith('Bearer ') ? header.slice(7) : (req.cookies && req.cookies.session) || null;
    req.user = token ? manager.sessionFor(token) : null;
    next();
  };
}
