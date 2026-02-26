const { v4: uuidv4 } = require('uuid');
const db = require('../persistence');

function auditLog(action, resourceType, getId, getSummary) {
    return (req, res, next) => {
        const orig = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode < 400 && req.user) {
                db.storeAuditEntry({
                    id: uuidv4(),
                    user_id: req.user.id || null,
                    user_email: req.user.email,
                    user_role: req.user.role,
                    action,
                    resource_type: resourceType,
                    resource_id: getId(req, body),
                    summary: getSummary(req, body),
                }).catch(() => {});
            }
            return orig(body);
        };
        next();
    };
}

module.exports = { auditLog };
