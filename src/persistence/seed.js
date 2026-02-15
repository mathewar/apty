/**
 * Seed script: populates a fresh database with sample data for 250 W 82nd St.
 * Run: MYSQL_HOST=localhost MYSQL_USER=root MYSQL_PASSWORD=secret MYSQL_DB=apty node src/persistence/seed.js
 */
const db = require('./index');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

async function seed() {
    await db.init();
    console.log('Seeding database...');

    // ── Building ──
    const buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId,
        name: '250 West 82nd Street',
        address: '250 W 82nd St',
        city: 'New York',
        state: 'NY',
        zip: '10024',
        year_built: 1926,
        total_floors: 6,
        total_units: 24,
        building_type: 'coop',
    });
    console.log('Building created');

    // ── Units ──
    const units = [];
    const unitData = [
        { unit_number: '1A', floor: 1, rooms: 3.0, sq: 850, shares: 350, maint: 1275.00 },
        { unit_number: '1B', floor: 1, rooms: 2.0, sq: 650, shares: 270, maint: 985.00 },
        { unit_number: '1C', floor: 1, rooms: 4.0, sq: 1100, shares: 450, maint: 1640.00 },
        { unit_number: '1D', floor: 1, rooms: 2.5, sq: 750, shares: 310, maint: 1130.00 },
        { unit_number: '2A', floor: 2, rooms: 3.0, sq: 850, shares: 360, maint: 1310.00 },
        { unit_number: '2B', floor: 2, rooms: 2.0, sq: 650, shares: 275, maint: 1002.00 },
        { unit_number: '2C', floor: 2, rooms: 4.0, sq: 1100, shares: 460, maint: 1676.00 },
        { unit_number: '2D', floor: 2, rooms: 2.5, sq: 750, shares: 315, maint: 1148.00 },
        { unit_number: '3A', floor: 3, rooms: 3.0, sq: 850, shares: 370, maint: 1348.00 },
        { unit_number: '3B', floor: 3, rooms: 2.0, sq: 650, shares: 280, maint: 1020.00 },
        { unit_number: '3C', floor: 3, rooms: 4.0, sq: 1100, shares: 470, maint: 1712.00 },
        { unit_number: '3D', floor: 3, rooms: 2.5, sq: 750, shares: 320, maint: 1166.00 },
        { unit_number: '4A', floor: 4, rooms: 3.0, sq: 850, shares: 380, maint: 1384.00 },
        { unit_number: '4B', floor: 4, rooms: 2.0, sq: 650, shares: 285, maint: 1038.00 },
        { unit_number: '4C', floor: 4, rooms: 4.0, sq: 1100, shares: 480, maint: 1748.00 },
        { unit_number: '4D', floor: 4, rooms: 2.5, sq: 750, shares: 325, maint: 1184.00 },
        { unit_number: '5A', floor: 5, rooms: 3.5, sq: 900, shares: 400, maint: 1458.00 },
        { unit_number: '5B', floor: 5, rooms: 2.0, sq: 650, shares: 290, maint: 1057.00 },
        { unit_number: '5C', floor: 5, rooms: 4.5, sq: 1200, shares: 500, maint: 1822.00 },
        { unit_number: '5D', floor: 5, rooms: 3.0, sq: 800, shares: 340, maint: 1238.00 },
        { unit_number: '6A', floor: 6, rooms: 4.0, sq: 1050, shares: 420, maint: 1530.00 },
        { unit_number: '6B', floor: 6, rooms: 2.5, sq: 700, shares: 300, maint: 1093.00 },
        { unit_number: '6C', floor: 6, rooms: 5.0, sq: 1400, shares: 560, maint: 2040.00 },
        { unit_number: '6D', floor: 6, rooms: 3.5, sq: 950, shares: 365, maint: 1330.00 },
    ];

    for (const u of unitData) {
        const unit = {
            id: uuidv4(),
            building_id: buildingId,
            unit_number: u.unit_number,
            floor: u.floor,
            rooms: u.rooms,
            square_feet: u.sq,
            shares: u.shares,
            monthly_maintenance: u.maint,
            status: 'occupied',
        };
        await db.storeUnit(unit);
        units.push(unit);
    }
    console.log(`${units.length} units created`);

    // ── Residents ──
    const residentNames = [
        ['Sarah', 'Chen'], ['Michael', 'Rivera'], ['Patricia', 'Okafor'],
        ['David', 'Goldstein'], ['Elena', 'Petrov'], ['James', 'Washington'],
        ['Maria', 'Santos'], ['Robert', 'Kim'], ['Lisa', 'O\'Brien'],
        ['Thomas', 'Ahmad'], ['Jennifer', 'Nakamura'], ['William', 'Dupont'],
        ['Angela', 'Kowalski'], ['Charles', 'Mbeki'], ['Diana', 'Larsson'],
        ['Frank', 'Patel'], ['Grace', 'Hoffman'], ['Henry', 'Morales'],
        ['Irene', 'Fitzgerald'], ['Joseph', 'Tanaka'], ['Karen', 'Volkov'],
        ['Luis', 'MacGregor'], ['Nancy', 'Osei'], ['Oscar', 'Bergman'],
    ];

    const residents = [];
    for (let i = 0; i < units.length; i++) {
        const [first, last] = residentNames[i];
        const resident = {
            id: uuidv4(),
            unit_id: units[i].id,
            first_name: first,
            last_name: last,
            email: `${first.toLowerCase()}.${last.toLowerCase().replace("'", "")}@example.com`,
            phone: `212-555-${String(1000 + i).slice(-4)}`,
            role: 'shareholder',
            is_primary: true,
            move_in_date: '2020-01-15',
            shares_held: units[i].shares,
        };
        await db.storeResident(resident);
        residents.push(resident);
    }
    console.log(`${residents.length} residents created`);

    // ── Board Members ──
    const boardRoles = [
        { idx: 0, role: 'president' },
        { idx: 2, role: 'vice_president' },
        { idx: 4, role: 'treasurer' },
        { idx: 6, role: 'secretary' },
        { idx: 8, role: 'member' },
    ];
    for (const br of boardRoles) {
        await db.storeBoardMember({
            id: uuidv4(),
            resident_id: residents[br.idx].id,
            role: br.role,
            term_start: '2025-06-01',
            term_end: '2027-06-01',
            is_active: true,
        });
    }
    console.log('Board members created');

    // ── Announcements ──
    await db.storeAnnouncement({
        id: uuidv4(),
        title: 'Annual Shareholders Meeting',
        body: 'The annual shareholders meeting will be held on March 15th at 7:00 PM in the lobby. All shareholders are encouraged to attend. Proxy forms are available from the management office.',
        category: 'meeting',
        posted_by: residents[0].id,
    });
    await db.storeAnnouncement({
        id: uuidv4(),
        title: 'Water Shutoff - February 20',
        body: 'There will be a scheduled water shutoff on February 20th from 10:00 AM to 2:00 PM for boiler maintenance. Please plan accordingly.',
        category: 'maintenance',
        posted_by: residents[0].id,
    });
    await db.storeAnnouncement({
        id: uuidv4(),
        title: 'Reminder: No Moving on Weekends',
        body: 'Per house rules, move-ins and move-outs are only permitted Monday through Friday, 9:00 AM to 5:00 PM. Please coordinate with the super at least 48 hours in advance.',
        category: 'general',
        posted_by: residents[6].id,
    });
    console.log('Announcements created');

    // ── Maintenance Requests ──
    await db.storeMaintenanceRequest({
        id: uuidv4(),
        unit_id: units[5].id,
        submitted_by: residents[5].id,
        title: 'Leaky faucet in kitchen',
        description: 'The kitchen faucet has been dripping steadily for a few days. Getting worse.',
        location: 'Kitchen',
        priority: 'normal',
        status: 'open',
    });
    await db.storeMaintenanceRequest({
        id: uuidv4(),
        unit_id: null,
        submitted_by: residents[10].id,
        title: 'Lobby light flickering',
        description: 'The overhead light in the main lobby entrance has been flickering on and off.',
        location: 'Lobby',
        priority: 'low',
        status: 'in_progress',
        assigned_to: 'Super - Mike',
    });
    await db.storeMaintenanceRequest({
        id: uuidv4(),
        unit_id: units[15].id,
        submitted_by: residents[15].id,
        title: 'No heat in bedroom',
        description: 'The radiator in the bedroom is not producing any heat. Rest of the apartment is fine.',
        location: 'Bedroom',
        priority: 'high',
        status: 'open',
    });
    console.log('Maintenance requests created');

    // ── Staff ──
    await db.storeStaffMember({
        id: uuidv4(),
        name: 'Mike Torres',
        role: 'superintendent',
        phone: '212-555-0100',
        email: 'super@250w82.com',
        schedule: 'Mon-Fri 8am-5pm, on-call weekends',
    });
    await db.storeStaffMember({
        id: uuidv4(),
        name: 'Carlos Ramirez',
        role: 'porter',
        phone: '212-555-0101',
        schedule: 'Mon-Fri 7am-3pm',
    });
    console.log('Staff created');

    // ── Vendors ──
    await db.storeVendor({
        id: uuidv4(),
        company_name: 'Acme Elevator Co.',
        contact_name: 'John Smith',
        trade: 'elevator',
        phone: '212-555-0200',
        email: 'service@acmeelev.example.com',
        contract_expires: '2027-12-31',
    });
    await db.storeVendor({
        id: uuidv4(),
        company_name: 'City Plumbing & Heating',
        contact_name: 'Maria Gonzalez',
        trade: 'plumbing',
        phone: '212-555-0201',
        email: 'dispatch@cityplumb.example.com',
    });
    await db.storeVendor({
        id: uuidv4(),
        company_name: 'Safe Pest Control',
        contact_name: 'Alan Park',
        trade: 'exterminator',
        phone: '212-555-0202',
        contract_expires: '2026-06-30',
    });
    console.log('Vendors created');

    // ── Compliance Items ──
    await db.storeComplianceItem({
        id: uuidv4(),
        law_name: 'Local Law 11 - Facade Inspection (FISP)',
        description: 'Facade Inspection & Safety Program. Building facades must be inspected every 5 years.',
        due_date: '2027-02-01',
        status: 'upcoming',
        cost: 25000.00,
    });
    await db.storeComplianceItem({
        id: uuidv4(),
        law_name: 'Local Law 97 - Carbon Emissions',
        description: 'Buildings over 25,000 sq ft must meet emissions limits. Penalties begin 2030 for non-compliance.',
        due_date: '2030-01-01',
        status: 'upcoming',
    });
    await db.storeComplianceItem({
        id: uuidv4(),
        law_name: 'Local Law 152 - Gas Piping Inspection',
        description: 'Periodic inspection of gas piping systems in buildings. Must be performed by a licensed master plumber.',
        due_date: '2026-12-31',
        status: 'upcoming',
        cost: 5000.00,
    });
    console.log('Compliance items created');

    // ── Admin User ──
    await db.storeUser({
        id: uuidv4(),
        email: 'admin@250w82.com',
        password_hash: hashPassword('admin123'),
        resident_id: residents[0].id,
        role: 'admin',
    });
    console.log('Admin user created (admin@250w82.com / admin123)');

    console.log('\nSeed complete!');
    await db.teardown();
    process.exit(0);
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
