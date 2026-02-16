# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

always reply in chinese
## Project Overview

**BridgeTalk** — A minimal, task-focused client for OpenClaw Gateway. A mobile-first H5/PWA chat application where users delegate tasks to Agents via natural language or quick-action buttons. Task execution progress and results are displayed inline in the conversation flow. All data is stored locally (zero cloud sync).

The requirements specification is in `REQUIREMENTS.md` (written in Chinese).

## Current State

This project is in the **specification phase**. `REQUIREMENTS.md` contains the full MVP v1.0 requirements. No source code, build system, or package configuration exists yet.

## Architecture

Three-tier design:

```
Client (H5/PWA)  ──HTTP+SSE──>  Task Inbox Engine (Node/Python)  ──HTTP──>  Protocol + Adapter (OpenClaw Gateway)
```

- **Client**: UI rendering, local storage (SQLite/IndexedDB), SSE connection management, browser push notifications, data export/import
- **Task Inbox Engine**: Task lifecycle & state machine, intent routing with confidence scoring, message persistence, SSE event broadcasting, adapter registry
- **Protocol + Adapter**: OpenClaw Gateway communication, tool whitelist enforcement, dangerous command detection, execution stream handling

## Core Data Models

Four entities stored locally, all using ULID for IDs:

- **Task**: status flow `pending → running → completed/failed/cancelled`, priority P0-P2, confidence-based auto-assignment (≥0.7 auto-route, <0.7 ask user)
- **Message**: belongs to a Task, sender is `user|agent|system`, contentType is `text|card|task_created|task_update`, can carry action buttons
- **Update**: task progress events — `status_change|progress|result|error|log`
- **Artifact**: file attachments with SHA256 checksums

## API Design

REST endpoints under `/api/v1/`:
- Tasks: CRUD + cancel/retry at `/tasks`
- Messages: send/list at `/tasks/:id/messages`
- Data management: export/import/wipe
- Adapters: list and health check

SSE endpoints:
- `/api/v1/events` — global event stream (task status changes, system notifications)
- `/api/v1/tasks/:id/events` — per-task stream (execution logs, intermediate results)
- Supports resume via `Last-Event-ID` header

## Key Design Decisions

- **Chat-first**: All interactions happen within the conversation flow. Task cards, confirmation cards, and action buttons are embedded inline — no page navigation.
- **Default task continuation**: New messages append to the active task. Only create a new task when confidence is low or user explicitly requests it.
- **Quick action buttons**: Max 3 buttons per prompt, verb-prefixed labels (≤4 Chinese characters), always paired with natural language fallback input.
- **Tool whitelist**: Only `read`, `write`, `edit`, `exec`, `web_search`, `web_fetch`, `browser`, `message` are allowed. All other tools are blocked.
- **Safety confirmation**: Dangerous shell patterns (`rm -rf`, `dd if=`, `mkfs`, pipe-to-shell) trigger a confirmation card. `sudo`/`systemctl` commands require warning-level confirmation.
- **Local-only storage**: SQLite (preferred, with optional SQLCipher encryption) or IndexedDB. 90-day retention, soft-delete with 30-day physical cleanup. Export as JSON with SHA256 checksum, optional AES-256 encryption.

## Configuration

Adapter config uses YAML with environment variables:
- `OPENCLAW_GATEWAY_URL` — Gateway endpoint
- `OPENCLAW_GATEWAY_TOKEN` — Authentication token
- Feature flags: `useRealExecution`, `dangerousToolsEnabled`, `confirmationBypass`

A mock adapter exists for development; the `adapters.mock.enabled` / `adapters.openclaw.enabled` flags control which is active.

## Target Platforms

- iOS Safari 16+, Android Chrome 110+, Samsung Internet
- PWA installable
- Mobile-first, single-hand operation (≥90% thumb-reachable)

## Performance Targets

- First screen load: <2s (Lighthouse TTI)
- Interaction response: <100ms
- Agent first response: <3s
- Task creation: ≤2 steps
