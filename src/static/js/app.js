// ── API helper ──
// Rejects with the Response on non-ok; callers that care about 401 can catch and handle.
const api = {
    get: (url) => fetch(url).then(r => r.ok ? r.json() : Promise.reject(r)),
    post: (url, body) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).then(r => r.ok ? r.json() : Promise.reject(r)),
    put: (url, body) => fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).then(r => r.ok ? r.json() : Promise.reject(r)),
    del: (url) => fetch(url, { method: 'DELETE' }),
};

// ── Login page ──
function LoginPage({ onLogin }) {
    const { Card, Form, Button, Alert } = ReactBootstrap;
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        api.post('/api/auth/login', { email, password })
            .then(user => { setLoading(false); onLogin(user); })
            .catch(() => { setLoading(false); setError('Invalid email or password.'); });
    };

    return (
        <div className="login-page">
            <Card className="login-card">
                <Card.Body>
                    <div className="text-center mb-4">
                        <i className="fas fa-home fa-2x text-primary" />
                        <h4 className="mt-2 mb-0">Apty</h4>
                        <small className="text-muted">Co-op Building Management</small>
                    </div>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group>
                            <Form.Label>Email</Form.Label>
                            <Form.Control type="email" value={email} autoFocus
                                onChange={e => setEmail(e.target.value)} required />
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>Password</Form.Label>
                            <Form.Control type="password" value={password}
                                onChange={e => setPassword(e.target.value)} required />
                        </Form.Group>
                        <Button type="submit" block disabled={loading} className="mt-2">
                            {loading ? 'Signing in…' : 'Sign In'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
        </div>
    );
}

function StatusBadge({ status }) {
    const label = (status || '').replace(/_/g, ' ');
    return <span className={`badge badge-${status}`}>{label}</span>;
}

