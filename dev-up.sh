#!/bin/bash
# bring up redis + postgres + game server (dev)
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes --save "" >/dev/null
pg_isready -h 127.0.0.1 >/dev/null 2>&1 || (service postgresql start >/dev/null; sleep 2)
/home/claude/awd3/run-server.sh
