const db = require('../persistence');

module.exports = async (req, res) => {
    const homes = await db.getHomes();
    res.send(homes);
};
