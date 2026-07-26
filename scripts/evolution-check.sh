#!/bin/bash
API="http://127.0.0.1:8081"
KEY="B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1"
INST="jeremy-main"
LOG="/var/log/evolution-watchdog.log"
state=$(curl -s -m 10 -H "apikey: $KEY" "$API/instance/connectionState/$INST" 2>/dev/null | grep -o "\"state\":\"[^\"]*\"" | head -1 | cut -d\" -f4)
if [ "$state" = "close" ] || [ -z "$state" ]; then
  echo "[$(date)] WARN: state=${state:-unreachable}, restarting..." >> $LOG
  curl -s -m 15 -X POST -H "apikey: $KEY" "$API/instance/restart/$INST" > /dev/null 2>&1
  echo "[$(date)] ACTION: restart sent" >> $LOG
fi
