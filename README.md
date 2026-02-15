# BridgeTalk

<div align="center">
  <img src="./packages/client/public/icon-512.svg" width="120" />
  <p><strong>Bridge the gap between you and AI agents.</strong></p>
  <p>专为 OpenClaw Gateway 设计的极简客户端</p>
</div>

---

## 📖 这是什么？

BridgeTalk 是 **[OpenClaw Gateway](https://github.com/openclaw/gateway)** 的现代化客户端，通过 WebSocket 协议与 Gateway 通信。

**核心特性**：任务优先模式 · 多 Agent 管理 · 本地数据持久化 · 移动优先设计 · 纯黑白极简界面

### 与 OpenClaw 自带 UI 的区别

| 特性 | OpenClaw 默认 UI | BridgeTalk |
|------|-----------------|------------|
| 对话模式 | 简单聊天记录 | **任务优先**，对话围绕任务展开 |
| Agent 管理 | 单个会话 | **多 Agent** 同时管理 |
| 数据持久化 | 临时 | **SQLite** 永久保存 |
| 移动端体验 | 基础 | **PWA**，可安装到主屏幕 |
| 协作能力 | 无 | **子任务协作**，多 Agent 配合 |
| 界面风格 | 标准 | **极简黑白**，零干扰 |

---

## 🚀 快速开始

### 前置要求

- ✅ 已安装并运行 **OpenClaw Gateway**（默认 `ws://127.0.0.1:18789`）
- ✅ Node.js 18+ 和 pnpm 8+

### 三步安装

```bash
# 1. 克隆并安装
git clone https://github.com/zhuamber370/bridgetalk.git
cd bridgetalk
pnpm install

# 2. 配置（复制并编辑 .env）
cp .env.example .env
# 编辑 .env，填入你的 OpenClaw Gateway Token

# 3. 启动
pnpm dev
```

访问 **http://localhost:5173** 即可使用。

### 首次使用

1. 点击 **"+ 新建 Agent"**
2. 填写名称（如"助手"）和选择模型（如 `claude-opus-4-6`）
3. 创建成功后，点击 Agent 卡片进入 Inbox
4. 输入消息开始对话

---

## 📱 界面预览

- **Agent 列表页** `/` - 管理所有 agents
- **Agent Inbox** `/agents/:id` - 任务列表 + 对话窗口
- **任务详情** `/agents/:id/tasks/:taskId` - 查看单个任务

---

## 🛠️ 开发

```bash
# 启动开发服务器（前端 + 后端）
pnpm dev

# 单独启动
pnpm --filter @bridgetalk/client dev  # 前端 :5173
pnpm --filter @bridgetalk/server dev  # 后端 :3001

# 构建生产版本
pnpm build

# 类型检查
pnpm lint
```

**数据位置**：
- 任务和消息：`packages/server/agent_channel_v2.db`
- Agent 配置：`packages/server/openclaw.json`

---

## 🚢 生产部署

### 使用 PM2 + Nginx（推荐）

```bash
# 1. 构建
pnpm build

# 2. 启动后端（使用 PM2）
cd packages/server
pm2 start dist/index.js --name bridgetalk
pm2 save

# 3. 配置 Nginx（参考 nginx.conf.example）
sudo cp nginx.conf.example /etc/nginx/sites-available/bridgetalk
# 编辑配置，修改域名和路径
sudo ln -s /etc/nginx/sites-available/bridgetalk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

详细部署指南见 [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## ❓ 常见问题

<details>
<summary><strong>Q: 启动后看不到 Agent 列表？</strong></summary>

A: 首次启动时列表为空，需要手动创建第一个 Agent。
</details>

<details>
<summary><strong>Q: 提示"无可用模型"？</strong></summary>

A: 检查：
1. OpenClaw Gateway 是否已启动（`ws://127.0.0.1:18789`）
2. `.env` 中的 `OPENCLAW_GATEWAY_TOKEN` 是否正确
3. 查看后端日志：`pnpm --filter @bridgetalk/server dev`
</details>

<details>
<summary><strong>Q: 消息发送后没有响应？</strong></summary>

A: 可能原因：
1. Gateway 连接断开 - 检查后端日志
2. Token 过期 - 重新生成并更新 `.env`
3. 网络问题 - 检查浏览器控制台
</details>

<details>
<summary><strong>Q: 如何备份数据？</strong></summary>

A: 备份两个文件即可：
```bash
cp packages/server/agent_channel_v2.db ~/backup/
cp packages/server/openclaw.json ~/backup/
```
</details>

---

## 📖 文档

- **快速上手** - [README.md](./README.md)（本文档）
- **架构设计** - [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **API 参考** - [docs/API.md](./docs/API.md)
- **部署指南** - [DEPLOYMENT.md](./DEPLOYMENT.md)
- **贡献指南** - [CONTRIBUTING.md](./CONTRIBUTING.md)
- **安全政策** - [SECURITY.md](./SECURITY.md)

---

## 🤝 参与贡献

我们欢迎所有形式的贡献！

- 🐛 [报告 Bug](https://github.com/zhuamber370/bridgetalk/issues/new?labels=bug)
- 💡 [提出新功能](https://github.com/zhuamber370/bridgetalk/issues/new?labels=enhancement)
- 📝 [改进文档](https://github.com/zhuamber370/bridgetalk/issues/new?labels=documentation)
- 🔧 [提交代码](./CONTRIBUTING.md)

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源。

---

## 🙏 致谢

- 基于 [OpenClaw Gateway](https://github.com/openclaw/gateway) 构建
- 灵感来源于极简设计理念

---

<div align="center">
  <p>Made with ⚫⚪ by <a href="https://github.com/zhuamber370">zhuamber370</a></p>
  <p>如果觉得有用，请给个 ⭐️</p>
</div>
