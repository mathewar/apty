const { v4: uuidv4 } = require('uuid');
const db = require('../persistence');

function auditLog(action, resourceType, getId, getSummary) {
    return (req, res, next) => {
        const doLog = (body) => {
            if (req.user) {
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
        };

        const origJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode < 400) doLog(body);
            return origJson(body);
        };

        const origSendStatus = res.sendStatus.bind(res);
        res.sendStatus = (code) => {
            if (code < 400) doLog(null);
            return origSendStatus(code);
        };

        next();
    };
}

module.exports = { auditLog };
