#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 --set=awd_password="$(cat /run/secrets/db_password)" <<'SQL'
CREATE ROLE awd LOGIN PASSWORD :'awd_password';
GRANT CONNECT ON DATABASE awd TO awd;
GRANT USAGE, CREATE ON SCHEMA public TO awd;
SQL
