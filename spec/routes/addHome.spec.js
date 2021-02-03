const db = require('../../src/persistence');
const addItem = require('../../src/routes/addHome');
const ITEM = { id: 12345 };
const uuid = require('uuid/v4');

jest.mock('uuid/v4', () => jest.fn());

jest.mock('../../src/persistence', () => ({
    removeHome: jest.fn(),
    storeHome: jest.fn(),
    getHome: jest.fn(),
}));

test('it stores item correctly', async () => {
    const id = 'something-not-a-uuid';
    const name = 'A sample item';
    const req = { body: { name } };
    const res = { send: jest.fn() };

    uuid.mockReturnValue(id);

    await addItem(req, res);

    const expectedItem = { id, name };

    expect(db.storeHome.mock.calls.length).toBe(1);
    expect(db.storeHome.mock.calls[0][0]).toEqual(expectedItem);
    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(expectedItem);
});
