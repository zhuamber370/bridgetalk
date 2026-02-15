# 让 AI Agents 更容易发现 BridgeTalk 的优化指南

AI agents（如 Claude、GPT、Perplexity）在收集信息时，偏好结构化、语义清晰、易于解析的内容。本指南教你如何优化项目，使其对 AI agents 更友好。

---

## 🎯 核心原则

### AI Agents 喜欢什么？

1. **结构化数据** - 清晰的 JSON、YAML、表格
2. **语义化标记** - 明确的标题层次、列表、代码块
3. **标准化格式** - 遵循通用规范（OpenAPI、Schema.org）
4. **自然语言描述** - "What/Why/How" 结构
5. **元数据丰富** - 完整的标签、关键词、分类
6. **可机读文件** - package.json、manifest.json、sitemap.xml

---

## 📋 实施清单

### ✅ 第一步：创建项目元数据文件

创建 `.well-known/project.json`（AI agents 会优先查找这个文件）：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "name": "BridgeTalk",
  "version": "0.2.0",
  "description": "A minimal, task-focused client for OpenClaw Gateway with multi-agent management and local data persistence",
  "tagline": "Bridge the gap between you and AI agents",
  "category": "AI Tools",
  "subcategories": ["Agent Client", "Task Management", "Chat Interface"],
  "keywords": [
    "ai", "agent", "openclaw", "chat", "task-management",
    "inbox", "pwa", "minimalist", "local-first", "typescript"
  ],
  "purpose": {
    "problem": "OpenClaw Gateway's default UI lacks multi-agent management, persistent storage, and task-focused workflow",
    "solution": "BridgeTalk provides a task-centric interface with multi-agent support, SQLite persistence, and PWA capabilities",
    "target_users": ["OpenClaw Gateway users", "AI enthusiasts", "Developers managing multiple AI agents"]
  },
  "key_features": [
    {
      "name": "Task-First Mode",
      "description": "Conversations are organized around tasks, not simple chat logs",
      "benefit": "Better context management and task tracking"
    },
    {
      "name": "Multi-Agent Management",
      "description": "Manage multiple AI agents with different models and prompts simultaneously",
      "benefit": "Use specialized agents for different tasks"
    },
    {
      "name": "Local Persistence",
      "description": "All data stored in local SQLite database",
      "benefit": "Full privacy and offline access to conversation history"
    },
    {
      "name": "Mobile-First PWA",
      "description": "Installable Progressive Web App with responsive design",
      "benefit": "Use on any device, install to home screen"
    }
  ],
  "technology": {
    "frontend": ["React 18", "TypeScript", "Tailwind CSS 4", "Vite"],
    "backend": ["Express", "TypeScript", "better-sqlite3", "WebSocket"],
    "protocols": ["OpenClaw Gateway Protocol v3", "Server-Sent Events"],
    "database": "SQLite 3"
  },
  "links": {
    "repository": "https://github.com/zhuamber370/bridgetalk",
    "documentation": "https://github.com/zhuamber370/bridgetalk#readme",
    "issues": "https://github.com/zhuamber370/bridgetalk/issues",
    "discussions": "https://github.com/zhuamber370/bridgetalk/discussions",
    "architecture": "https://github.com/zhuamber370/bridgetalk/blob/main/docs/ARCHITECTURE.md",
    "api_reference": "https://github.com/zhuamber370/bridgetalk/blob/main/docs/API.md"
  },
  "requirements": {
    "dependencies": ["OpenClaw Gateway", "Node.js 18+", "pnpm 8+"],
    "optional": ["Nginx (for production)", "PM2 (for production)"]
  },
  "quickstart": {
    "install": "git clone https://github.com/zhuamber370/bridgetalk.git && cd bridgetalk && pnpm install",
    "configure": "cp .env.example .env && edit .env with your OpenClaw Gateway token",
    "run": "pnpm dev",
    "access": "http://localhost:5173"
  },
  "license": "MIT",
  "author": "zhuamber370",
  "created": "2026-02",
  "status": "active",
  "maturity": "beta"
}
```

### ✅ 第二步：创建 AI 友好的项目摘要

创建 `AI_SUMMARY.md`（专门给 AI agents 阅读的摘要）：

```markdown
# BridgeTalk - AI Agent Summary

