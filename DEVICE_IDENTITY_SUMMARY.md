# OpenClaw Gateway Device Identity 实现总结

## 任务完成状态：✅ 完成

已成功在 `packages/server/src/adapters/openclaw-adapter.ts` 中实现完整的 device identity 支持，满足所有要求。

## 实现概览

### 1️⃣ Keypair 生成与加载
- ✅ 使用 Node.js 内置 `crypto.generateKeyPairSync('ed25519')` 生成 Ed25519 keypair
- ✅ 保存到 `~/.openclaw-inbox/device-keypair.json`（权限 0600）
- ✅ 格式：`{ publicKey: base64, privateKey: base64 }`
- ✅ 首次连接自动生成，后续连接自动加载

### 2️⃣ Device ID 计算
- ✅ Device ID = SHA256(publicKey) 的十六进制字符串（64字符）
- ✅ 在 `ensureDeviceIdentity()` 中计算并缓存

### 3️⃣ Connect 请求修改
已修改第 284-348 行的 connect 请求处理：

```typescript
// ✅ 添加 device 字段
device: {
  id: this.deviceId,
  publicKey: this.devicePublicKey,
  // 本地连接不需要 signature
}

// ✅ 修改 scopes（已配对设备使用更高权限）
scopes: ['operator.admin']

// ✅ 优先使用 device token
const authParam = this.deviceToken
  ? { deviceToken: this.deviceToken }
  : { token: this.gatewayToken };
```

### 4️⃣ Device Token 处理
- ✅ 从 `hello-ok` 响应的 `payload.auth.deviceToken` 提取 token
- ✅ 保存到 `~/.openclaw-inbox/device-token.json`（权限 0600）
- ✅ 后续连接优先使用 device token 而非 gateway token
- ✅ 支持 token 过期检查（`expiresAt` 字段）

### 5️⃣ 安全措施
- ✅ 配置目录权限：0700（仅所有者可访问）
- ✅ Keypair 文件权限：0600（仅所有者可读写）
- ✅ Token 文件权限：0600（仅所有者可读写）
- ✅ 加载 token 时检查过期时间

### 6️⃣ 无额外依赖
- ✅ 仅使用 Node.js 内置模块
  - `crypto`: generateKeyPairSync, createHash
  - `fs/promises`: 文件读写
  - `path`: 路径处理
  - `os`: 获取用户主目录

## 核心方法

### `ensureDeviceIdentity()` - 118-178 行
负责 device identity 的初始化：
1. 检查是否已加载（避免重复初始化）
2. 创建配置目录 `~/.openclaw-inbox/`
3. 加载或生成 Ed25519 keypair
4. 计算 device ID (SHA256 hex)
5. 加载 device token（如果存在且未过期）

### `saveDeviceToken()` - 183-194 行
负责保存 Gateway 返回的 device token：
1. 接收 token 和可选的 expiresAt
2. 保存到 `device-token.json`（权限 0600）
3. 更新内存中的 `this.deviceToken`

### 修改的 `ensureConnected()` - 212-221 行
在建立 WebSocket 连接前调用 `ensureDeviceIdentity()`：
```typescript
await this.ensureDeviceIdentity();  // 确保 device identity 已准备好
await this.connect();
```

### 修改的 `connect()` 握手逻辑 - 284-348 行
1. 优先使用 device token 认证
2. 在 connect 请求中添加 `device` 字段
3. 使用 `operator.admin` scopes
4. 从响应中提取并保存 device token

## 工作流程

### 首次连接（没有 keypair）
```
用户创建任务
  ↓
ensureDeviceIdentity()
  ↓
生成 Ed25519 keypair
  ↓
保存到 ~/.openclaw-inbox/device-keypair.json
  ↓
计算 device ID (SHA256)
  ↓
使用 gateway token + device 连接
  ↓
Gateway 返回 device token
  ↓
保存 device token
  ↓
任务执行成功
```

### 后续连接（已有 keypair）
```
用户创建任务
  ↓
ensureDeviceIdentity()
  ↓
加载现有 keypair
  ↓
加载 device token
  ↓
计算 device ID
  ↓
使用 device token + device 连接
  ↓
任务执行成功
```

## 测试验证

### 方法 1：运行测试脚本
```bash
node /Users/celastin/Desktop/claudecode/agent-inbox-channel/test-device-identity.js
```

验证项：
- ✓ 配置目录创建
- ✓ Ed25519 keypair 生成
- ✓ Device ID 计算（SHA256 hex）
- ✓ 文件保存和权限（0600）
- ✓ 文件读取验证
- ✓ Device token 保存

