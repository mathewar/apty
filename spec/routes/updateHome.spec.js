const db = require('../../src/persistence');
const updateHome = require('../../src/routes/updateHome');
const ITEM = { id: 12345 };

jest.mock('../../src/persistence', () => ({
    getHome: jest.fn(),
    updateHome: jest.fn(),
}));

test('it updates items correctly', async () => {
    const req = {
        params: { id: 1234 },
        body: { name: 'New title' },
    };
    const res = { send: jest.fn() };

    db.getHome.mockReturnValue(Promise.resolve(ITEM));

    await updateHome(req, res);

    expect(db.updateHome.mock.calls.length).toBe(1);
    expect(db.updateHome.mock.calls[0][0]).toBe(req.params.id);
    expect(db.updateHome.mock.calls[0][1]).toEqual({
        name: 'New title',
    });

    expect(db.getHome.mock.calls.length).toBe(1);
    expect(db.getHome.mock.calls[0][0]).toBe(req.params.id);

    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(ITEM);
});
