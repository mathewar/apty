const db = require('../persistence');
const uuid = require('uuid/v4');

module.exports = async (req, res) => {
    const home = {
        id: uuid(),
        name: req.body.name,
    };

    await db.storeHome(home);
    res.send(home);
};
