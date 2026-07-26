#!/bin/bash
# Evolution API 健康监控 - 自动检测断连并restart恢复
# 每3分钟检查一次，断连自动restart

API_URL='http://127.0.0.1:8081'
API_KEY='B7E2A9D4C6F1E8A3B5D7F9C2E4A6B8D1'
INSTANCE='jeremy-main'
LOG_FILE='/var/log/evolution-watchdog.log'

check_and_restart() {
    local state
    state=$(curl -s -m 10 -H "apikey: $API_KEY" "$API_URL/instance/connectionState/$INSTANCE" 2>/dev/null | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$state" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: API不可达，尝试restart..." >> $LOG_FILE
        curl -s -m 15 -X POST -H "apikey: $API_KEY" "$API_URL/instance/restart/$INSTANCE" > /dev/null 2>&1
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ACTION: restart已发送" >> $LOG_FILE
        sleep 10
        state=$(curl -s -m 10 -H "apikey: $API_KEY" "$API_URL/instance/connectionState/$INSTANCE" 2>/dev/null | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] RESULT: restart后状态=$state" >> $LOG_FILE
    elif [ "$state" = "close" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: 连接断开(close)，尝试restart..." >> $LOG_FILE
        curl -s -m 15 -X POST -H "apikey: $API_KEY" "$API_URL/instance/restart/$INSTANCE" > /dev/null 2>&1
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ACTION: restart已发送" >> $LOG_FILE
        sleep 10
        state=$(curl -s -m 10 -H "apikey: $API_KEY" "$API_URL/instance/connectionState/$INSTANCE" 2>/dev/null | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] RESULT: restart后状态=$state" >> $LOG_FILE
    else
        # 正常运行，只记录心跳（每10次记录一次，避免日志膨胀）
        local count=$(wc -l < $LOG_FILE 2>/dev/null || echo 0)
        if [ $((count % 10)) -eq 0 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: state=$state" >> $LOG_FILE
        fi
    fi
    
    # 日志超过500行就截断
    if [ $(wc -l < $LOG_FILE 2>/dev/null || echo 0) -gt 500 ]; then
        tail -100 $LOG_FILE > $LOG_FILE.tmp && mv $LOG_FILE.tmp $LOG_FILE
    fi
}

# 主循环
while true; do
    check_and_restart
    sleep 180  # 3分钟一次
done
