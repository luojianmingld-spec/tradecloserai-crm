#!/bin/bash
# Usage: 
#   ./scripts/deploy.sh staging   # 部署到测试环境
#   ./scripts/deploy.sh prod      # 部署到生产环境  
#   ./scripts/deploy.sh promote   # 将develop合并到main并部署生产
#   ./scripts/deploy.sh rollback  # 回滚到上一个版本

ENV=$1

deploy_staging() {
    echo "=== 部署到 Staging ==="
    cd /opt/whatsapp-crm
    
    # 保存当前分支
    CURRENT_BRANCH=$(git branch --show-current)
    
    git checkout develop
    git pull origin develop 2>/dev/null || true
    
    # 构建前端到staging专用目录
    cd frontend && NODE_OPTIONS="--max-old-space-size=256" npm run build && cd ..
    
    # 重启staging服务
    systemctl restart whatsapp-crm-staging
    sleep 3
    
    # 健康检查（直连node端口）
    if curl -s --max-time 5 http://localhost:3003/api/health | grep -q ok; then
        echo "✅ Staging 部署成功"
        echo "   访问: http://45.76.223.251:3002 (via nginx)"
        echo "   直连: http://45.76.223.251:3003 (node direct)"
    else
        echo "❌ Staging 健康检查失败"
        systemctl status whatsapp-crm-staging --no-pager -l
        tail -20 /opt/whatsapp-crm/backend/staging.log
        exit 1
    fi
    
    # 切回原分支
    git checkout $CURRENT_BRANCH 2>/dev/null
}

deploy_prod() {
    echo "=== 部署到 Production ==="
    cd /opt/whatsapp-crm
    
    # 记录当前版本用于回滚
    PREV_COMMIT=$(git rev-parse HEAD)
    echo $PREV_COMMIT > /opt/whatsapp-crm/.prev-prod-commit
    
    git checkout main
    git pull origin main 2>/dev/null || true
    
    # 构建前端
    cd frontend && NODE_OPTIONS="--max-old-space-size=512" npm run build && cd ..
    
    # 重启生产服务
    systemctl restart whatsapp-crm
    sleep 5
    
    # 健康检查
    if curl -s --max-time 5 http://localhost:3000/api/health | grep -q ok; then
        echo "✅ Production 部署成功"
        echo "回滚命令: ./scripts/deploy.sh rollback"
    else
        echo "❌ Production 健康检查失败，自动回滚..."
        rollback
        exit 1
    fi
}

promote() {
    echo "=== 发布：develop → main ==="
    cd /opt/whatsapp-crm
    
    # 检查develop是否有未提交的改动
    git checkout develop
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ develop分支有未提交的改动，请先提交"
        exit 1
    fi
    
    # 合并到main
    git checkout main
    RELEASE_MSG="release: promote develop to main ($(date +%Y%m%d-%H%M))"
    git merge develop --no-ff -m "$RELEASE_MSG"
    
    # 部署生产
    deploy_prod
    
    echo "✅ 发布完成"
}

rollback() {
    echo "=== 回滚 Production ==="
    cd /opt/whatsapp-crm
    if [ -f .prev-prod-commit ]; then
        PREV=$(cat .prev-prod-commit)
        git checkout main
        git reset --hard $PREV
        cd frontend && NODE_OPTIONS="--max-old-space-size=512" npm run build && cd ..
        systemctl restart whatsapp-crm
        echo "✅ 已回滚到 $PREV"
    else
        echo "❌ 没有可回滚的版本记录"
        exit 1
    fi
}

case $ENV in
    staging)  deploy_staging ;;
    prod)     deploy_prod ;;
    promote)  promote ;;
    rollback) rollback ;;
    *)        echo "Usage: $0 {staging|prod|promote|rollback}" ; exit 1 ;;
esac