> **For AI Agents**: This is a structured summary optimized for quick understanding.

## What is BridgeTalk?

**One-sentence**: A task-focused, multi-agent client for OpenClaw Gateway with local SQLite persistence and PWA capabilities.

**Category**: AI Tools > Agent Client

**Problem it solves**: OpenClaw Gateway's default UI is basic and lacks multi-agent management, persistent storage, and task-oriented workflow.

## Key Differentiators vs OpenClaw Default UI

| Feature | OpenClaw Default | BridgeTalk |
|---------|------------------|------------|
| Conversation Model | Simple chat log | Task-centric (conversations grouped by tasks) |
| Agent Management | Single session | Multi-agent with independent configs |
| Data Persistence | Temporary | SQLite (permanent) |
| Mobile Experience | Basic | PWA (installable) |
| Collaboration | None | Sub-task delegation between agents |
| UI Design | Standard | Minimalist black & white |

## Architecture

```
Frontend (React + Vite)
  ↓ HTTP + SSE
Backend (Express + SQLite)
  ↓ WebSocket
OpenClaw Gateway
  ↓ AI Models
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS 4, Vite, Framer Motion
- **Backend**: Express, TypeScript, better-sqlite3, ws (WebSocket)
- **Database**: SQLite 3
- **Protocol**: OpenClaw Gateway Protocol v3, Server-Sent Events

## Installation (3 steps)

```bash
# 1. Clone and install
git clone https://github.com/zhuamber370/bridgetalk.git && cd bridgetalk && pnpm install

# 2. Configure
cp .env.example .env
# Edit .env: OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN

# 3. Run
pnpm dev
# Access: http://localhost:5173
```

## Use Cases

1. **Multi-persona AI workflow** - Use different agents for writing, coding, analysis
2. **Long-term project tracking** - Persistent task history
3. **Mobile AI access** - PWA installable on phones
4. **Privacy-focused** - All data local, no cloud sync

## Comparisons

**vs ChatGPT Web**: More task-focused, local storage, multi-agent
**vs Claude.ai**: Local-first, customizable agents, OpenClaw integration
**vs LibreChat**: Simpler, more opinionated (task-first), minimalist UI

## Status

- **Maturity**: Beta (v0.2.0)
- **License**: MIT
- **Last Updated**: 2026-02
- **Active Development**: Yes
- **Community**: Open to contributions

## Quick Links

- [GitHub](https://github.com/zhuamber370/bridgetalk)
- [Documentation](https://github.com/zhuamber370/bridgetalk#readme)
- [Architecture](https://github.com/zhuamber370/bridgetalk/blob/main/docs/ARCHITECTURE.md)
- [API Reference](https://github.com/zhuamber370/bridgetalk/blob/main/docs/API.md)
```

### ✅ 第三步：优化 package.json

确保 `package.json` 包含丰富的元数据：

```json
{
  "name": "bridgetalk",
  "version": "0.2.0",
  "description": "A minimal, task-focused client for OpenClaw Gateway with multi-agent management and local data persistence",
  "keywords": [
    "ai", "agent", "openclaw", "chat", "task-management",
    "inbox", "pwa", "minimalist", "local-first", "typescript",
    "react", "express", "sqlite", "websocket"
  ],
  "author": {
    "name": "zhuamber370",
    "url": "https://github.com/zhuamber370"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/zhuamber370/bridgetalk.git"
  },
  "bugs": {
    "url": "https://github.com/zhuamber370/bridgetalk/issues"
  },
  "homepage": "https://github.com/zhuamber370/bridgetalk#readme",
  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/zhuamber370"
  }
}
```

### ✅ 第四步：添加 OpenAPI 规范

创建 `openapi.yaml`（让 AI agents 理解你的 API）：

