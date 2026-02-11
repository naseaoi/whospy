#!/bin/bash
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo "=== Whospy 更新 (分支: $BRANCH) ==="

# 拉取并强制同步
git fetch --all
git reset --hard "origin/$BRANCH"

# 仅在依赖变更时重装（对比 package-lock 文件）
NEED_INSTALL=false
if ! git diff --quiet HEAD@{1} -- package-lock.json client/package-lock.json server/package-lock.json 2>/dev/null; then
  NEED_INSTALL=true
fi

if [ "$NEED_INSTALL" = true ]; then
  echo "--- 检测到依赖变更，重新安装 ---"
  npm run install-all
else
  echo "--- 依赖无变更，跳过安装 ---"
fi

echo "--- 构建 ---"
npm run build

echo "--- 重启服务 ---"
pm2 restart ecosystem.config.cjs --update-env

echo "=== 更新完成 ==="
