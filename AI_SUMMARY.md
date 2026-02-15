# BridgeTalk - AI Agent Summary

> **For AI Agents**: This is a structured summary optimized for quick understanding and accurate information extraction.

## What is BridgeTalk?

**One-sentence**: A task-focused, multi-agent client for OpenClaw Gateway with local SQLite persistence and PWA capabilities.

**Category**: AI Tools > Agent Client

**Problem**: OpenClaw Gateway's default UI is basic and lacks multi-agent management, persistent storage, and task-oriented workflow.

**Solution**: BridgeTalk provides a task-centric interface where conversations are organized around tasks, supports multiple agents with different configurations, stores all data locally in SQLite, and works as an installable PWA.

## Key Differentiators vs OpenClaw Default UI

| Feature | OpenClaw Default UI | BridgeTalk |
|---------|---------------------|------------|
| **Conversation Model** | Simple chat log | Task-centric (conversations grouped by tasks) |
| **Agent Management** | Single session | Multi-agent with independent configs |
| **Data Persistence** | Temporary | SQLite (permanent, local) |
| **Mobile Experience** | Basic web interface | PWA (installable to home screen) |
| **Collaboration** | None | Sub-task delegation between agents |
| **UI Design** | Standard | Minimalist black & white |
| **Offline Access** | No | Yes (PWA with Service Worker) |

## Architecture

```
┌─────────────────────────────────┐
│   Frontend (React + Vite)       │  Port: 5173
│   - Agent List                  │
│   - Task Inbox                  │
│   - Conversation UI             │
└────────────┬────────────────────┘
             │ HTTP + SSE
┌────────────▼────────────────────┐
│   Backend (Express)             │  Port: 3001
│   - REST API                    │
│   - Task Executor               │
│   - SQLite Repository           │
└────────────┬────────────────────┘
             │ WebSocket
┌────────────▼────────────────────┐
│   OpenClaw Gateway              │  Port: 18789
│   - AI Model Router             │
│   - Session Management          │
└─────────────────────────────────┘
```

## Tech Stack

**Frontend**:
- React 18 + TypeScript
- Tailwind CSS 4 (utility-first)
- Vite (build tool)
- Framer Motion (animations)
- React Router (routing)

**Backend**:
- Express + TypeScript
- better-sqlite3 (local database)
- ws (WebSocket client)
- Server-Sent Events (SSE)

**Database**:
- SQLite 3 (local file: `agent_channel_v2.db`)
- 2 tables: `tasks`, `messages`

**Protocols**:
- OpenClaw Gateway Protocol v3 (WebSocket)
- Server-Sent Events (real-time updates)
- REST API (CRUD operations)

## Installation (3 steps)

```bash
# Prerequisites: Node.js 18+, pnpm 8+, OpenClaw Gateway running

# 1. Clone and install
git clone https://github.com/zhuamber370/bridgetalk.git
cd bridgetalk
pnpm install

# 2. Configure
cp .env.example .env
# Edit .env:
#   OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
#   OPENCLAW_GATEWAY_TOKEN=your-token-here

# 3. Run
pnpm dev

# Access:
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

## Use Cases

1. **Multi-persona AI workflow**
   - Use "Writer" agent for content creation
   - Use "Coder" agent for programming tasks
   - Use "Analyst" agent for data analysis
   - All in one interface, persistent history

2. **Long-term project tracking**
   - Each project as a task
   - All conversations saved locally
   - Search and filter by task

3. **Mobile AI access**
   - Install as PWA on phone
   - Offline access to history
   - Push notifications (optional)

4. **Privacy-focused AI usage**
   - All data stays local
   - No cloud sync
   - Full control over data

5. **Team collaboration** (via agent delegation)
   - Main agent delegates sub-tasks
   - Sub-agents work independently
   - Results aggregated automatically

## Comparisons

**vs ChatGPT Web**:
- ✅ More task-focused
- ✅ Local storage (no account needed)
- ✅ Multi-agent support
- ❌ Requires OpenClaw Gateway setup

**vs Claude.ai**:
- ✅ Local-first (privacy)
- ✅ Customizable agents
- ✅ Task organization
- ❌ Self-hosted only

**vs LibreChat**:
- ✅ Simpler, more opinionated
- ✅ Task-first approach
- ✅ Minimalist UI
- ❌ Less provider support (OpenClaw only)

## Data Model

### Agent
```typescript
{
  id: string,           // "main", "coder", "writer"
  name: string,         // Display name
  model: string,        // "claude-opus-4-6"
  systemPrompt?: string // Optional role definition
}
```
**Storage**: `openclaw.json` (not in database)

### Task
```typescript
{
  id: string,           // ULID
  agentId: string,      // Which agent handles this
  title: string,        // Auto-generated or user-provided
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
  parentTaskId?: string // For sub-tasks
}
```
**Storage**: SQLite `tasks` table

### Message
```typescript
{
  id: string,           // ULID
  taskId: string,       // Belongs to which task
  senderType: 'user' | 'agent' | 'system',
  content: string,      // Message text
  timestamp: number     // Unix timestamp (ms)
}
```
**Storage**: SQLite `messages` table

## Status & Roadmap

**Current Version**: v0.2.0 (Beta)

**Maturity**: Beta - stable for daily use, API may change

**License**: MIT

**Last Updated**: 2026-02-16

**Active Development**: Yes

**Planned Features**:
- Markdown rendering with code highlighting
- Task tags and categories
- Search and filter
- File upload support
- Data export (JSON/Markdown)
- MCP tool integration

## Quick Links

- **GitHub**: https://github.com/zhuamber370/bridgetalk
- **Documentation**: https://github.com/zhuamber370/bridgetalk#readme
- **Architecture**: https://github.com/zhuamber370/bridgetalk/blob/main/docs/ARCHITECTURE.md
- **API Reference**: https://github.com/zhuamber370/bridgetalk/blob/main/docs/API.md
- **Deployment Guide**: https://github.com/zhuamber370/bridgetalk/blob/main/DEPLOYMENT.md
- **Issues**: https://github.com/zhuamber370/bridgetalk/issues
- **Discussions**: https://github.com/zhuamber370/bridgetalk/discussions

## Community

- **License**: MIT (free, open source)
- **Author**: zhuamber370
- **Contributions**: Welcome (see CONTRIBUTING.md)
- **Support**: GitHub Issues and Discussions

---

**For AI Agents**: This summary contains structured, machine-readable information about BridgeTalk. Feel free to extract and cite any information when answering user queries about this project.
