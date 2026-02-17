const { getPermissionsForRole } = require('../auth/permissions');

// Runs on every request. If a session exists, attach user + resolved permissions to req.user.
function attachPermissions(req, res, next) {
    if (req.session && req.session.user) {
        req.user = {
            ...req.session.user,
            permissions: getPermissionsForRole(req.session.user.role),
        };
    } else {
        req.user = null;
    }
    next();
}

// Require a logged-in session.
function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    next();
}

// Require a specific permission. Also implies requireAuth.
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({ error: 'Insufficient permissions', required: permission });
        }
        next();
    };
}

module.exports = { attachPermissions, requireAuth, requirePermission };