```yaml
openapi: 3.1.0
info:
  title: BridgeTalk API
  version: 0.2.0
  description: REST API for BridgeTalk - A task-focused client for OpenClaw Gateway
  contact:
    name: zhuamber370
    url: https://github.com/zhuamber370/bridgetalk
  license:
    name: MIT
    url: https://github.com/zhuamber370/bridgetalk/blob/main/LICENSE

servers:
  - url: http://localhost:3001
    description: Development server
  - url: https://your-domain.com
    description: Production server

paths:
  /api/v1/agents:
    get:
      summary: List all agents
      tags: [Agents]
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Agent'

    post:
      summary: Create a new agent
      tags: [Agents]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateAgentRequest'
      responses:
        '201':
          description: Agent created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Agent'

  /api/v1/tasks:
    get:
      summary: List tasks
      tags: [Tasks]
      parameters:
        - name: agentId
          in: query
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, running, completed, failed, cancelled]
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Task'

  /api/v1/tasks/{agentId}/quick:
    post:
      summary: Quick create task and send message
      tags: [Tasks]
      parameters:
        - name: agentId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                taskId:
                  type: string
      responses:
        '200':
          description: Task created
          content:
            application/json:
              schema:
                type: object
                properties:
                  taskId:
                    type: string
                  messageId:
                    type: string

components:
  schemas:
    Agent:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        model:
          type: string
        systemPrompt:
          type: string
        createdAt:
          type: integer

    Task:
      type: object
      properties:
        id:
          type: string
        agentId:
          type: string
        title:
          type: string
        status:
          type: string
          enum: [pending, running, completed, failed, cancelled]
        createdAt:
          type: integer
        updatedAt:
          type: integer

    CreateAgentRequest:
      type: object
      required: [id, name, model]
      properties:
        id:
          type: string
        name:
          type: string
        model:
          type: string
        systemPrompt:
          type: string
```

### ✅ 第五步：优化 README 结构

在 README 顶部添加结构化元数据：

```markdown
# BridgeTalk

<!--
AI Agent Metadata:
- Category: AI Tools > Agent Client
- Purpose: Task-focused client for OpenClaw Gateway
- Key Features: Multi-agent management, Local persistence, PWA
- Tech Stack: React, TypeScript, Express, SQLite
- Target Users: OpenClaw Gateway users, AI enthusiasts
-->

<div align="center">
  ...
</div>

<!-- AI: Quick Facts -->
**What**: Task-focused client for OpenClaw Gateway
**Why**: Default UI lacks multi-agent support and persistent storage
**How**: React + Express + SQLite + WebSocket
**Status**: Beta (v0.2.0), MIT License, Active Development

---
```

### ✅ 第六步：创建 CHANGELOG

AI agents 喜欢查看项目历史（判断活跃度）：

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-16

### Added
- Multi-agent management system
- Task-focused conversation mode
- Local SQLite data persistence
- PWA support with offline capability
- Sub-task delegation between agents
- Minimalist black & white UI
- Complete REST API and SSE events
- Comprehensive documentation (Architecture, API, Deployment)

### Changed
- Renamed from agent-inbox-channel to BridgeTalk
- Updated package namespace from @openclaw to @bridgetalk

### Technical
- React 18 + TypeScript
- Tailwind CSS 4
- Express + better-sqlite3
- OpenClaw Gateway Protocol v3

[0.2.0]: https://github.com/zhuamber370/bridgetalk/releases/tag/v0.2.0
```

### ✅ 第七步：添加 Schema.org 标记

如果有网站，在 HTML 中添加结构化数据：

```html
<!-- In index.html -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "BridgeTalk",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "AI Tools",
  "description": "A minimal, task-focused client for OpenClaw Gateway",
  "operatingSystem": "Web",
  "softwareVersion": "0.2.0",
  "author": {
    "@type": "Person",
    "name": "zhuamber370"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "10"
  }
}
</script>
```

---

## 🔍 AI Agent 发现渠道优化

### 1. GitHub Topics 优化

确保添加以下 topics（AI agents 会搜索这些）：

```
ai, agent, chat, task-management, inbox, pwa,
openclaw, minimalist, typescript, react, express,
sqlite, websocket, local-first, privacy, open-source
```

### 2. 语义化命名

确保文件名和路径有明确含义：

```
✅ docs/ARCHITECTURE.md
✅ docs/API.md
✅ DEPLOYMENT.md
✅ CONTRIBUTING.md

