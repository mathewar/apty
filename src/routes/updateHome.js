const db = require('../persistence');

module.exports = async (req, res) => {
    await db.updateHome(req.params.id, {
        name: req.body.name,
        // completed: req.body.completed,
    });
    const item = await db.getHome(req.params.id);
    res.send(item);
};
