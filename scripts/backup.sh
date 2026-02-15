#!/bin/bash
# Backup script for Apty co-op platform
# Creates a timestamped MySQL dump and copies uploaded documents.
#
# Usage:
#   ./scripts/backup.sh
#
# To run via Docker Compose:
#   docker-compose exec mysql mysqldump -u root -psecret apty > backup.sql
#
# Cron example (nightly at 2am):
#   0 2 * * * /path/to/apty/scripts/backup.sh >> /var/log/apty-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"

MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-secret}"
MYSQL_DB="${MYSQL_DB:-apty}"

mkdir -p "${BACKUP_PATH}"

echo "[${TIMESTAMP}] Starting backup..."

# Database dump
echo "Dumping database..."
mysqldump -h "${MYSQL_HOST}" -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD}" \
    "${MYSQL_DB}" > "${BACKUP_PATH}/database.sql"

# Documents
if [ -d "./data/documents" ]; then
    echo "Copying documents..."
    cp -r ./data/documents "${BACKUP_PATH}/documents"
fi

# Compress
echo "Compressing..."
tar -czf "${BACKUP_DIR}/apty_backup_${TIMESTAMP}.tar.gz" -C "${BACKUP_DIR}" "${TIMESTAMP}"
rm -rf "${BACKUP_PATH}"

echo "Backup complete: ${BACKUP_DIR}/apty_backup_${TIMESTAMP}.tar.gz"

# Keep only last 30 backups
ls -t "${BACKUP_DIR}"/apty_backup_*.tar.gz 2>/dev/null | tail -n +31 | xargs -r rm