// ── Sidebar ──
function Sidebar({ page, setPage, user }) {
    const { Nav } = ReactBootstrap;
    const perms = (user && user.permissions) || [];
    const can = (p) => perms.includes(p);

    const items = [
        { key: 'dashboard',     icon: 'fa-tachometer-alt',  label: 'Dashboard',       show: true },
        { key: 'units',         icon: 'fa-building',        label: 'Units',           show: can('units:read') },
        { key: 'residents',     icon: 'fa-users',           label: 'Residents',       show: can('residents:read') },
        { key: 'board',         icon: 'fa-user-tie',        label: 'Board',           show: can('board:read') },
        { key: 'announcements', icon: 'fa-bullhorn',        label: 'Announcements',   show: can('announcements:read') },
        { key: 'documents',     icon: 'fa-folder-open',     label: 'Documents',       show: can('documents:read') },
        { key: 'maintenance',   icon: 'fa-wrench',          label: 'Maintenance',     show: can('maintenance:read') },
        { key: 'packages',      icon: 'fa-box',             label: 'Packages',        show: can('packages:read') },
        { key: 'finances',      icon: 'fa-dollar-sign',     label: 'Finances',        show: can('finances:read') },
        { key: 'staff',         icon: 'fa-hard-hat',        label: 'Staff & Vendors', show: can('staff:read') },
        { key: 'applications',  icon: 'fa-file-alt',        label: 'Applications',    show: can('applications:read') },
        { key: 'compliance',    icon: 'fa-clipboard-check', label: 'Compliance',      show: can('compliance:read') },
        { key: 'users',         icon: 'fa-user-shield',     label: 'Users',           show: can('users:read') },
    ].filter(i => i.show);

    return (
        <div className="sidebar">
            <div className="sidebar-heading">Navigation</div>
            <Nav className="flex-column">
                {items.map(item => (
                    <Nav.Link
                        key={item.key}
                        className={page === item.key ? 'active' : ''}
                        onClick={() => setPage(item.key)}
                    >
                        <i className={`fas ${item.icon}`} /> {item.label}
                    </Nav.Link>
                ))}
            </Nav>
            {user && (
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <i className="fas fa-user-circle mr-1" />
                        <small>{user.email}</small>
                        <span className={`role-badge role-${user.role}`}>{user.role}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Dashboard ──
function DashboardPage() {
    const { Row, Col, Card, Table } = ReactBootstrap;
    const [building, setBuilding] = React.useState(null);
    const [units, setUnits] = React.useState([]);
    const [announcements, setAnnouncements] = React.useState([]);
    const [requests, setRequests] = React.useState([]);
    const [packages, setPackages] = React.useState([]);

    React.useEffect(() => {
        api.get('/api/building').then(setBuilding).catch(() => {});
        api.get('/api/units').then(setUnits);
        api.get('/api/announcements').then(setAnnouncements);
        api.get('/api/maintenance').then(setRequests);
        api.get('/api/packages').then(setPackages).catch(() => {});
    }, []);

    const totalShares = units.reduce((s, u) => s + (u.shares || 0), 0);
    const totalMaint = units.reduce(
        (s, u) => s + parseFloat(u.monthly_maintenance || 0), 0,
    );
    const openReqs = requests.filter(
        r => r.status === 'open' || r.status === 'in_progress',
    ).length;
    const uncollectedPkgs = packages.filter(
        p => p.status === 'arrived' || p.status === 'notified',
    ).length;

    return (
        <div>
            <h4 className="mb-3">
                {building ? building.name : 'Building Dashboard'}
            </h4>
            {building && (
                <p className="text-muted">
                    {building.address}, {building.city}, {building.state}{' '}
                    {building.zip} &middot; Built {building.year_built} &middot;{' '}
                    {(building.building_type || '').toUpperCase()}
                </p>
            )}
            <Row className="mb-4">
                <Col md={3}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="stat-number text-primary">
                                {units.length}
                            </div>
                            <div className="stat-label">Units</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="stat-number text-info">
                                {totalShares.toLocaleString()}
                            </div>
                            <div className="stat-label">Total Shares</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="stat-number text-success">
                                ${totalMaint.toLocaleString()}
                            </div>
                            <div className="stat-label">Monthly Revenue</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="stat-number text-warning">
                                {openReqs}
                            </div>
                            <div className="stat-label">Open Requests</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="stat-number text-danger">
                                {uncollectedPkgs}
                            </div>
                            <div className="stat-label">Uncollected Packages</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            <Row>
                <Col md={8}>
                    <Card className="table-card mb-3">
                        <Card.Header>
                            <i className="fas fa-bullhorn mr-2" />
                            Recent Announcements
                        </Card.Header>
                        <Card.Body>
                            {announcements.length === 0 && (
                                <p className="text-muted mb-0">
                                    No announcements
                                </p>
                            )}
                            {announcements.slice(0, 5).map(a => (
                                <div
                                    key={a.id}
                                    className={`announcement-card p-3 category-${a.category || 'general'}`}
                                >
                                    <strong>{a.title}</strong>
                                    <div className="text-muted small">
                                        {a.first_name} {a.last_name} &middot;{' '}
                                        {new Date(
                                            a.posted_at,
                                        ).toLocaleDateString()}
                                    </div>
                                    <div className="mt-1">{a.body}</div>
                                </div>
                            ))}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="table-card mb-3">
                        <Card.Header>
                            <i className="fas fa-wrench mr-2" />
                            Open Requests
                        </Card.Header>
                        <Card.Body className="p-0">
                            <Table size="sm" hover>
                                <tbody>
                                    {requests
                                        .filter(
                                            r =>
                                                r.status !== 'closed' &&
                                                r.status !== 'resolved',
                                        )
                                        .slice(0, 8)
                                        .map(r => (
                                            <tr key={r.id}>
                                                <td className="pl-3">
                                                    {r.title}
                                                    <br />
                                                    <small className="text-muted">
                                                        {r.unit_number ||
                                                            'Common area'}
                                                    </small>
                                                </td>
                                                <td>
                                                    <StatusBadge
                                                        status={r.status}
                                                    />
                                                    <br />
                                                    <small
                                                        className={`priority-${r.priority}`}
                                                    >
                                                        {r.priority}
                                                    </small>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </Table>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

// ── Units ──
function UnitsPage() {
    const { Card, Table, Button, Modal, Form, Row, Col } = ReactBootstrap;
    const [units, setUnits] = React.useState([]);
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({});

    const load = () => api.get('/api/units').then(setUnits);
    React.useEffect(() => { load(); }, []);

    const handleAdd = () => {
        api.post('/api/units', form).then(() => {
            setShowAdd(false); setForm({}); load();
        });
    };
    const handleDelete = (id) => api.del(`/api/units/${id}`).then(load);

    return (
        <div>
            <div className="d-flex justify-content-between mb-3">
                <h4>Units</h4>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                    <i className="fas fa-plus mr-1" /> Add Unit
                </Button>
            </div>
            <Card className="table-card">
                <Table hover responsive>
                    <thead>
                        <tr>
                            <th>Unit</th><th>Floor</th><th>Rooms</th>
                            <th>Sq Ft</th><th>Shares</th>
                            <th>Maintenance</th><th>Status</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {units.map(u => (
                            <tr key={u.id}>
                                <td><strong>{u.unit_number}</strong></td>
                                <td>{u.floor}</td>
                                <td>{u.rooms}</td>
                                <td>{u.square_feet ? u.square_feet.toLocaleString() : '-'}</td>
                                <td>{u.shares}</td>
                                <td>${parseFloat(u.monthly_maintenance || 0).toLocaleString()}</td>
                                <td><StatusBadge status={u.status} /></td>
                                <td>
                                    <Button size="sm" variant="outline-danger"
                                        onClick={() => handleDelete(u.id)}>
                                        <i className="fas fa-trash" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
            <Modal show={showAdd} onHide={() => setShowAdd(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add Unit</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col>
                            <Form.Group>
                                <Form.Label>Unit #</Form.Label>
                                <Form.Control value={form.unit_number || ''}
                                    onChange={e => setForm({...form, unit_number: e.target.value})} />
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group>
                                <Form.Label>Floor</Form.Label>
                                <Form.Control type="number" value={form.floor || ''}
                                    onChange={e => setForm({...form, floor: parseInt(e.target.value)})} />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <Form.Group>
                                <Form.Label>Rooms</Form.Label>
                                <Form.Control type="number" step="0.5" value={form.rooms || ''}
                                    onChange={e => setForm({...form, rooms: parseFloat(e.target.value)})} />
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group>
                                <Form.Label>Sq Ft</Form.Label>
                                <Form.Control type="number" value={form.square_feet || ''}
                                    onChange={e => setForm({...form, square_feet: parseInt(e.target.value)})} />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <Form.Group>
                                <Form.Label>Shares</Form.Label>
                                <Form.Control type="number" value={form.shares || ''}
                                    onChange={e => setForm({...form, shares: parseInt(e.target.value)})} />
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group>
                                <Form.Label>Monthly Maint.</Form.Label>
                                <Form.Control type="number" step="0.01" value={form.monthly_maintenance || ''}
                                    onChange={e => setForm({...form, monthly_maintenance: parseFloat(e.target.value)})} />
                            </Form.Group>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button onClick={handleAdd}>Save</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Residents ──
function ResidentsPage() {
    const { Card, Table, Button, Modal, Form, Row, Col } = ReactBootstrap;
    const [residents, setResidents] = React.useState([]);
    const [units, setUnits] = React.useState([]);
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({});

    const load = () => {
        api.get('/api/residents').then(setResidents);
        api.get('/api/units').then(setUnits);
    };
    React.useEffect(() => { load(); }, []);

    const unitMap = {};
    units.forEach(u => { unitMap[u.id] = u.unit_number; });

    const handleAdd = () => {
        api.post('/api/residents', form).then(() => {
            setShowAdd(false); setForm({}); load();
        });
    };
    const handleDelete = (id) => api.del(`/api/residents/${id}`).then(load);

    return (
        <div>
            <div className="d-flex justify-content-between mb-3">
                <h4>Residents Directory</h4>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                    <i className="fas fa-plus mr-1" /> Add Resident
                </Button>
            </div>
            <Card className="table-card">
                <Table hover responsive>
                    <thead>
                        <tr>
                            <th>Name</th><th>Unit</th><th>Role</th>
                            <th>Email</th><th>Phone</th><th>Shares</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {residents.map(r => (
                            <tr key={r.id}>
                                <td>
                                    <strong>{r.first_name} {r.last_name}</strong>
                                    {r.is_primary ? <small className="text-muted ml-1">(primary)</small> : ''}
                                </td>
                                <td>{unitMap[r.unit_id] || '-'}</td>
                                <td>{r.role}</td>
                                <td>{r.email}</td>
                                <td>{r.phone}</td>
                                <td>{r.shares_held}</td>
                                <td>
                                    <Button size="sm" variant="outline-danger"
                                        onClick={() => handleDelete(r.id)}>
                                        <i className="fas fa-trash" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
            <Modal show={showAdd} onHide={() => setShowAdd(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Add Resident</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col>
                            <Form.Group>
                                <Form.Label>First Name</Form.Label>
                                <Form.Control value={form.first_name || ''}
                                    onChange={e => setForm({...form, first_name: e.target.value})} />
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group>
                                <Form.Label>Last Name</Form.Label>
                                <Form.Control value={form.last_name || ''}
                                    onChange={e => setForm({...form, last_name: e.target.value})} />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Form.Group>
                        <Form.Label>Unit</Form.Label>
                        <Form.Control as="select" value={form.unit_id || ''}
                            onChange={e => setForm({...form, unit_id: e.target.value})}>
                            <option value="">Select...</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                        </Form.Control>
                    </Form.Group>
                    <Row>
                        <Col>
                            <Form.Group>
                                <Form.Label>Email</Form.Label>
                                <Form.Control value={form.email || ''}
                                    onChange={e => setForm({...form, email: e.target.value})} />
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group>
                                <Form.Label>Phone</Form.Label>
                                <Form.Control value={form.phone || ''}
                                    onChange={e => setForm({...form, phone: e.target.value})} />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <Form.Group>
                                <Form.Label>Role</Form.Label>
                                <Form.Control as="select" value={form.role || 'shareholder'}
                                    onChange={e => setForm({...form, role: e.target.value})}>
                                    <option>shareholder</option>
                                    <option>subtenant</option>
                                    <option>occupant</option>
                                </Form.Control>
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group>
                                <Form.Label>Shares</Form.Label>
                                <Form.Control type="number" value={form.shares_held || ''}
                                    onChange={e => setForm({...form, shares_held: parseInt(e.target.value)})} />
                            </Form.Group>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button onClick={handleAdd}>Save</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Board ──
function BoardPage() {
    const { Card, Table, Badge } = ReactBootstrap;
    const [members, setMembers] = React.useState([]);
    React.useEffect(() => { api.get('/api/board').then(setMembers); }, []);

    const roleLabel = (r) =>
        r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <div>
            <h4 className="mb-3">Board of Directors</h4>
            <Card className="table-card">
                <Table hover responsive>
                    <thead>
                        <tr><th>Name</th><th>Role</th><th>Email</th><th>Term</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        {members.map(m => (
                            <tr key={m.id}>
                                <td><strong>{m.first_name} {m.last_name}</strong></td>
                                <td><Badge variant="info">{roleLabel(m.role)}</Badge></td>
                                <td>{m.email}</td>
                                <td>
                                    {m.term_start ? new Date(m.term_start).toLocaleDateString() : ''} -{' '}
                                    {m.term_end ? new Date(m.term_end).toLocaleDateString() : ''}
                                </td>
                                <td>
                                    {m.is_active
                                        ? <Badge variant="success">Active</Badge>
                                        : <Badge variant="secondary">Inactive</Badge>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
        </div>
    );
}

// ── Announcements ──
function AnnouncementsPage() {
    const { Card, Button, Modal, Form } = ReactBootstrap;
    const [announcements, setAnnouncements] = React.useState([]);
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({});

    const load = () => api.get('/api/announcements').then(setAnnouncements);
    React.useEffect(() => { load(); }, []);

    const handleAdd = () => {
        api.post('/api/announcements', form).then(() => {
            setShowAdd(false); setForm({}); load();
        });
    };
    const handleDelete = (id) => api.del(`/api/announcements/${id}`).then(load);

    return (
        <div>
            <div className="d-flex justify-content-between mb-3">
                <h4>Announcements</h4>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                    <i className="fas fa-plus mr-1" /> New Announcement
                </Button>
            </div>
            {announcements.map(a => (
                <Card key={a.id}
                    className={`announcement-card p-3 category-${a.category || 'general'}`}>
                    <div className="d-flex justify-content-between">
                        <div>
                            <strong>{a.title}</strong>
                            <div className="text-muted small">
                                {a.first_name} {a.last_name} &middot;{' '}
                                {new Date(a.posted_at).toLocaleDateString()} &middot;{' '}
                                {a.category || 'general'}
                            </div>
                        </div>
                        <Button size="sm" variant="outline-danger"
                            onClick={() => handleDelete(a.id)}>
                            <i className="fas fa-trash" />
                        </Button>
                    </div>
                    <div className="mt-2">{a.body}</div>
                </Card>
            ))}
            <Modal show={showAdd} onHide={() => setShowAdd(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>New Announcement</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Title</Form.Label>
                        <Form.Control value={form.title || ''}
                            onChange={e => setForm({...form, title: e.target.value})} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Category</Form.Label>
                        <Form.Control as="select" value={form.category || 'general'}
                            onChange={e => setForm({...form, category: e.target.value})}>
                            <option>general</option>
                            <option>maintenance</option>
                            <option>meeting</option>
                            <option>emergency</option>
                        </Form.Control>
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Message</Form.Label>
                        <Form.Control as="textarea" rows={4} value={form.body || ''}
                            onChange={e => setForm({...form, body: e.target.value})} />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button onClick={handleAdd}>Post</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Maintenance ──
function MaintenancePage() {
    const { Card, Table, Button, Modal, Form, Row, Col } = ReactBootstrap;
    const [requests, setRequests] = React.useState([]);
    const [units, setUnits] = React.useState([]);
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({});
    const [filter, setFilter] = React.useState('all');

    const load = () => {
        api.get('/api/maintenance').then(setRequests);
        api.get('/api/units').then(setUnits);
    };
    React.useEffect(() => { load(); }, []);

    const filtered = filter === 'all'
        ? requests
        : requests.filter(r => r.status === filter);

    const handleAdd = () => {
        api.post('/api/maintenance', form).then(() => {
            setShowAdd(false); setForm({}); load();
        });
    };
    const updateStatus = (id, status) => {
        api.put(`/api/maintenance/${id}`, { status }).then(load);
    };

    return (
        <div>
            <div className="d-flex justify-content-between mb-3">
                <h4>Maintenance Requests</h4>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                    <i className="fas fa-plus mr-1" /> New Request
                </Button>
            </div>
            <div className="mb-3">
                {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
                    <Button key={f} size="sm"
                        variant={filter === f ? 'primary' : 'outline-secondary'}
                        className="mr-1" onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
                    </Button>
                ))}
            </div>
            <Card className="table-card">
                <Table hover responsive>
                    <thead>
                        <tr>
                            <th>Title</th><th>Unit</th><th>Location</th>
                            <th>Priority</th><th>Status</th><th>Assigned</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(r => (
                            <tr key={r.id}>
                                <td>
                                    <strong>{r.title}</strong><br/>
                                    <small className="text-muted">
                                        {r.first_name} {r.last_name}
                                    </small>
                                </td>
                                <td>{r.unit_number || 'Common'}</td>
                                <td>{r.location}</td>
                                <td>
                                    <span className={`priority-${r.priority}`}>
                                        {r.priority}
                                    </span>
                                </td>
                                <td><StatusBadge status={r.status} /></td>
                                <td>{r.assigned_to || '-'}</td>
                                <td>
                                    {r.status === 'open' && (
                                        <Button size="sm" variant="outline-warning"
                                            className="mr-1"
                                            onClick={() => updateStatus(r.id, 'in_progress')}>
                                            Start
                                        </Button>
                                    )}
                                    {r.status === 'in_progress' && (
                                        <Button size="sm" variant="outline-success"
                                            onClick={() => updateStatus(r.id, 'resolved')}>
                                            Resolve
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
            <Modal show={showAdd} onHide={() => setShowAdd(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>New Maintenance Request</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Title</Form.Label>
                        <Form.Control value={form.title || ''}
                            onChange={e => setForm({...form, title: e.target.value})} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Description</Form.Label>
                        <Form.Control as="textarea" rows={3} value={form.description || ''}
                            onChange={e => setForm({...form, description: e.target.value})} />
                    </Form.Group>
                    <Row>
                        <Col>
                            <Form.Group>
                                <Form.Label>Unit</Form.Label>
                                <Form.Control as="select" value={form.unit_id || ''}
                                    onChange={e => setForm({...form, unit_id: e.target.value || null})}>
                                    <option value="">Common Area</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                                </Form.Control>
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group>
                                <Form.Label>Location</Form.Label>
                                <Form.Control value={form.location || ''}
                                    onChange={e => setForm({...form, location: e.target.value})}
                                    placeholder="Kitchen, Lobby..." />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Form.Group>
                        <Form.Label>Priority</Form.Label>
                        <Form.Control as="select" value={form.priority || 'normal'}
                            onChange={e => setForm({...form, priority: e.target.value})}>
                            <option>low</option>
                            <option>normal</option>
                            <option>high</option>
                            <option>emergency</option>
                        </Form.Control>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button onClick={handleAdd}>Submit</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Finances ──
function FinancesPage() {
    const { Card, Table, Button, Row, Col, Form } = ReactBootstrap;
    const [charges, setCharges] = React.useState([]);
    const [genMonth, setGenMonth] = React.useState(new Date().getMonth() + 1);
    const [genYear, setGenYear] = React.useState(new Date().getFullYear());

    const load = () => api.get('/api/finances/maintenance-charges').then(setCharges);
    React.useEffect(() => { load(); }, []);

    const generate = () => {
        api.post('/api/finances/maintenance-charges/generate', {
            period_month: genMonth, period_year: genYear,
        }).then(load);
    };
    const markPaid = (id) => {
        api.put(`/api/finances/maintenance-charges/${id}`, {
            status: 'paid', paid_date: new Date().toISOString().slice(0, 10),
        }).then(load);
    };

    const totalPending = charges
        .filter(c => c.status === 'pending')
        .reduce((s, c) => s + parseFloat(c.amount), 0);
    const totalPaid = charges
        .filter(c => c.status === 'paid')
        .reduce((s, c) => s + parseFloat(c.amount), 0);

    return (
        <div>
            <h4 className="mb-3">Finances</h4>
            <Row className="mb-4">
                <Col md={4}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="stat-number text-warning">
                                ${totalPending.toLocaleString()}
                            </div>
                            <div className="stat-label">Pending</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="stat-number text-success">
                                ${totalPaid.toLocaleString()}
                            </div>
                            <div className="stat-label">Collected</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="stat-card">
                        <Card.Body>
                            <div className="d-flex align-items-end">
                                <Form.Control type="number" size="sm"
                                    value={genMonth}
                                    onChange={e => setGenMonth(parseInt(e.target.value))}
                                    min={1} max={12} className="mr-1" style={{width: 60}} />
                                <Form.Control type="number" size="sm"
                                    value={genYear}
                                    onChange={e => setGenYear(parseInt(e.target.value))}
                                    className="mr-1" style={{width: 80}} />
                                <Button size="sm" onClick={generate}>Generate</Button>
                            </div>
                            <div className="stat-label mt-1">Generate Monthly Charges</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            <Card className="table-card">
                <Card.Header>Maintenance Charges</Card.Header>
                <Table hover responsive>
                    <thead>
                        <tr><th>Unit</th><th>Period</th><th>Amount</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                        {charges.slice(0, 50).map(c => (
                            <tr key={c.id}>
                                <td>{c.unit_number}</td>
                                <td>{c.period_month}/{c.period_year}</td>
                                <td>${parseFloat(c.amount).toLocaleString()}</td>
                                <td><StatusBadge status={c.status} /></td>
                                <td>
                                    {c.status === 'pending' && (
                                        <Button size="sm" variant="outline-success"
                                            onClick={() => markPaid(c.id)}>
                                            Mark Paid
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
        </div>
    );
}

// ── Staff & Vendors ──
function StaffPage() {
    const { Card, Table, Row, Col, Button, Modal, Form } = ReactBootstrap;
    const [staff, setStaff] = React.useState([]);
    const [vendors, setVendors] = React.useState([]);
    const [showAddStaff, setShowAddStaff] = React.useState(false);
    const [showAddVendor, setShowAddVendor] = React.useState(false);
    const [sForm, setSForm] = React.useState({});
    const [vForm, setVForm] = React.useState({});

    const load = () => {
        api.get('/api/staff').then(setStaff);
        api.get('/api/vendors').then(setVendors);
    };
    React.useEffect(() => { load(); }, []);

    const addStaff = () => {
        api.post('/api/staff', sForm).then(() => {
            setShowAddStaff(false); setSForm({}); load();
        });
    };
    const addVendor = () => {
        api.post('/api/vendors', vForm).then(() => {
            setShowAddVendor(false); setVForm({}); load();
        });
    };

    return (
        <div>
            <h4 className="mb-3">Staff & Vendors</h4>
            <Row>
                <Col md={6}>
                    <div className="d-flex justify-content-between mb-2">
                        <h5>Building Staff</h5>
                        <Button size="sm" onClick={() => setShowAddStaff(true)}>
                            <i className="fas fa-plus mr-1" />Add
                        </Button>
                    </div>
                    <Card className="table-card">
                        <Table hover responsive>
                            <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Schedule</th></tr></thead>
                            <tbody>
                                {staff.map(s => (
                                    <tr key={s.id}>
                                        <td><strong>{s.name}</strong></td>
                                        <td>{s.role}</td><td>{s.phone}</td><td>{s.schedule}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                </Col>
                <Col md={6}>
                    <div className="d-flex justify-content-between mb-2">
                        <h5>Vendors</h5>
                        <Button size="sm" onClick={() => setShowAddVendor(true)}>
                            <i className="fas fa-plus mr-1" />Add
                        </Button>
                    </div>
                    <Card className="table-card">
                        <Table hover responsive>
                            <thead><tr><th>Company</th><th>Trade</th><th>Contact</th><th>Phone</th></tr></thead>
                            <tbody>
                                {vendors.map(v => (
                                    <tr key={v.id}>
                                        <td><strong>{v.company_name}</strong></td>
                                        <td>{v.trade}</td><td>{v.contact_name}</td><td>{v.phone}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                </Col>
            </Row>
            <Modal show={showAddStaff} onHide={() => setShowAddStaff(false)}>
                <Modal.Header closeButton><Modal.Title>Add Staff</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form.Group><Form.Label>Name</Form.Label>
                        <Form.Control value={sForm.name || ''} onChange={e => setSForm({...sForm, name: e.target.value})} />
                    </Form.Group>
                    <Form.Group><Form.Label>Role</Form.Label>
                        <Form.Control value={sForm.role || ''} onChange={e => setSForm({...sForm, role: e.target.value})} />
                    </Form.Group>
                    <Row>
                        <Col><Form.Group><Form.Label>Phone</Form.Label>
                            <Form.Control value={sForm.phone || ''} onChange={e => setSForm({...sForm, phone: e.target.value})} />
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Schedule</Form.Label>
                            <Form.Control value={sForm.schedule || ''} onChange={e => setSForm({...sForm, schedule: e.target.value})} />
                        </Form.Group></Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddStaff(false)}>Cancel</Button>
                    <Button onClick={addStaff}>Save</Button>
                </Modal.Footer>
            </Modal>
            <Modal show={showAddVendor} onHide={() => setShowAddVendor(false)}>
                <Modal.Header closeButton><Modal.Title>Add Vendor</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form.Group><Form.Label>Company</Form.Label>
                        <Form.Control value={vForm.company_name || ''} onChange={e => setVForm({...vForm, company_name: e.target.value})} />
                    </Form.Group>
                    <Row>
                        <Col><Form.Group><Form.Label>Trade</Form.Label>
                            <Form.Control value={vForm.trade || ''} onChange={e => setVForm({...vForm, trade: e.target.value})} />
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Contact</Form.Label>
                            <Form.Control value={vForm.contact_name || ''} onChange={e => setVForm({...vForm, contact_name: e.target.value})} />
                        </Form.Group></Col>
                    </Row>
                    <Row>
                        <Col><Form.Group><Form.Label>Phone</Form.Label>
                            <Form.Control value={vForm.phone || ''} onChange={e => setVForm({...vForm, phone: e.target.value})} />
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Email</Form.Label>
                            <Form.Control value={vForm.email || ''} onChange={e => setVForm({...vForm, email: e.target.value})} />
                        </Form.Group></Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddVendor(false)}>Cancel</Button>
                    <Button onClick={addVendor}>Save</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Applications ──
function ApplicationsPage() {
    const { Card, Table, Button, Modal, Form, Row, Col, Badge } = ReactBootstrap;
    const [apps, setApps] = React.useState([]);
    const [units, setUnits] = React.useState([]);
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({});

    const load = () => {
        api.get('/api/applications').then(setApps);
        api.get('/api/units').then(setUnits);
    };
    React.useEffect(() => { load(); }, []);

    const handleAdd = () => {
        api.post('/api/applications', form).then(() => {
            setShowAdd(false); setForm({}); load();
        });
    };
    const updateStatus = (id, status, decision) => {
        const body = { status, reviewed_at: new Date().toISOString() };
        if (decision) body.board_decision = decision;
        api.put(`/api/applications/${id}`, body).then(load);
    };

    return (
        <div>
            <div className="d-flex justify-content-between mb-3">
                <h4>Applications</h4>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                    <i className="fas fa-plus mr-1" /> New Application
                </Button>
            </div>
            <Card className="table-card">
                <Table hover responsive>
                    <thead>
                        <tr>
                            <th>Applicant</th><th>Unit</th><th>Type</th>
                            <th>Status</th><th>Submitted</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {apps.map(a => (
                            <tr key={a.id}>
                                <td>
                                    <strong>{a.applicant_name}</strong><br/>
                                    <small>{a.applicant_email}</small>
                                </td>
                                <td>{a.unit_number}</td>
                                <td><Badge variant="info">{a.type}</Badge></td>
                                <td><StatusBadge status={a.status} /></td>
                                <td>{new Date(a.submitted_at).toLocaleDateString()}</td>
                                <td>
                                    {a.status === 'submitted' && (
                                        <Button size="sm" variant="outline-primary" className="mr-1"
                                            onClick={() => updateStatus(a.id, 'under_review')}>
                                            Review
                                        </Button>
                                    )}
                                    {a.status === 'under_review' && (
                                        <React.Fragment>
                                            <Button size="sm" variant="outline-success" className="mr-1"
                                                onClick={() => updateStatus(a.id, 'approved', 'approved')}>
                                                Approve
                                            </Button>
                                            <Button size="sm" variant="outline-danger"
                                                onClick={() => updateStatus(a.id, 'denied', 'denied')}>
                                                Deny
                                            </Button>
                                        </React.Fragment>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
            <Modal show={showAdd} onHide={() => setShowAdd(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>New Application</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col><Form.Group><Form.Label>Applicant Name</Form.Label>
                            <Form.Control value={form.applicant_name || ''}
                                onChange={e => setForm({...form, applicant_name: e.target.value})} />
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Email</Form.Label>
                            <Form.Control value={form.applicant_email || ''}
                                onChange={e => setForm({...form, applicant_email: e.target.value})} />
                        </Form.Group></Col>
                    </Row>
                    <Row>
                        <Col><Form.Group><Form.Label>Unit</Form.Label>
                            <Form.Control as="select" value={form.unit_id || ''}
                                onChange={e => setForm({...form, unit_id: e.target.value})}>
                                <option value="">Select...</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                            </Form.Control>
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Type</Form.Label>
                            <Form.Control as="select" value={form.type || 'purchase'}
                                onChange={e => setForm({...form, type: e.target.value})}>
                                <option>purchase</option>
                                <option>sublet</option>
                                <option>alteration</option>
                            </Form.Control>
                        </Form.Group></Col>
                    </Row>
                    <Form.Group><Form.Label>Notes</Form.Label>
                        <Form.Control as="textarea" rows={2} value={form.notes || ''}
                            onChange={e => setForm({...form, notes: e.target.value})} />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button onClick={handleAdd}>Submit</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Compliance ──
function CompliancePage() {
    const { Card, Table, Button, Modal, Form, Row, Col, Badge } = ReactBootstrap;
    const [items, setItems] = React.useState([]);
    const [violations, setViolations] = React.useState([]);
    const [showAddItem, setShowAddItem] = React.useState(false);
    const [showAddViol, setShowAddViol] = React.useState(false);
    const [iForm, setIForm] = React.useState({});
    const [vvForm, setVvForm] = React.useState({});

    const load = () => {
        api.get('/api/compliance').then(setItems);
        api.get('/api/compliance/violations').then(setViolations);
    };
    React.useEffect(() => { load(); }, []);

    const addItem = () => {
        api.post('/api/compliance', iForm).then(() => {
            setShowAddItem(false); setIForm({}); load();
        });
    };
    const addViolation = () => {
        api.post('/api/compliance/violations', vvForm).then(() => {
            setShowAddViol(false); setVvForm({}); load();
        });
    };
    const updateItemStatus = (id, status) =>
        api.put(`/api/compliance/${id}`, { status }).then(load);
    const updateViolStatus = (id, status) =>
        api.put(`/api/compliance/violations/${id}`, { status }).then(load);

    return (
        <div>
            <h4 className="mb-3">Compliance & Violations</h4>
            <Row>
                <Col md={7}>
                    <div className="d-flex justify-content-between mb-2">
                        <h5>Compliance Calendar</h5>
                        <Button size="sm" onClick={() => setShowAddItem(true)}>
                            <i className="fas fa-plus mr-1" />Add
                        </Button>
                    </div>
                    <Card className="table-card mb-3">
                        <Table hover responsive>
                            <thead>
                                <tr><th>Law/Requirement</th><th>Due Date</th><th>Status</th><th>Cost</th><th></th></tr>
                            </thead>
                            <tbody>
                                {items.map(i => (
                                    <tr key={i.id}>
                                        <td>
                                            <strong>{i.law_name}</strong><br/>
                                            <small className="text-muted">
                                                {i.description ? i.description.substring(0, 80) + '...' : ''}
                                            </small>
                                        </td>
                                        <td>{i.due_date ? new Date(i.due_date).toLocaleDateString() : '-'}</td>
                                        <td><StatusBadge status={i.status} /></td>
                                        <td>{i.cost ? `$${parseFloat(i.cost).toLocaleString()}` : '-'}</td>
                                        <td>
                                            {i.status === 'upcoming' && (
                                                <Button size="sm" variant="outline-primary"
                                                    onClick={() => updateItemStatus(i.id, 'in_progress')}>Start</Button>
                                            )}
                                            {i.status === 'in_progress' && (
                                                <Button size="sm" variant="outline-success"
                                                    onClick={() => updateItemStatus(i.id, 'completed')}>Complete</Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                </Col>
                <Col md={5}>
                    <div className="d-flex justify-content-between mb-2">
                        <h5>Violations</h5>
                        <Button size="sm" onClick={() => setShowAddViol(true)}>
                            <i className="fas fa-plus mr-1" />Add
                        </Button>
                    </div>
                    <Card className="table-card">
                        <Table hover responsive>
                            <thead>
                                <tr><th>Source</th><th>Description</th><th>Status</th><th></th></tr>
                            </thead>
                            <tbody>
                                {violations.map(v => (
                                    <tr key={v.id}>
                                        <td>
                                            <Badge variant="danger">{v.source}</Badge><br/>
                                            <small>{v.violation_number}</small>
                                        </td>
                                        <td>{v.description ? v.description.substring(0, 60) : ''}</td>
                                        <td><StatusBadge status={v.status} /></td>
                                        <td>
                                            {v.status === 'open' && (
                                                <Button size="sm" variant="outline-warning"
                                                    onClick={() => updateViolStatus(v.id, 'correcting')}>Fix</Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card>
                </Col>
            </Row>
            <Modal show={showAddItem} onHide={() => setShowAddItem(false)}>
                <Modal.Header closeButton><Modal.Title>Add Compliance Item</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form.Group><Form.Label>Law / Requirement</Form.Label>
                        <Form.Control value={iForm.law_name || ''}
                            onChange={e => setIForm({...iForm, law_name: e.target.value})} />
                    </Form.Group>
                    <Form.Group><Form.Label>Description</Form.Label>
                        <Form.Control as="textarea" rows={2} value={iForm.description || ''}
                            onChange={e => setIForm({...iForm, description: e.target.value})} />
                    </Form.Group>
                    <Row>
                        <Col><Form.Group><Form.Label>Due Date</Form.Label>
                            <Form.Control type="date" value={iForm.due_date || ''}
                                onChange={e => setIForm({...iForm, due_date: e.target.value})} />
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Est. Cost</Form.Label>
                            <Form.Control type="number" value={iForm.cost || ''}
                                onChange={e => setIForm({...iForm, cost: parseFloat(e.target.value)})} />
                        </Form.Group></Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddItem(false)}>Cancel</Button>
                    <Button onClick={addItem}>Save</Button>
                </Modal.Footer>
            </Modal>
            <Modal show={showAddViol} onHide={() => setShowAddViol(false)}>
                <Modal.Header closeButton><Modal.Title>Add Violation</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col><Form.Group><Form.Label>Source</Form.Label>
                            <Form.Control as="select" value={vvForm.source || 'HPD'}
                                onChange={e => setVvForm({...vvForm, source: e.target.value})}>
                                <option>HPD</option><option>DOB</option>
                                <option>FDNY</option><option>DEP</option>
                            </Form.Control>
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Violation #</Form.Label>
                            <Form.Control value={vvForm.violation_number || ''}
                                onChange={e => setVvForm({...vvForm, violation_number: e.target.value})} />
                        </Form.Group></Col>
                    </Row>
                    <Form.Group><Form.Label>Description</Form.Label>
                        <Form.Control as="textarea" rows={2} value={vvForm.description || ''}
                            onChange={e => setVvForm({...vvForm, description: e.target.value})} />
                    </Form.Group>
                    <Row>
                        <Col><Form.Group><Form.Label>Issued Date</Form.Label>
                            <Form.Control type="date" value={vvForm.issued_date || ''}
                                onChange={e => setVvForm({...vvForm, issued_date: e.target.value})} />
                        </Form.Group></Col>
                        <Col><Form.Group><Form.Label>Penalty $</Form.Label>
                            <Form.Control type="number" value={vvForm.penalty || ''}
                                onChange={e => setVvForm({...vvForm, penalty: parseFloat(e.target.value)})} />
                        </Form.Group></Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddViol(false)}>Cancel</Button>
                    <Button onClick={addViolation}>Save</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Packages ──
function detectCarrier(t) {
    t = (t || '').trim().replace(/\s+/g, '');
    if (/^1Z[A-Z0-9]{16}$/i.test(t)) return 'UPS';
    if (/^(94|93|92|91|90)\d{18,20}$/.test(t)) return 'USPS';
    if (/^\d{12}$/.test(t) || /^\d{15}$/.test(t) || /^\d{20}$/.test(t)) return 'FedEx';
    if (/^TBA\d+/i.test(t)) return 'Amazon';
    return '';
}

function PackagesPage() {
    const { Card, Table, Button, Modal, Form, Badge } = ReactBootstrap;
    const [packages, setPackages] = React.useState([]);
    const [units, setUnits] = React.useState([]);
    const [filter, setFilter] = React.useState('all');
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({});
    const [scanning, setScanning] = React.useState(false);
    const [scanError, setScanError] = React.useState('');
    const scannerRef = React.useRef(null);

    const load = () => api.get('/api/packages').then(setPackages).catch(() => {});
    React.useEffect(() => {
        load();
        api.get('/api/units').then(setUnits).catch(() => {});
    }, []);

    // Stop scanner when modal closes
    React.useEffect(() => {
        if (!showAdd) stopScanner();
    }, [showAdd]);

    // Start / stop camera when scanning toggles
    React.useEffect(() => {
        if (!scanning) { stopScanner(); return; }
        setScanError('');
        const timer = setTimeout(() => {
            if (!window.Html5Qrcode) {
                setScanError('Scanner library not loaded.');
                setScanning(false);
                return;
            }
            try {
                const scanner = new Html5Qrcode('pkg-barcode-scanner');
                scannerRef.current = scanner;
                scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 280, height: 110 } },
                    (decoded) => {
                        const carrier = detectCarrier(decoded);
                        setForm(f => ({ ...f, tracking_number: decoded, ...(carrier ? { carrier } : {}) }));
                        setScanning(false);
                    },
                    () => {},
                ).catch(() => {
                    setScanError('Could not access camera — check permissions.');
                    setScanning(false);
                });
            } catch (e) {
                setScanError('Scanner error: ' + e.message);
                setScanning(false);
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [scanning]);

    function stopScanner() {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }
        setScanning(false);
    }

    const closeModal = () => { stopScanner(); setShowAdd(false); setForm({}); setScanError(''); };

    const handleAdd = () => {
        api.post('/api/packages', { ...form, status: 'arrived' }).then(() => {
            closeModal(); load();
        }).catch(() => {});
    };

    const markPickedUp = (id) => {
        api.put(`/api/packages/${id}`, { status: 'picked_up', picked_up_at: new Date().toISOString() })
            .then(load).catch(() => {});
    };

    const filtered = filter === 'all' ? packages : packages.filter(p => p.status === filter);
    const statusVariant = { arrived: 'warning', notified: 'info', picked_up: 'success' };

    return (
        <div>
            <div className="d-flex justify-content-between mb-3">
                <h4>Packages</h4>
                <Button size="sm" onClick={() => setShowAdd(true)}>
                    <i className="fas fa-plus mr-1" /> Log Package
                </Button>
            </div>
            <div className="mb-3">
                {['all', 'arrived', 'notified', 'picked_up'].map(f => (
                    <Button key={f} size="sm" variant={filter === f ? 'primary' : 'outline-secondary'}
                        className="mr-1" onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Button>
                ))}
            </div>
            <Card className="table-card">
                <Table hover responsive>
                    <thead>
                        <tr>
                            <th>Unit</th><th>Carrier</th><th>Tracking #</th>
                            <th>Description</th><th>Status</th>
                            <th>Received</th><th>Picked Up</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => (
                            <tr key={p.id}>
                                <td><strong>{p.unit_number || '—'}</strong></td>
                                <td>{p.carrier || '—'}</td>
                                <td><small>{p.tracking_number || '—'}</small></td>
                                <td>{p.description || '—'}</td>
                                <td>
                                    <Badge variant={statusVariant[p.status] || 'secondary'}>
                                        {(p.status || '').replace('_', ' ')}
                                    </Badge>
                                </td>
                                <td><small>{p.received_at ? new Date(p.received_at).toLocaleDateString() : '—'}</small></td>
                                <td><small>{p.picked_up_at ? new Date(p.picked_up_at).toLocaleDateString() : '—'}</small></td>
                                <td>
                                    {p.status !== 'picked_up' && (
                                        <Button size="sm" variant="outline-success"
                                            onClick={() => markPickedUp(p.id)}>
                                            Mark Picked Up
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="8" className="text-center text-muted">No packages</td></tr>
                        )}
                    </tbody>
                </Table>
            </Card>

            <Modal show={showAdd} onHide={closeModal}>
                <Modal.Header closeButton><Modal.Title>Log Package</Modal.Title></Modal.Header>
                <Modal.Body>
                    {/* Barcode / QR scanner */}
                    <div className="mb-3">
                        {!scanning ? (
                            <Button variant="outline-primary" block onClick={() => setScanning(true)}>
                                <i className="fas fa-camera mr-2" />Scan Barcode / QR Code
                            </Button>
                        ) : (
                            <div>
                                <div id="pkg-barcode-scanner" className="barcode-scanner-view" />
                                <Button size="sm" variant="outline-secondary" block className="mt-2"
                                    onClick={() => setScanning(false)}>
                                    Cancel Scan
                                </Button>
                            </div>
                        )}
                        {scanError && <div className="text-danger small mt-1">{scanError}</div>}
                        {form.tracking_number && !scanning && (
                            <div className="scan-success mt-2">
                                <i className="fas fa-check-circle text-success mr-1" />
                                Scanned: <code>{form.tracking_number}</code>
                                {form.carrier && <span className="badge badge-info ml-2">{form.carrier}</span>}
                            </div>
                        )}
                    </div>
                    <hr className="mt-0" />
                    <Form.Group>
                        <Form.Label>Unit</Form.Label>
                        <Form.Control as="select" value={form.unit_id || ''}
                            onChange={e => setForm({ ...form, unit_id: e.target.value })}>
                            <option value="">— Select Unit —</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.unit_number}</option>
                            ))}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Carrier</Form.Label>
                        <Form.Control value={form.carrier || ''}
                            onChange={e => setForm({ ...form, carrier: e.target.value })}
                            placeholder="UPS, FedEx, USPS, Amazon…" />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Tracking Number</Form.Label>
                        <Form.Control value={form.tracking_number || ''}
                            onChange={e => setForm({ ...form, tracking_number: e.target.value })} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Description</Form.Label>
                        <Form.Control value={form.description || ''}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="e.g. 1 large box" />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={closeModal}>Cancel</Button>
                    <Button onClick={handleAdd} disabled={!form.unit_id}>Save</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Users ──
function UsersPage() {
    const { Row, Col, Card, Table, Button, Modal, Form, Badge } = ReactBootstrap;
    const [users, setUsers] = React.useState([]);
    const [residents, setResidents] = React.useState([]);
    const [showModal, setShowModal] = React.useState(false);
    const [editing, setEditing] = React.useState(null);
    const [form, setForm] = React.useState({ email: '', password: '', role: 'resident', resident_id: '' });
    const [error, setError] = React.useState('');

    const load = () => {
        api.get('/api/auth/users').then(setUsers).catch(() => {});
        api.get('/api/residents').then(setResidents).catch(() => {});
    };
    React.useEffect(load, []);

    const openAdd = () => {
        setEditing(null);
        setForm({ email: '', password: '', role: 'resident', resident_id: '' });
        setError('');
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditing(u);
        setForm({ email: u.email, password: '', role: u.role, resident_id: u.resident_id || '' });
        setError('');
        setShowModal(true);
    };

    const closeModal = () => setShowModal(false);

    const handleSave = async () => {
        setError('');
        try {
            if (editing) {
                const body = { role: form.role, resident_id: form.resident_id || null };
                if (form.password) body.password = form.password;
                await api.put(`/api/auth/users/${editing.id}`, body);
            } else {
                if (!form.email || !form.password) { setError('Email and password are required'); return; }
                await api.post('/api/auth/register', form);
            }
            load();
            closeModal();
        } catch (e) {
            setError(e.message || 'Save failed');
        }
    };

    const handleDelete = async (u) => {
        if (!confirm(`Delete user ${u.email}?`)) return;
        await api.del(`/api/auth/users/${u.id}`);
        load();
    };

    const residentName = (id) => {
        const r = residents.find(r => r.id === id);
        return r ? `${r.first_name} ${r.last_name}` : '—';
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0">Users</h4>
                <Button size="sm" onClick={openAdd}><i className="fas fa-plus mr-1" />Add User</Button>
            </div>
            <Card className="table-card">
                <Table hover responsive className="mb-0">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Linked Resident</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id}>
                                <td>{u.email}</td>
                                <td>
                                    <span className={`role-badge role-${u.role}`}>{u.role}</span>
                                </td>
                                <td>{residentName(u.resident_id)}</td>
                                <td className="text-right">
                                    <Button size="sm" variant="outline-secondary" className="mr-1"
                                        onClick={() => openEdit(u)}>
                                        <i className="fas fa-edit" />
                                    </Button>
                                    <Button size="sm" variant="outline-danger"
                                        onClick={() => handleDelete(u)}>
                                        <i className="fas fa-trash" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan="4" className="text-center text-muted py-4">No users found</td></tr>
                        )}
                    </tbody>
                </Table>
            </Card>

            <Modal show={showModal} onHide={closeModal}>
                <Modal.Header closeButton>
                    <Modal.Title>{editing ? 'Edit User' : 'Add User'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && <div className="alert alert-danger py-2">{error}</div>}
                    {!editing && (
                        <Form.Group>
                            <Form.Label>Email</Form.Label>
                            <Form.Control type="email" value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })} />
                        </Form.Group>
                    )}
                    <Form.Group>
                        <Form.Label>{editing ? 'New Password (leave blank to keep)' : 'Password'}</Form.Label>
                        <Form.Control type="password" value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Role</Form.Label>
                        <Form.Control as="select" value={form.role}
                            onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="resident">resident</option>
                            <option value="admin">admin</option>
                        </Form.Control>
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Linked Resident (optional)</Form.Label>
                        <Form.Control as="select" value={form.resident_id}
                            onChange={e => setForm({ ...form, resident_id: e.target.value })}>
                            <option value="">— None —</option>
                            {residents.map(r => (
                                <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
                            ))}
                        </Form.Control>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={closeModal}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Documents ──
function ChartsModal({ doc, analysis, onClose }) {
    const { Modal, Button } = ReactBootstrap;
    const chartRefs = React.useRef([]);
    const chartInstances = React.useRef([]);

    React.useEffect(() => {
        // Destroy old charts first
        chartInstances.current.forEach(c => c && c.destroy());
        chartInstances.current = [];

        if (!analysis || !analysis.charts) return;

        analysis.charts.forEach((chart, i) => {
            const canvas = chartRefs.current[i];
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            let config;
            if (chart.type === 'pie') {
                config = {
                    type: 'pie',
                    data: {
                        labels: chart.labels,
                        datasets: [{
                            data: chart.data,
                            backgroundColor: [
                                '#3498db','#e74c3c','#2ecc71','#f39c12','#9b59b6',
                                '#1abc9c','#e67e22','#34495e','#e91e63','#00bcd4',
                            ],
                        }],
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const val = ctx.parsed;
                                        return ` ${ctx.label}: ${chart.unit || ''}${val.toLocaleString()}`;
                                    },
                                },
                            },
                        },
                    },
                };
            } else {
                config = {
                    type: 'bar',
                    data: {
                        labels: chart.labels,
                        datasets: (chart.datasets || []).map((ds, di) => ({
                            label: ds.label,
                            data: ds.data,
                            backgroundColor: ['#3498db','#e74c3c','#2ecc71','#f39c12','#9b59b6'][di % 5],
                        })),
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { position: 'top' } },
                        scales: {
                            y: {
                                ticks: {
                                    callback: (val) => `${chart.unit || ''}${val.toLocaleString()}`,
                                },
                            },
                        },
                    },
                };
            }

            chartInstances.current[i] = new Chart(ctx, config);
        });

        return () => {
            chartInstances.current.forEach(c => c && c.destroy());
        };
    }, [analysis]);

    return (
        <Modal show onHide={onClose} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>{analysis ? analysis.title || doc.title : doc.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {analysis ? (
                    <div>
                        {analysis.summary && (
                            <div className="analysis-summary">{analysis.summary}</div>
                        )}
                        {analysis.charts && analysis.charts.map((chart, i) => (
                            <div key={i} className="chart-container">
                                <div className="chart-title">{chart.title}</div>
                                <canvas ref={el => chartRefs.current[i] = el} />
                            </div>
                        ))}
                        {analysis.highlights && analysis.highlights.length > 0 && (
                            <div className="mt-3">
                                <strong>Key Highlights</strong>
                                <ul className="highlights-list mt-2">
                                    {analysis.highlights.map((h, i) => (
                                        <li key={i}>{h}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-4 text-muted">No analysis available.</div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <a href={`/api/documents/${doc.id}/file`} className="btn btn-outline-secondary btn-sm" download>
                    <i className="fas fa-download mr-1" /> Download PDF
                </a>
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
}

function DocumentsPage({ user }) {
    const { Button, Modal, Form, Spinner } = ReactBootstrap;
    const perms = (user && user.permissions) || [];
    const can = (p) => perms.includes(p);

    const [docs, setDocs] = React.useState([]);
    const [showUpload, setShowUpload] = React.useState(false);
    const [form, setForm] = React.useState({ title: '', category: 'financial' });
    const [file, setFile] = React.useState(null);
    const [uploading, setUploading] = React.useState(false);
    const [analyzingIds, setAnalyzingIds] = React.useState({});
    const [viewDoc, setViewDoc] = React.useState(null);
    const [viewAnalysis, setViewAnalysis] = React.useState(null);

    const load = () => api.get('/api/documents').then(setDocs).catch(() => {});
    React.useEffect(() => { load(); }, []);

    const handleUpload = () => {
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', form.title || file.name);
        fd.append('category', form.category);
        fetch('/api/documents/upload', { method: 'POST', body: fd })
            .then(r => r.ok ? r.json() : Promise.reject(r))
            .then(() => {
                setUploading(false);
                setShowUpload(false);
                setForm({ title: '', category: 'financial' });
                setFile(null);
                load();
            })
            .catch(() => setUploading(false));
    };

    const handleAnalyze = (id) => {
        setAnalyzingIds(prev => ({ ...prev, [id]: true }));
        api.post(`/api/documents/${id}/analyze`)
            .then(() => load())
            .catch(() => {})
            .finally(() => setAnalyzingIds(prev => ({ ...prev, [id]: false })));
    };

    const handleViewCharts = (doc) => {
        setViewDoc(doc);
        api.get(`/api/documents/${doc.id}/analysis`)
            .then(setViewAnalysis)
            .catch(() => setViewAnalysis(null));
    };

    const handleDelete = (id) => api.del(`/api/documents/${id}`).then(load);

    const fmtSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString() : '';

    return (
        <div>
            <div className="d-flex justify-content-between mb-3">
                <h4>Documents</h4>
                {can('documents:write') && (
                    <Button size="sm" onClick={() => setShowUpload(true)}>
                        <i className="fas fa-upload mr-1" /> Upload Document
                    </Button>
                )}
            </div>

            {docs.length === 0 && (
                <div className="text-muted text-center py-4">No documents yet.</div>
            )}

            {docs.map(doc => (
                <div key={doc.id} className="doc-card">
                    <div className="doc-card-info">
                        <div className="doc-card-title">
                            <i className="fas fa-file-pdf mr-2 text-danger" />
                            {doc.title}
                        </div>
                        <div className="doc-card-meta">
                            <span className="doc-category-badge">{doc.category}</span>
                            {fmtDate(doc.uploaded_at)}
                            {doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ''}
                        </div>
                    </div>
                    <div className="doc-card-actions">
                        {doc.analysis_json ? (
                            <Button size="sm" variant="success" onClick={() => handleViewCharts(doc)}>
                                <i className="fas fa-chart-pie mr-1" /> View Charts
                            </Button>
                        ) : doc.mime_type === 'application/pdf' && can('documents:write') ? (
                            <Button size="sm" variant="outline-secondary"
                                disabled={!!analyzingIds[doc.id]}
                                onClick={() => handleAnalyze(doc.id)}>
                                {analyzingIds[doc.id]
                                    ? <span className="analyzing-badge"><Spinner animation="border" size="sm" /> Analyzing…</span>
                                    : <><i className="fas fa-magic mr-1" /> Analyze</>
                                }
                            </Button>
                        ) : null}
                        {can('documents:write') && (
                            <Button size="sm" variant="outline-danger"
                                onClick={() => handleDelete(doc.id)}>
                                <i className="fas fa-trash" />
                            </Button>
                        )}
                    </div>
                </div>
            ))}

            {/* Upload Modal */}
            <Modal show={showUpload} onHide={() => { setShowUpload(false); setFile(null); }}>
                <Modal.Header closeButton>
                    <Modal.Title>Upload Document</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Title</Form.Label>
                        <Form.Control value={form.title}
                            placeholder="e.g. Annual Budget 2024"
                            onChange={e => setForm({ ...form, title: e.target.value })} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Category</Form.Label>
                        <Form.Control as="select" value={form.category}
                            onChange={e => setForm({ ...form, category: e.target.value })}>
                            <option value="financial">Financial</option>
                            <option value="minutes">Meeting Minutes</option>
                            <option value="legal">Legal</option>
                            <option value="general">General</option>
                        </Form.Control>
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>File</Form.Label>
                        <Form.Control type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"
                            onChange={e => setFile(e.target.files[0])} />
                        <Form.Text className="text-muted">
                            PDFs will be automatically analyzed for charts and insights.
                        </Form.Text>
                    </Form.Group>
                    {uploading && file && file.type === 'application/pdf' && (
                        <div className="analyzing-badge mt-2">
                            <Spinner animation="border" size="sm" /> Uploading and analyzing…
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => { setShowUpload(false); setFile(null); }}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={!file || uploading}>
                        {uploading ? 'Uploading…' : 'Upload'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Charts Modal */}
            {viewDoc && (
                <ChartsModal
                    doc={viewDoc}
                    analysis={viewAnalysis}
                    onClose={() => { setViewDoc(null); setViewAnalysis(null); }}
                />
            )}
        </div>
    );
}

// ── Main App ──
function App() {
    const { Navbar, Container, Row, Col, Button } = ReactBootstrap;
    const [user, setUser] = React.useState(undefined); // undefined = loading, null = logged out
    const [page, setPage] = React.useState('dashboard');

    // Check for existing session on load
    React.useEffect(() => {
        api.get('/api/auth/me').then(setUser).catch(() => setUser(null));
    }, []);

    const handleLogin = (u) => setUser(u);
    const handleLogout = () => {
        api.post('/api/auth/logout').catch(() => {}).then(() => setUser(null));
    };

    if (user === undefined) return (
        <div className="login-page">
            <div className="text-center text-muted mt-5">Loading…</div>
        </div>
    );

    if (!user) return <LoginPage onLogin={handleLogin} />;

    const pages = {
        dashboard:     DashboardPage,
        units:         UnitsPage,
        residents:     ResidentsPage,
        board:         BoardPage,
        announcements: AnnouncementsPage,
        documents:     DocumentsPage,
        maintenance:   MaintenancePage,
        finances:      FinancesPage,
        staff:         StaffPage,
        applications:  ApplicationsPage,
        compliance:    CompliancePage,
        packages:      PackagesPage,
        users:         UsersPage,
    };

    const PageComponent = pages[page] || DashboardPage;

    return (
        <div>
            <Navbar bg="dark" variant="dark" expand="lg">
                <Navbar.Brand href="#" onClick={() => setPage('dashboard')}>
                    <i className="fas fa-home mr-2" />Apty
                </Navbar.Brand>
                <Navbar.Text className="ml-auto mr-3 text-light small">
                    {user.email}
                    <span className={`role-badge role-${user.role} ml-2`}>{user.role}</span>
                </Navbar.Text>
                <Button size="sm" variant="outline-light" onClick={handleLogout}>
                    Sign Out
                </Button>
            </Navbar>
            <Container fluid className="p-0">
                <Row noGutters>
                    <Col md={2}>
                        <Sidebar page={page} setPage={setPage} user={user} />
                    </Col>
                    <Col md={10} className="main-content">
                        <PageComponent user={user} />
                    </Col>
                </Row>
            </Container>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
