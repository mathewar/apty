const db = require('../../src/persistence');
const deleteHome = require('../../src/routes/deleteHome');
const ITEM = { id: 12345 };

jest.mock('../../src/persistence', () => ({
    removeHome: jest.fn(),
    getHome: jest.fn(),
}));

test('it removes home correctly', async () => {
    const req = { params: { id: 12345 } };
    const res = { sendStatus: jest.fn() };

    await deleteHome(req, res);

    expect(db.removeHome.mock.calls.length).toBe(1);
    expect(db.removeHome.mock.calls[0][0]).toBe(req.params.id);
    expect(res.sendStatus.mock.calls[0].length).toBe(1);
    expect(res.sendStatus.mock.calls[0][0]).toBe(200);
});
