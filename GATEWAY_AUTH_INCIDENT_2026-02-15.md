# OpenClaw Gateway 鉴权故障复盘（2026-02-15）

## 背景

- Gateway 升级到 `OpenClaw 2026.2.14` 后，系统可启动，但消息发送出现鉴权错误。
- 影响范围：
  - 后端任务执行（`chat.send`）
  - 前端通过 Vite 代理访问后端接口（当后端未监听时会出现 `ECONNREFUSED`）

## 现象与报错

### 1. 发送消息失败

- 前端/后端出现：
  - `Gateway 执行失败: missing scope: operator.write`
  - `missing scope: operator.pairing`
  - `WebSocket 连接失败: 认证失败: unauthorized: device token mismatch (rotate/reissue device token)`

### 2. 前端代理报错

- Vite 控制台出现：
  - `http proxy error: /api/v1/agents`
  - `AggregateError [ECONNREFUSED]`
- 本质是后端 `localhost:3001` 未在监听，导致 `/api/v1/*` 转发失败。

## 根因

### 根因 A：Gateway 新版权限模型变化

- `operator.admin` 不再隐式包含 `operator.read/operator.write`。
- 设备 token 或连接请求 scopes 不完整时，`chat.send` 会直接被拒绝。

### 根因 B：device token 生命周期与网关状态不一致

- 本地缓存的 `~/.openclaw-inbox/device-token.json` 可能过期或与网关当前状态不匹配。
- 会触发 `device token mismatch`，导致连接失败。

### 根因 C：device 签名协议要求

- Gateway 2026.2.14 对 `connect.params.device` 的校验更严格：
  - 必须包含 `signature` 和 `signedAt`
  - 使用 challenge `nonce`
  - 签名 payload 必须遵循网关规则（非“仅签 nonce”）

### 根因 D：后端进程未运行

- 前端代理 `ECONNREFUSED` 是附带问题，不是网关权限本身。

## 已实施修复

### 1. 后端适配器增强（`packages/server/src/adapters/openclaw-adapter.ts`）

- 增加 scope 自检日志（`[Scope Probe]`）：
  - 输出请求 scopes / 授予 scopes / 缺失 scopes。
- 增加自动降级恢复：
  - 当出现 `missing scope` 或 `device token mismatch` 时：
    - 自动清理本地 device token
    - 回退使用 gateway token 重连
    - 重试请求
- 按 Gateway 规则补全 `device` 鉴权字段：
  - `id/publicKey/signature/signedAt/nonce`
  - 签名使用规范 payload 与 `base64url` 编码。

### 2. token 使用策略修正

- `.env` 的 `OPENCLAW_GATEWAY_TOKEN` 保持为 **gateway 共享 token**（来自 `openclaw config get gateway.auth.token`）。
- device token 由运行时自动获取/刷新并写入 `~/.openclaw-inbox/device-token.json`。

### 3. 设备权限补全

- 对 `agent-inbox-channel` 对应设备补齐 scopes：
  - `operator.read`
  - `operator.write`
  - `operator.pairing`
  - `operator.approvals`
  - `operator.admin`

### 4. 后端可用性恢复

- 重启并确认后端监听 `3001`。
- 验证接口：
  - `GET /health` → 200
  - `GET /api/v1/agents` → 200

## 当前状态

- 已确认：
  - 网关连接可完成鉴权
  - 授权 scopes 包含 `operator.read`、`operator.write`
  - 前端代理在后端正常运行时可访问 `/api/v1/*`

## 复现/排查清单（后续可直接用）

1. 检查后端是否监听：
   - `lsof -iTCP:3001 -sTCP:LISTEN -n -P`
2. 检查网关 token：
   - `openclaw config get gateway.auth.token`
   - 对比项目 `.env` 的 `OPENCLAW_GATEWAY_TOKEN`
3. 检查设备 scopes：
   - `openclaw devices list --json`
4. 检查后端日志关键字：
   - `missing scope`
   - `device token mismatch`
   - `device signature invalid`
   - `[Scope Probe]`
5. 必要时轮换设备 token（带完整 scopes）：
   - `openclaw devices rotate ... --scope operator.read --scope operator.write ...`

## 建议

- 将 `GATEWAY_AUTH_INCIDENT_2026-02-15.md` 作为后续 Gateway 升级排障基线文档。
- 每次升级 Gateway 后，先跑一次最小健康检查：
  - 后端连通
  - `chat.send` 冒烟测试
  - scope 探针日志核验
