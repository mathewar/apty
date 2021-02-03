const waitPort = require('wait-port');
const fs = require('fs');
const mysql = require('mysql');

const {
    MYSQL_HOST: HOST,
    MYSQL_HOST_FILE: HOST_FILE,
    MYSQL_USER: USER,
    MYSQL_USER_FILE: USER_FILE,
    MYSQL_PASSWORD: PASSWORD,
    MYSQL_PASSWORD_FILE: PASSWORD_FILE,
    MYSQL_DB: DB,
    MYSQL_DB_FILE: DB_FILE,
} = process.env;

let pool;

async function init() {
    const host = HOST_FILE ? fs.readFileSync(HOST_FILE) : HOST;
    const user = USER_FILE ? fs.readFileSync(USER_FILE) : USER;
    const password = PASSWORD_FILE ? fs.readFileSync(PASSWORD_FILE) : PASSWORD;
    const database = DB_FILE ? fs.readFileSync(DB_FILE) : DB;

    await waitPort({ host, port: 3306 });

    pool = mysql.createPool({
        connectionLimit: 5,
        host,
        user,
        password,
        database,
    });

    return new Promise((acc, rej) => {
        pool.query(
            'CREATE TABLE IF NOT EXISTS homes (id varchar(36), parent_id varchar(36), name varchar(255), details JSON)',
            err => {
                if (err) return rej(err);
                console.log(`Connected to mysql db at host ${HOST}`);
                acc();
            },
        );
    });
}

async function teardown() {
    return new Promise((acc, rej) => {
        pool.end(err => {
            if (err) rej(err);
            else acc();
        });
    });
}

async function getHomes() {
    return new Promise((acc, rej) => {
        pool.query('SELECT * FROM homes', (err, rows) => {
            if (err) return rej(err);
            acc(rows.map(item => Object.assign({}, item)));
        });
    });
}

async function getHome(id) {
    return new Promise((acc, rej) => {
        pool.query('SELECT * FROM homes WHERE id=?', [id], (err, rows) => {
            if (err) return rej(err);
            acc(rows.map(item => Object.assign({}, item))[0]);
        });
    });
}

async function storeHome(item) {
    return new Promise((acc, rej) => {
        pool.query(
            'INSERT INTO homes (id, name) VALUES (?, ?)',
            [item.id, item.name],
            err => {
                if (err) return rej(err);
                acc();
            },
        );
    });
}

async function updateHome(id, item) {
    return new Promise((acc, rej) => {
        pool.query(
            'UPDATE homes SET name=? WHERE id=?',
            [item.name, item.id],
            err => {
                if (err) return rej(err);
                acc();
            },
        );
    });
}

async function removeHome(id) {
    return new Promise((acc, rej) => {
        pool.query('DELETE FROM homes WHERE id = ?', [id], err => {
            if (err) return rej(err);
            acc();
        });
    });
}

module.exports = {
    init,
    teardown,
    getHomes,
    getHome,
    storeHome,
    updateHome,
    removeHome,
};
