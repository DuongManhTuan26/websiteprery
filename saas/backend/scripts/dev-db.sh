#!/usr/bin/env bash
# Starts a local Postgres 16 instance for development, initializing it on
# first run. Not a production setup — point DATABASE_URL at a managed
# instance (RDS/Supabase/Neon/...) for anything real; see README.md.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$BACKEND_DIR/.pgdata"
PGBIN="/usr/local/opt/postgresql@16/bin"

export PATH="$PGBIN:$PATH"
export LANG=C
export LC_ALL=C

if [ ! -d "$PGDATA" ]; then
  echo "Initializing Postgres data directory at $PGDATA ..."
  initdb -D "$PGDATA" --auth=trust --username=postgres --encoding=UTF8 --locale=C
fi

if pg_ctl -D "$PGDATA" status > /dev/null 2>&1; then
  echo "Postgres already running."
else
  pg_ctl -D "$PGDATA" -l "$PGDATA/logfile" -o "-p 5432 -k /tmp" start
fi

if ! psql -h /tmp -U postgres -lqt | cut -d '|' -f 1 | grep -qw preny_clone; then
  echo "Creating database preny_clone ..."
  createdb -h /tmp -U postgres preny_clone
fi

echo "Ready. DATABASE_URL=postgresql://postgres@localhost:5432/preny_clone"
