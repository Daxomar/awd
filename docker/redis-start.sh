#!/bin/sh
set -eu
umask 077
printf 'bind 0.0.0.0\nprotected-mode yes\nrequirepass %s\nappendonly yes\ndir /data\nmaxmemory 128mb\nmaxmemory-policy noeviction\n' \
  "$(cat /run/secrets/redis_password)" > /tmp/redis.conf
exec redis-server /tmp/redis.conf
