# Device Identity 实现报告

## 实现摘要

已在 `/Users/celastin/Desktop/claudecode/agent-inbox-channel/packages/server/src/adapters/openclaw-adapter.ts` 中完整实现 OpenClaw Gateway 的 device identity 支持。

## 主要修改

### 1. 新增导入依赖

```typescript
import { randomUUID, generateKeyPairSync, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
```

使用 Node.js 内置模块，无需额外依赖。

### 2. 新增类型定义

```typescript
interface DeviceKeyPair {
  publicKey: string;  // base64
  privateKey: string; // base64
}

interface DeviceToken {
  token: string;
  expiresAt?: number;
}
```

### 3. 新增实例属性

```typescript
private deviceId: string | null = null;
private devicePublicKey: string | null = null;
private deviceToken: string | null = null;
private readonly deviceConfigDir = join(homedir(), '.openclaw-inbox');
```

### 4. 核心方法：`ensureDeviceIdentity()`

功能：
- 确保配置目录 `~/.openclaw-inbox/` 存在（权限 0700）
- 加载或生成 Ed25519 keypair
- 计算 Device ID = SHA256(publicKey).hex
- 加载 device token（如果存在且未过期）

文件保存：
- `~/.openclaw-inbox/device-keypair.json` - keypair（权限 0600）
- `~/.openclaw-inbox/device-token.json` - device token（权限 0600）

### 5. 核心方法：`saveDeviceToken()`

功能：
- 从 Gateway 的 `hello-ok` 响应中提取 device token
- 保存到 `~/.openclaw-inbox/device-token.json`
- 更新内存中的 `this.deviceToken`

### 6. 修改 connect 握手流程

#### 修改前（第 177-217 行）：
```typescript
auth: { token: this.gatewayToken },
scopes: ['operator.read', 'operator.write'],
```

#### 修改后：
```typescript
// 优先使用 device token，否则使用 gateway token
const authParam = this.deviceToken
  ? { deviceToken: this.deviceToken }
  : { token: this.gatewayToken };

scopes: ['operator.admin'],  // 已配对设备使用更高权限

device: {
  id: this.deviceId,
  publicKey: this.devicePublicKey,
  // 本地连接不需要 signature
},

auth: authParam,
```

#### 修改响应处理：
```typescript
resolve: async (res) => {
  if (res.ok) {
    this.authenticated = true;

    // 从 hello-ok 响应中提取 device token
    const payload = res.payload as { auth?: { deviceToken?: string; expiresAt?: number } };
    if (payload?.auth?.deviceToken) {
      await this.saveDeviceToken(
        payload.auth.deviceToken,
        payload.auth.expiresAt,
      );
    }

    settle();
  } else {
    // ...错误处理
  }
}
```

### 7. 修改 `ensureConnected()` 方法

在连接前确保 device identity 已准备好：
```typescript
private async ensureConnected(): Promise<void> {
  if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) return;
  if (this.connecting) {
    await this.waitForConnection();
    return;
  }
  // 连接前先确保 device identity 已准备好
  await this.ensureDeviceIdentity();
  await this.connect();
}
```

## 工作流程

### 首次连接
1. 调用 `ensureDeviceIdentity()`
2. 生成 Ed25519 keypair
3. 计算 device ID
4. 保存 keypair 到 `~/.openclaw-inbox/device-keypair.json`
5. 使用 gateway token + device identity 连接
6. Gateway 返回 device token
7. 保存 device token 到 `~/.openclaw-inbox/device-token.json`

### 后续连接
1. 加载已存在的 keypair
2. 加载已存在的 device token
3. 使用 device token + device identity 连接（无需 gateway token）
4. 如果 device token 过期，降级使用 gateway token

## 安全措施

1. **文件权限**
   - 配置目录：`0700`（仅所有者可访问）
   - keypair 文件：`0600`（仅所有者可读写）
   - token 文件：`0600`（仅所有者可读写）

2. **Token 过期检查**
   - 加载 device token 时检查 `expiresAt`
   - 过期 token 自动忽略

