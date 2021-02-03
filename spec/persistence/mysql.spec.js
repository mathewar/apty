const db = require('../../src/persistence/mysql');
const fs = require('fs');

const home = {
    id: '7aef3d7c-d301-4846-8358-2a91ec9d6be3',
    name: 'Test',
    completed: false,
};

beforeEach(() => {
    if (fs.existsSync('/etc/apty/apty.db')) {
        fs.unlinkSync('/etc/apty/apty.db');
    }
});

test('it initializes correctly', async () => {
    await db.init();
});

test('it can store and retrieve homes', async () => {
    await db.init();

    await db.storeHome(home);

    const homes = await db.getHomes();
    expect(homes.length).toBe(1);
    expect(homes[0]).toEqual(home);
});

test('it can update an existing home', async () => {
    await db.init();

    const initialhomes = await db.getHomes();
    expect(initialhomes.length).toBe(0);

    await db.storeHome(home);

    await db.updatehome(
        home.id,
        Object.assign({}, home, { completed: !home.completed }),
    );

    const homes = await db.getHomes();
    expect(homes.length).toBe(1);
    expect(homes[0].completed).toBe(!home.completed);
});

test('it can remove an existing home', async () => {
    await db.init();
    await db.storeHome(home);

    await db.removehome(home.id);

    const homes = await db.getHomes();
    expect(homes.length).toBe(0);
});

test('it can get a single home', async () => {
    await db.init();
    await db.storeHome(home);

    const home = await db.getHome(home.id);
    expect(home).toEqual(home);
});
