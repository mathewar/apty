const db = require('../../src/persistence');
const getHomes = require('../../src/routes/getHomes');
const ITEMS = [{ id: 12345 }];

jest.mock('../../src/persistence', () => ({
    getHomes: jest.fn(),
}));

test('it gets items correctly', async () => {
    const req = {};
    const res = { send: jest.fn() };
    db.getHomes.mockReturnValue(Promise.resolve(ITEMS));

    await getHomes(req, res);

    expect(db.getHomes.mock.calls.length).toBe(1);
    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(ITEMS);
});
