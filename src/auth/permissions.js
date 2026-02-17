// Fine-grained permission strings.
// Each permission is '<resource>:<action>'.
const PERMISSIONS = {
    BUILDING_READ:        'building:read',
    BUILDING_WRITE:       'building:write',

    UNITS_READ:           'units:read',
    UNITS_WRITE:          'units:write',

    RESIDENTS_READ:       'residents:read',
    RESIDENTS_WRITE:      'residents:write',

    BOARD_READ:           'board:read',
    BOARD_WRITE:          'board:write',

    ANNOUNCEMENTS_READ:   'announcements:read',
    ANNOUNCEMENTS_WRITE:  'announcements:write',

    DOCUMENTS_READ:       'documents:read',
    DOCUMENTS_WRITE:      'documents:write',

    MAINTENANCE_READ:     'maintenance:read',
    MAINTENANCE_WRITE:    'maintenance:write',   // submit a request
    MAINTENANCE_MANAGE:   'maintenance:manage',  // update status, assign

    FINANCES_READ:        'finances:read',
    FINANCES_WRITE:       'finances:write',

    STAFF_READ:           'staff:read',
    STAFF_WRITE:          'staff:write',

    VENDORS_READ:         'vendors:read',
    VENDORS_WRITE:        'vendors:write',

    APPLICATIONS_READ:    'applications:read',
    APPLICATIONS_WRITE:   'applications:write',

    WAITLISTS_READ:       'waitlists:read',
    WAITLISTS_WRITE:      'waitlists:write',

    COMPLIANCE_READ:      'compliance:read',
    COMPLIANCE_WRITE:     'compliance:write',

    PACKAGES_READ:        'packages:read',
    PACKAGES_WRITE:       'packages:write',

    PROVIDERS_READ:       'providers:read',
    PROVIDERS_WRITE:      'providers:write',

    USERS_READ:           'users:read',
    USERS_WRITE:          'users:write',
};

// Roles are named collections of permissions.
// Adding a new role here is all that's needed to create a custom role in the future.
const ROLE_PERMISSIONS = {
    admin: Object.values(PERMISSIONS),

    resident: [
        PERMISSIONS.BUILDING_READ,
        PERMISSIONS.UNITS_READ,
        PERMISSIONS.RESIDENTS_READ,
        PERMISSIONS.BOARD_READ,
        PERMISSIONS.ANNOUNCEMENTS_READ,
        PERMISSIONS.DOCUMENTS_READ,
        PERMISSIONS.MAINTENANCE_READ,
        PERMISSIONS.MAINTENANCE_WRITE,
        PERMISSIONS.COMPLIANCE_READ,
        PERMISSIONS.PACKAGES_READ,
        PERMISSIONS.PACKAGES_WRITE,
        PERMISSIONS.WAITLISTS_READ,
        PERMISSIONS.WAITLISTS_WRITE,
    ],
};

function getPermissionsForRole(role) {
    return ROLE_PERMISSIONS[role] || [];
}

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, getPermissionsForRole };