3. **降级策略**
   - 优先使用 device token
   - device token 不可用时降级到 gateway token

## 测试方法

### 方式 1：运行测试脚本

```bash
cd /Users/celastin/Desktop/claudecode/agent-inbox-channel
node test-device-identity.js
```

测试脚本会验证：
- ✓ 配置目录创建
- ✓ Ed25519 keypair 生成
- ✓ Device ID 计算（SHA256）
- ✓ 文件保存和权限
- ✓ 文件读取和验证
- ✓ Device token 保存

### 方式 2：启动服务器实测

```bash
cd /Users/celastin/Desktop/claudecode/agent-inbox-channel
pnpm dev
```

然后在前端创建一个测试任务，观察：

1. **首次连接时的日志**：
   ```
   [Device Identity] 生成新的 Ed25519 keypair
   [Device Identity] Keypair 已保存到: ~/.openclaw-inbox/device-keypair.json
   [Device Identity] Device ID: [64字符十六进制]
   [Device Identity] 未找到 device token，将使用 gateway token
   [Device Identity] Device token 已保存
   ```

2. **后续连接时的日志**：
   ```
   [Device Identity] 已加载现有 keypair
   [Device Identity] Device ID: [同一个 device ID]
   [Device Identity] 已加载 device token
   ```

3. **检查生成的文件**：
   ```bash
   ls -la ~/.openclaw-inbox/
   cat ~/.openclaw-inbox/device-keypair.json
   cat ~/.openclaw-inbox/device-token.json
   ```

### 方式 3：验证权限错误是否解决

创建一个测试任务并发送消息，确认：
- ✗ 不再出现 "Permission denied" 错误
- ✓ 任务能够正常执行
- ✓ Agent 回复能够正常返回

## 关键设计决策

1. **使用 Ed25519 而非 RSA**：
   - Ed25519 更快、密钥更短（256位）
   - Node.js 原生支持 `generateKeyPairSync('ed25519')`

2. **Device ID 使用 SHA256 十六进制**：
   - 64 字符的十六进制字符串
   - 可读性好，便于日志和调试

3. **本地连接不需要 signature**：
   - `device.signature` 字段留空
   - Gateway 在本地连接时不验证签名（仅验证 device ID）

4. **scopes 升级为 `operator.admin`**：
   - 已配对设备拥有完整权限
   - 匹配 Gateway 的权限模型

5. **优先使用 device token**：
   - 减少对 gateway token 的依赖
   - 支持多设备独立认证

## 验证清单

- [x] 导入必要的 Node.js 内置模块
- [x] 定义 device identity 相关类型
- [x] 添加实例属性存储 device state
- [x] 实现 `ensureDeviceIdentity()` 方法
- [x] 实现 `saveDeviceToken()` 方法
- [x] 修改 `ensureConnected()` 调用 device identity 初始化
- [x] 修改 connect 请求添加 `device` 字段
- [x] 修改 scopes 为 `operator.admin`
- [x] 优先使用 device token 而非 gateway token
- [x] 从 `hello-ok` 响应中提取和保存 device token
- [x] 文件权限设置为 0600
- [x] 添加详细的日志输出
- [x] 创建测试脚本
- [x] 编写完整的实现文档

## 下一步

1. 运行 `pnpm dev` 启动服务器
2. 观察控制台日志，确认 device identity 初始化成功
3. 创建测试任务，验证权限错误已解决
4. 检查 `~/.openclaw-inbox/` 目录下的文件是否正确生成

## 相关文件

- `/Users/celastin/Desktop/claudecode/agent-inbox-channel/packages/server/src/adapters/openclaw-adapter.ts` - 主要实现
- `/Users/celastin/Desktop/claudecode/agent-inbox-channel/test-device-identity.js` - 测试脚本
- `~/.openclaw-inbox/device-keypair.json` - 生成的 keypair（运行后）
- `~/.openclaw-inbox/device-token.json` - 生成的 device token（运行后）
