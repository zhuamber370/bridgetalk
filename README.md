# BridgeTalk

<div align="center">
  <img src="./packages/client/public/icon-512.svg" width="120" />
  <p><strong>Bridge the gap between you and AI agents.</strong></p>
  <p>A minimal, task-focused client for OpenClaw Gateway</p>
</div>

---

## 📖 What is this?

BridgeTalk is a modern client for **[OpenClaw Gateway](https://github.com/openclaw/gateway)**, communicating via WebSocket protocol.

**Core Features**: Task-first mode · Multi-agent management · Local data persistence · Mobile-first design · Pure black & white minimalist UI

### vs. OpenClaw Default UI

| Feature | OpenClaw Default UI | BridgeTalk |
|---------|---------------------|------------|
| Conversation Mode | Simple chat history | **Task-first**, conversations organized around tasks |
| Agent Management | Single session | **Multi-agent** simultaneous management |
| Data Persistence | Temporary | **SQLite** permanent storage |
| Mobile Experience | Basic | **PWA**, installable to home screen |
| Collaboration | None | **Subtask collaboration**, multi-agent coordination |
| UI Style | Standard | **Minimalist B&W**, zero distractions |

---

## 🚀 Quick Start

### Prerequisites

- ✅ **OpenClaw Gateway** installed and running (default `ws://127.0.0.1:18789`)
- ✅ Node.js 18+ and pnpm 8+

### 3-Step Installation

```bash
# 1. Clone and install
git clone https://github.com/zhuamber370/bridgetalk.git
cd bridgetalk
pnpm install

# 2. Configure (copy and edit .env)
cp .env.example .env
# Edit .env and fill in your OpenClaw Gateway Token

# 3. Start
pnpm dev
```

Visit **http://localhost:5173** to use.

### First Use

1. Click **"+ New Agent"**
2. Enter name (e.g. "Assistant") and select model (e.g. `claude-opus-4-6`)
3. After creation, click the agent card to enter Inbox
4. Type a message to start conversation

---

## 📱 UI Preview

- **Agent List** `/` - Manage all agents
- **Agent Inbox** `/agents/:id` - Task list + conversation window
- **Task Detail** `/agents/:id/tasks/:taskId` - View single task

---

## 🛠️ Development

```bash
# Start dev servers (frontend + backend)
pnpm dev

# Start separately
pnpm --filter @bridgetalk/client dev  # Frontend :5173
pnpm --filter @bridgetalk/server dev  # Backend :3001

# Build for production
pnpm build

# Type check
pnpm lint
```

**Data Locations**:
- Tasks and messages: `packages/server/agent_channel_v2.db`
- Agent config: `~/.openclaw/openclaw.json` (shared with OpenClaw Gateway)

---

## 🚢 Production Deployment

### Using PM2 + Nginx (Recommended)

```bash
# 1. Build
pnpm build

# 2. Start backend (using PM2)
cd packages/server
pm2 start dist/index.js --name bridgetalk
pm2 save

# 3. Configure Nginx (see nginx.conf.example)
sudo cp nginx.conf.example /etc/nginx/sites-available/bridgetalk
# Edit config, modify domain and paths
sudo ln -s /etc/nginx/sites-available/bridgetalk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guide.

---

## ❓ FAQ

<details>
<summary><strong>Q: Can't see any agents in the list?</strong></summary>

A: BridgeTalk reads agents from `~/.openclaw/openclaw.json`. If the list is empty:

1. Check if OpenClaw Gateway is properly configured
2. OpenClaw should have at least a `main` agent in `openclaw.json`
3. You can manually create agents in BridgeTalk using the **"+ New Agent"** button
4. Check backend logs: `pnpm --filter @bridgetalk/server dev`
</details>

<details>
<summary><strong>Q: "No available models" error?</strong></summary>

A: Check:
1. OpenClaw Gateway is running (`ws://127.0.0.1:18789`)
2. `OPENCLAW_GATEWAY_TOKEN` in `.env` is correct
3. View backend logs: `pnpm --filter @bridgetalk/server dev`
</details>

<details>
<summary><strong>Q: No response after sending message?</strong></summary>

A: Possible causes:
1. Gateway connection lost - check backend logs
2. Token expired - regenerate and update `.env`
3. Network issue - check browser console
</details>

<details>
<summary><strong>Q: How to backup data?</strong></summary>

A: Backup these two files:
```bash
cp packages/server/agent_channel_v2.db ~/backup/
cp ~/.openclaw/openclaw.json ~/backup/
```
</details>

---

## 📖 Documentation

- **Quick Start** - [README.md](./README.md) (this file)
- **Architecture** - [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **API Reference** - [docs/API.md](./docs/API.md)
- **Deployment Guide** - [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Contributing** - [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Security** - [SECURITY.md](./SECURITY.md)

---

## 🤝 Contributing

We welcome all forms of contributions!

- 🐛 [Report Bug](https://github.com/zhuamber370/bridgetalk/issues/new?labels=bug)
- 💡 [Feature Request](https://github.com/zhuamber370/bridgetalk/issues/new?labels=enhancement)
- 📝 [Improve Docs](https://github.com/zhuamber370/bridgetalk/issues/new?labels=documentation)
- 🔧 [Submit PR](./CONTRIBUTING.md)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

## 🙏 Acknowledgments

- Built with [OpenClaw Gateway](https://github.com/openclaw/gateway)
- Inspired by minimalist design principles

---

<div align="center">
  <p>Made with ⚫⚪ by <a href="https://github.com/zhuamber370">zhuamber370</a></p>
  <p>If you find this useful, please give it a ⭐️</p>
</div>
