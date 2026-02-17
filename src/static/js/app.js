// ── API helper ──
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

function StatusBadge({ status }) {
    const label = (status || '').replace(/_/g, ' ');
    return <span className={`badge badge-${status}`}>{label}</span>;
}

// ── Sidebar ──
function Sidebar({ page, setPage }) {
    const { Nav } = ReactBootstrap;
    const items = [
        { key: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
        { key: 'units', icon: 'fa-building', label: 'Units' },
        { key: 'residents', icon: 'fa-users', label: 'Residents' },
        { key: 'board', icon: 'fa-user-tie', label: 'Board' },
        { key: 'announcements', icon: 'fa-bullhorn', label: 'Announcements' },
        { key: 'maintenance', icon: 'fa-wrench', label: 'Maintenance' },
        { key: 'finances', icon: 'fa-dollar-sign', label: 'Finances' },
        { key: 'staff', icon: 'fa-hard-hat', label: 'Staff & Vendors' },
        { key: 'applications', icon: 'fa-file-alt', label: 'Applications' },
        { key: 'compliance', icon: 'fa-clipboard-check', label: 'Compliance' },
        { key: 'packages', icon: 'fa-box', label: 'Packages' },
    ];
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
function PackagesPage() {
    const { Card, Table, Button, Modal, Form, Badge } = ReactBootstrap;
    const [packages, setPackages] = React.useState([]);
    const [units, setUnits] = React.useState([]);
    const [filter, setFilter] = React.useState('all');
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({});

    const load = () => api.get('/api/packages').then(setPackages).catch(() => {});
    React.useEffect(() => {
        load();
        api.get('/api/units').then(setUnits).catch(() => {});
    }, []);

    const filtered = filter === 'all' ? packages : packages.filter(p => p.status === filter);

    const handleAdd = () => {
        api.post('/api/packages', { ...form, status: 'arrived' }).then(() => {
            setShowAdd(false); setForm({}); load();
        }).catch(() => {});
    };

    const markPickedUp = (id) => {
        api.put(`/api/packages/${id}`, { status: 'picked_up', picked_up_at: new Date().toISOString() })
            .then(load).catch(() => {});
    };

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

            <Modal show={showAdd} onHide={() => setShowAdd(false)}>
                <Modal.Header closeButton><Modal.Title>Log Package</Modal.Title></Modal.Header>
                <Modal.Body>
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
                            placeholder="UPS, FedEx, USPS…" />
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
                    <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button onClick={handleAdd}>Save</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// ── Main App ──
function App() {
    const { Navbar, Container, Row, Col } = ReactBootstrap;
    const [page, setPage] = React.useState('dashboard');

    const pages = {
        dashboard: DashboardPage,
        units: UnitsPage,
        residents: ResidentsPage,
        board: BoardPage,
        announcements: AnnouncementsPage,
        maintenance: MaintenancePage,
        finances: FinancesPage,
        staff: StaffPage,
        applications: ApplicationsPage,
        compliance: CompliancePage,
        packages: PackagesPage,
    };

    const PageComponent = pages[page] || DashboardPage;

    return (
        <div>
            <Navbar bg="dark" variant="dark" expand="lg">
                <Navbar.Brand href="#" onClick={() => setPage('dashboard')}>
                    <i className="fas fa-home mr-2" />Apty
                </Navbar.Brand>
                <Navbar.Text className="ml-auto text-light">
                    Co-op Building Management
                </Navbar.Text>
            </Navbar>
            <Container fluid className="p-0">
                <Row noGutters>
                    <Col md={2}>
                        <Sidebar page={page} setPage={setPage} />
                    </Col>
                    <Col md={10} className="main-content">
                        <PageComponent />
                    </Col>
                </Row>
            </Container>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
