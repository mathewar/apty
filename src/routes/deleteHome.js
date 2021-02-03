const db = require('../persistence');

module.exports = async (req, res) => {
    await db.removeHome(req.params.id);
    res.sendStatus(200);
};
