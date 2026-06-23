# 部署指南

## 前置要求

- Node.js 18+
- Git
- GitHub CLI (gh)

## 发布流程

### 1. 更新版本号

```bash
# 编辑 client/package.json，修改 version 字段
# 例如：1.3.0 -> 1.4.0
```

### 2. 提交代码

```bash
git add -A
git commit -m "release: v1.4.0"
```

### 3. 创建标签

```bash
git tag -a v1.4.0 -m "v1.4.0

## 新增功能
- 功能描述

## Bug 修复
- 修复描述

## 优化改进
- 优化描述"
```

### 4. 推送到远程

```bash
git push origin main
git push origin v1.4.0
```

### 5. 创建 GitHub Release

```bash
gh release create v1.4.0 \
  --title "v1.4.0 - 版本标题" \
  --notes "## 新增功能
- 功能描述

## Bug 修复  
- 修复描述

## 优化改进
- 优化描述"
```

### 6. 触发 Docker 镜像构建

推送标签后，GitHub Actions 自动构建并推送多架构 Docker 镜像到：
- Docker Hub: `naseaoi/whospy:v1.4.0` 和 `naseaoi/whospy:latest`
- GitHub Container Registry: `ghcr.io/naseaoi/whospy:v1.4.0` 和 `ghcr.io/naseaoi/whospy:latest`

## 版本号规范

遵循语义化版本 (SemVer)：

- **主版本号 (Major)**：不兼容的 API 变更
- **次版本号 (Minor)**：向下兼容的功能新增
- **修订号 (Patch)**：向下兼容的问题修复

示例：
- `1.0.0` -> `2.0.0`：重大重构或不兼容变更
- `1.3.0` -> `1.4.0`：新增功能
- `1.3.0` -> `1.3.1`：Bug 修复
