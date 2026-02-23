const express = require('express');
const session = require('express-session');
const app = express();
const db = require('./persistence');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const { attachPermissions } = require('./middleware/auth');

// API routers
const buildingRouter = require('./routes/building');
const unitsRouter = require('./routes/units');
const residentsRouter = require('./routes/residents');
const boardRouter = require('./routes/board');
const announcementsRouter = require('./routes/announcements');
const documentsRouter = require('./routes/documents');
const maintenanceRouter = require('./routes/maintenance');
const financesRouter = require('./routes/finances');
const authRouter = require('./routes/auth');
const staffRouter = require('./routes/staff');
const vendorsRouter = require('./routes/vendors');
const applicationsRouter = require('./routes/applications');
const waitlistsRouter = require('./routes/waitlists');
const complianceRouter = require('./routes/compliance');
const packagesRouter = require('./routes/packages');
const providersRouter = require('./routes/providers');
const butterflymxRouter = require('./routes/integrations/butterflymx');
const feedbackRouter = require('./routes/feedback');

app.use(logger);
app.use(require('body-parser').json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'apty-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }, // 1 day
}));
app.use(attachPermissions);
app.use(express.static(__dirname + '/static'));

// API routes
app.use('/api/building', buildingRouter);
app.use('/api/units', unitsRouter);
app.use('/api/residents', residentsRouter);
app.use('/api/board', boardRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/finances', financesRouter);
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/waitlists', waitlistsRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/providers', providersRouter);
app.use('/api/integrations/butterflymx', butterflymxRouter);
app.use('/api/feedback', feedbackRouter);

app.use(errorHandler);

if (require.main === module) {
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
}

module.exports = { app, db };
