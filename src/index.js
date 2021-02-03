const express = require('express');
const app = express();
const db = require('./persistence');
const getHomes = require('./routes/getHomes');
const addHome = require('./routes/addHome');
const updateHome = require('./routes/updateHome');
const deleteHome = require('./routes/deleteHome');

app.use(require('body-parser').json());
app.use(express.static(__dirname + '/static'));

app.get('/items', getHomes);
app.post('/items', addHome);
app.put('/items/:id', updateHome);
app.delete('/items/:id', deleteHome);

db.init()
    .then(() => {
        app.listen(3000, () => console.log('Listening on port 3000'));
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

const gracefulShutdown = () => {
    db.teardown()
        .catch(() => {})
        .then(() => process.exit());
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // Sent by nodemon
