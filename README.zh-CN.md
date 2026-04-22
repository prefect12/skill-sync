# SkillSync Mac

[English](./README.md) | 简体中文

SkillSync Mac 是一个基于 `Tauri + React` 的桌面应用，用于在多台 Mac 之间管理和同步
skill 目录，并以 GitHub 作为共享的事实来源。

## 功能说明

- 扫描 Codex 和 Claude 的本地 skill 根目录
- 识别常见预设目录，例如：
  - `~/.codex/skills`
  - `~/.claude/skills`
  - 项目级 `.claude/skills`
- 允许用户添加自定义 skill 根目录
- 并排展示本地与远程 skill 清单
- 显示本地文件时间戳和远程最后一次提交时间戳
- 支持按 skill 级别和根目录级别进行选择
- 针对用户提供的 GitHub 仓库执行选择性同步
- 在发生冲突或删除情况时，要求用户先显式审核再同步

## 当前范围

版本 `0.1.0` 仅聚焦于 `skills`。

当前版本不包含：

- Claude commands
- agents
- plugins
- session history
- auth tokens and secrets
- 重写 Codex 或 Claude 的运行时配置

## 项目结构

```text
skill-sync-mac/
  src/                 React UI and app state
  src/components/      Panels, lists, and root management UI
  src/lib/             Shared types, status logic, and Tauri bindings
  src-tauri/           Desktop backend, filesystem scan, and git sync logic
```

## 本地运行

安装前端依赖：

```bash
npm install
```

以开发模式运行桌面应用：

```bash
npm run tauri dev
```

仅构建前端产物：

```bash
npm run build
```

验证 Tauri 后端：

```bash
cd src-tauri
cargo check
```

在打 tag 前检查发布版本是否一致：

```bash
npm run release:check
```

## 同步模型

- 用户提供一个 GitHub 仓库 URL
- 应用会在以下目录维护一个本地克隆：
  `~/Library/Application Support/SkillSync/repos/<hash>/repo`
- 每个已配置的根目录都会映射到仓库中的一个子路径，例如：
  `roots/codex-home`
- 任何包含 `SKILL.md` 的目录都会被视为一个 skill
- 同步操作使用系统 `git` 可执行文件，以及用户本地已有的 git 凭据

## 安全规则

- 一键同步只会作用于已选中的项目
- 冲突项和待删除项会先进入审核面板
- 破坏性操作需要用户显式确认
- 应用不会同步整个 `~/.codex` 或 `~/.claude`

## 打包说明

当前的 Tauri 配置已支持 macOS DMG 打包。这个仓库目前包含占位图标，适合本地开发和内部迭代。
在正式公开发布之前，需要替换占位图标、完善 bundle 元数据，并决定签名与 notarization 方案。

## 发布流程

这个仓库现在包含 GitHub Actions 发布工作流：
`.github/workflows/release.yml`。

当前行为：

- 在推送匹配 `v*` 的 tag 时自动触发
- 支持在 `Actions -> Release` 中手动重跑
- 构建 Apple Silicon 和 Intel 两个目标的未签名 macOS DMG
- 自动创建或更新对应的 GitHub Release，并上传 DMG 产物

发布步骤：

1. 同步更新 `package.json`、`src-tauri/tauri.conf.json` 和
   `src-tauri/Cargo.toml` 中的版本号
2. 运行 `npm run release:check`
3. 提交版本变更
4. 推送类似 `v0.1.0` 的 tag

```bash
git tag v0.1.0
git push origin v0.1.0
```

当前这套流程使用默认的 `GITHUB_TOKEN`，所以发布未签名版本时不需要额外 secrets。
如果后续要做签名和 notarization，可以在 GitHub Actions 里补充 Apple 相关 secrets，
并在这个 workflow 上继续扩展。
