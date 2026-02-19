const express = require('express');
const session = require('express-session');
const app = express();
const db = require('./persistence');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth, requireRole } = require('./middleware/auth');
const SqliteStore = require('./middleware/sessionStore');

// Legacy route handlers
const getHomes = require('./routes/getHomes');
const addHome = require('./routes/addhome');
const updateHome = require('./routes/updateHome');
const deleteHome = require('./routes/deleteHome');

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

app.use(logger);
app.use(require('body-parser').json());

// Session middleware
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'apty-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
};

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
    sessionConfig.cookie.secure = true;
}

// Use SQLite session store when not in test mode
if (process.env.NODE_ENV !== 'test') {
    sessionConfig.store = new SqliteStore();
}

app.use(session(sessionConfig));

app.use(express.static(__dirname + '/static'));

// Legacy routes (backward compat)
app.get('/items', getHomes);
app.post('/items', addHome);
app.put('/items/:id', updateHome);
app.delete('/items/:id', deleteHome);

// Public auth routes (login/logout/me)
app.use('/api/auth', authRouter);

// Protected read routes - any authenticated user
app.use('/api/building', requireAuth, buildingRouter);
app.use('/api/units', requireAuth, unitsRouter);
app.use('/api/residents', requireAuth, residentsRouter);
app.use('/api/board', requireAuth, boardRouter);
app.use('/api/announcements', requireAuth, announcementsRouter);
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/maintenance', requireAuth, maintenanceRouter);
app.use('/api/finances', requireAuth, financesRouter);
app.use('/api/staff', requireAuth, staffRouter);
app.use('/api/vendors', requireAuth, vendorsRouter);
app.use('/api/applications', requireAuth, applicationsRouter);
app.use('/api/waitlists', requireAuth, waitlistsRouter);
app.use('/api/compliance', requireAuth, complianceRouter);

app.use(errorHandler);

module.exports = app;
