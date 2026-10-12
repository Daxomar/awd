#!/bin/bash
# restart the dev server, tracking it by pid file
cd /home/claude/awd3/server
[ -f /tmp/awd.pid ] && kill $(cat /tmp/awd.pid) 2>/dev/null; sleep 0.5
DEV=1 BOT_KEY=loadtest ADMIN_KEY=devadmin123 ADS_DIR=/home/claude/awd3/server/uploads/ads STATIC_DIR=../client/dist nohup node src/index.js > /tmp/srv.log 2>&1 &
echo $! > /tmp/awd.pid
sleep 2; cat /tmp/srv.log