### 方法 2：启动服务器实测
```bash
cd /Users/celastin/Desktop/claudecode/agent-inbox-channel
pnpm dev
```

观察控制台日志：
```
[Device Identity] 生成新的 Ed25519 keypair
[Device Identity] Keypair 已保存到: ~/.openclaw-inbox/device-keypair.json
[Device Identity] Device ID: <64字符十六进制>
[Device Identity] 未找到 device token，将使用 gateway token
[Device Identity] Device token 已保存
```

### 方法 3：检查生成的文件
```bash
ls -la ~/.openclaw-inbox/
cat ~/.openclaw-inbox/device-keypair.json
cat ~/.openclaw-inbox/device-token.json
```

### 方法 4：验证权限错误已解决
创建测试任务，确认：
- ❌ 不再出现 "Permission denied" 错误
- ✅ 任务能够正常执行
- ✅ Agent 回复正常返回

## 文件清单

### 修改的文件
- `/Users/celastin/Desktop/claudecode/agent-inbox-channel/packages/server/src/adapters/openclaw-adapter.ts`
  - 新增导入：crypto, fs, path, os
  - 新增类型：DeviceKeyPair, DeviceToken
  - 新增属性：deviceId, devicePublicKey, deviceToken, deviceConfigDir
  - 新增方法：ensureDeviceIdentity(), saveDeviceToken()
  - 修改方法：ensureConnected(), connect()

### 新增的文件
- `/Users/celastin/Desktop/claudecode/agent-inbox-channel/test-device-identity.js` - 测试脚本
- `/Users/celastin/Desktop/claudecode/agent-inbox-channel/DEVICE_IDENTITY_IMPLEMENTATION.md` - 实现文档
- `/Users/celastin/Desktop/claudecode/agent-inbox-channel/DEVICE_IDENTITY_SUMMARY.md` - 本文档

### 运行时生成的文件（首次连接后）
- `~/.openclaw-inbox/device-keypair.json` - Ed25519 keypair
- `~/.openclaw-inbox/device-token.json` - Device token

## 关键代码位置

| 功能 | 文件 | 行数 |
|------|------|------|
| Device Identity 初始化 | openclaw-adapter.ts | 119-178 |
| Device Token 保存 | openclaw-adapter.ts | 183-194 |
| 连接前准备 | openclaw-adapter.ts | 212-221 |
| Connect 请求修改 | openclaw-adapter.ts | 284-348 |

## 日志示例

### 首次连接
```
[Device Identity] 生成新的 Ed25519 keypair
[Device Identity] Keypair 已保存到: /Users/celastin/.openclaw-inbox/device-keypair.json
[Device Identity] Device ID: a1b2c3d4e5f6...（64字符）
[Device Identity] 未找到 device token，将使用 gateway token
[Device Identity] Device token 已保存
```

### 后续连接
```
[Device Identity] 已加载现有 keypair
[Device Identity] Device ID: a1b2c3d4e5f6...（同一个 device ID）
[Device Identity] 已加载 device token
```

### Token 过期
```
[Device Identity] 已加载现有 keypair
[Device Identity] Device ID: a1b2c3d4e5f6...
[Device Identity] Device token 已过期
```

## 技术亮点

1. **幂等性保证**：`ensureDeviceIdentity()` 可以安全地多次调用
2. **降级策略**：优先 device token，失败降级到 gateway token
3. **过期检查**：自动识别过期的 device token
4. **详细日志**：每个关键步骤都有日志输出，便于调试
5. **安全性**：文件权限严格控制（0700 目录 + 0600 文件）
6. **零依赖**：仅使用 Node.js 内置模块

## 下一步操作

1. 运行 `pnpm dev` 启动服务器
2. 创建一个测试任务并发送消息
3. 观察控制台日志，验证 device identity 初始化成功
4. 检查 `~/.openclaw-inbox/` 目录下的文件
5. 确认不再出现权限错误

## 完成检查清单

- ✅ 使用 Node.js crypto 生成 Ed25519 keypair
- ✅ 保存到 `~/.openclaw-inbox/device-keypair.json`（权限 0600）
- ✅ 格式 `{ publicKey: base64, privateKey: base64 }`
- ✅ Device ID = SHA256(publicKey).hex（64字符）
- ✅ Connect 请求添加 `device` 字段
- ✅ Scopes 改为 `['operator.admin']`
- ✅ 从 hello-ok 提取 device token
- ✅ 保存 device token 到 `~/.openclaw-inbox/device-token.json`
- ✅ 优先使用 device token 而非 gateway token
- ✅ 文件权限安全（0600）
- ✅ 添加详细注释和日志
- ✅ 创建测试脚本
- ✅ 编写完整文档

**实现完成度：100%**