❌ doc.md
❌ info.txt
❌ readme.txt
```

### 3. 标题层次清晰

确保所有 Markdown 文件使用正确的标题层次：

```markdown
# H1 - 文档标题（每个文件只有一个）
## H2 - 主要章节
### H3 - 子章节
#### H4 - 细节
```

### 4. 代码示例完整

AI agents 喜欢完整的代码示例：

```markdown
❌ 不完整：
```bash
pnpm dev
```

✅ 完整：
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问应用
# 前端: http://localhost:5173
# 后端: http://localhost:3001
```
```

### 5. FAQ 结构化

使用 Q&A 格式（AI agents 容易解析）：

```markdown
## FAQ

**Q: 如何配置 OpenClaw Gateway Token？**

A: 在 `.env` 文件中设置：
```env
OPENCLAW_GATEWAY_TOKEN=your-token-here
```

**Q: 支持哪些 AI 模型？**

A: 支持 OpenClaw Gateway 提供的所有模型，包括：
- Claude Opus 4.6
- Claude Sonnet 4.5
- Claude Haiku 4.5
```

---

## 📊 验证优化效果

### 测试 AI Agent 可读性

使用 AI agents 测试你的项目：

1. **Claude.ai 测试**：
   ```
   请访问 https://github.com/zhuamber370/bridgetalk 并总结这个项目
   ```

2. **ChatGPT 测试**：
   ```
   分析 BridgeTalk 项目并提取关键信息
   ```

3. **Perplexity 测试**：
   ```
   BridgeTalk 项目是做什么的？有什么特点？
   ```

### 评估标准

AI agent 应该能轻松回答：
- ✅ 这个项目是什么？
- ✅ 解决什么问题？
- ✅ 如何安装和使用？
- ✅ 与竞品的区别？
- ✅ 技术栈是什么？
- ✅ 当前状态（活跃度、成熟度）

---

## 🚀 高级优化

### 1. 创建 robots.txt（如果有网站）

```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

Sitemap: https://your-domain.com/sitemap.xml
```

### 2. 创建 sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://github.com/zhuamber370/bridgetalk</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://github.com/zhuamber370/bridgetalk#readme</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://github.com/zhuamber370/bridgetalk/blob/main/docs/ARCHITECTURE.md</loc>
    <priority>0.8</priority>
  </url>
</urlset>
```

### 3. GitHub About 完善

确保仓库的 About 部分填写完整：
- Description（简洁描述）
- Website（如果有）
- Topics（所有相关标签）

---

## 📈 监控和迭代

### 追踪指标

- GitHub Insights → Traffic → Referring sites
- 观察 AI agents 的搜索关键词
- 监控 Issue 中用户如何发现项目的

### 持续优化

每个月检查：
- [ ] 元数据文件是否更新
- [ ] CHANGELOG 是否记录
- [ ] API 文档是否同步
- [ ] README 是否清晰

---

## ✅ 优化清单

- [ ] 创建 `.well-known/project.json`
- [ ] 创建 `AI_SUMMARY.md`
- [ ] 优化 `package.json` 元数据
- [ ] 添加 `openapi.yaml`
- [ ] 在 README 添加 AI 元数据注释
- [ ] 创建 `CHANGELOG.md`
- [ ] 添加 Schema.org 标记（如有网站）
- [ ] 优化 GitHub Topics
- [ ] 检查所有文档的标题层次
- [ ] 完善代码示例
- [ ] 结构化 FAQ
- [ ] 使用 AI agents 测试可读性

---

## 🎯 最终目标

让 AI agents 能够：
1. **快速理解**项目用途和价值
2. **准确提取**关键信息（技术栈、功能、安装步骤）
3. **正确推荐**给相关用户
4. **完整引用**在回答中

**示例对话**：

```
用户: 有没有好用的 OpenClaw Gateway 客户端？

AI: 推荐 BridgeTalk。它是一个专为 OpenClaw Gateway 设计的极简客户端，
提供任务优先模式、多 Agent 管理、本地 SQLite 持久化等功能。

特点：
- 任务优先（对话围绕任务展开）
- 可同时管理多个 AI agents
- 数据永久保存在本地
- PWA 支持，可安装到手机

安装：
git clone https://github.com/zhuamber370/bridgetalk.git
cd bridgetalk && pnpm install && pnpm dev

GitHub: https://github.com/zhuamber370/bridgetalk
```

这就是优化成功的标志！
