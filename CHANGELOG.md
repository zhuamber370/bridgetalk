# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Markdown rendering with code syntax highlighting
- Task tags and categories
- Search and filter functionality
- File upload and attachment support
- Data export (JSON/Markdown)
- MCP tool integration

## [0.2.0] - 2026-02-16

### Added
- **Multi-agent management system** - Manage multiple AI agents with different models and prompts
- **Task-focused conversation mode** - Conversations organized around tasks, not simple chat logs
- **Local SQLite data persistence** - All tasks and messages stored permanently in local database
- **PWA support** - Installable Progressive Web App with offline capability
- **Sub-task delegation** - Multiple agents can collaborate on complex tasks
- **Minimalist black & white UI** - Pure monochrome design with zero distractions
- **Complete REST API** - Full CRUD operations for agents, tasks, and messages
- **Server-Sent Events (SSE)** - Real-time updates for task status and new messages
- **Comprehensive documentation**:
  - Architecture design (docs/ARCHITECTURE.md)
  - API reference (docs/API.md)
  - Deployment guide (DEPLOYMENT.md)
  - Contributing guidelines (CONTRIBUTING.md)
  - Security policy (SECURITY.md)

### Changed
- Renamed project from `agent-inbox-channel` to `BridgeTalk`
- Updated package namespace from `@openclaw/*` to `@bridgetalk/*`
- Improved mobile responsiveness with adaptive layout
- Enhanced error handling and user feedback

### Technical
- **Frontend**: React 18, TypeScript, Tailwind CSS 4, Vite, Framer Motion
- **Backend**: Express, TypeScript, better-sqlite3, ws (WebSocket)
- **Database**: SQLite 3 with 2 tables (tasks, messages)
- **Protocol**: OpenClaw Gateway Protocol v3
- **Communication**: REST API + SSE for real-time updates

### Security
- All sensitive data (tokens, database) protected by `.gitignore`
- No hardcoded credentials in codebase
- SQLite database with file-level permissions
- Environment variable based configuration

## [0.1.0] - 2026-01 (Internal)

### Added
- Initial project structure
- Basic OpenClaw Gateway integration
- Simple chat interface
- Monorepo setup with pnpm workspaces

---

## Release Notes

### v0.2.0 Highlights

This is the first public release of BridgeTalk! 🎉

**What's New**:
- Complete rewrite with task-focused architecture
- Multi-agent support for managing different AI personalities
- Local SQLite persistence for full conversation history
- PWA capabilities - install to your home screen
- Minimalist black & white design

**Breaking Changes**:
- Complete API redesign (not compatible with v0.1.0)
- Database schema changes

**Migration**:
- No migration path from v0.1.0 (internal version)
- Fresh installation recommended

**Known Issues**:
- No Markdown rendering yet (plain text only)
- No file upload support
- Search functionality not implemented

**Feedback**:
Please report bugs and suggest features at https://github.com/zhuamber370/bridgetalk/issues

---

[Unreleased]: https://github.com/zhuamber370/bridgetalk/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/zhuamber370/bridgetalk/releases/tag/v0.2.0
