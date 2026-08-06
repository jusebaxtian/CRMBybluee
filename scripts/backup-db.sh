#!/bin/bash
# Daily Postgres backup for the self-hosted Supabase database.
# Deployed to the VPS at /opt/backups/backup-db.sh and run nightly via cron.
# Keeps the last $RETENTION_DAYS days of backups, deletes older ones.

set -euo pipefail

BACKUP_DIR="/opt/backups/db"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="crm-bybluee-db-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec -u postgres supabase-db pg_dump -d postgres | gzip > "${BACKUP_DIR}/${FILENAME}"

# Drop anything older than RETENTION_DAYS.
find "$BACKUP_DIR" -name "crm-bybluee-db-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "Backup completed: ${BACKUP_DIR}/${FILENAME}"
