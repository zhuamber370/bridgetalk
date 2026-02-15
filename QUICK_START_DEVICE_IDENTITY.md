# Device Identity - 快速开始指南

## 功能概述

已为 OpenClaw Gateway 添加完整的 device identity 支持，解决权限错误问题。

## 自动工作流程

### 首次连接时
```
启动服务器
  ↓
自动生成 Ed25519 keypair
  ↓
保存到 ~/.openclaw-inbox/device-keypair.json
  ↓
计算 Device ID (SHA256 hex)
  ↓
使用 gateway token + device identity 连接
  ↓
Gateway 返回 device token
  ↓
保存到 ~/.openclaw-inbox/device-token.json
  ↓
✅ 连接成功
```

### 后续连接时
```
启动服务器
  ↓
加载已有的 keypair 和 token
  ↓
使用 device token + device identity 连接
  ↓
✅ 连接成功
```

## 快速测试

### 1. 测试 Device Identity 基础功能

```bash
cd /Users/celastin/Desktop/claudecode/agent-inbox-channel
node test-device-identity.js
```

**预期输出：**
```
=== Device Identity 测试 ===

1. 创建配置目录: /Users/celastin/.openclaw-inbox
   ✓ 目录已创建

2. 生成 Ed25519 keypair
   Public Key (base64, 前 64 字符): MCowBQYDK2VwAyEA...
   Private Key (base64, 前 64 字符): MC4CAQAwBQYDK2Vw...
   ✓ Keypair 已生成

3. 计算 Device ID
   Device ID (SHA256): a1b2c3d4e5f6...（64字符）
   ✓ Device ID 已计算

4. 保存 keypair 到文件
   路径: /Users/celastin/.openclaw-inbox/device-keypair.json
   ✓ 文件已保存

5. 验证文件权限
   文件权限: 600
   ✓ 权限正确 (600)

6. 读取并验证文件内容
   ✓ 文件内容验证成功

7. 测试 Device Token 保存
   Token 路径: /Users/celastin/.openclaw-inbox/device-token.json
   ✓ Device Token 已保存

=== 所有测试通过 ===

配置文件位置:
  - Keypair: /Users/celastin/.openclaw-inbox/device-keypair.json
  - Token: /Users/celastin/.openclaw-inbox/device-token.json

Device ID: a1b2c3d4e5f6...
```

### 2. 启动服务器实测

```bash
cd /Users/celastin/Desktop/claudecode/agent-inbox-channel
pnpm dev
```

**观察控制台日志：**

首次连接：
```
[Device Identity] 生成新的 Ed25519 keypair
[Device Identity] Keypair 已保存到: /Users/celastin/.openclaw-inbox/device-keypair.json
[Device Identity] Device ID: a1b2c3d4e5f6...
[Device Identity] 未找到 device token，将使用 gateway token
[Device Identity] Device token 已保存
```

后续连接：
```
[Device Identity] 已加载现有 keypair
[Device Identity] Device ID: a1b2c3d4e5f6...
[Device Identity] 已加载 device token
```

### 3. 检查生成的文件

```bash
# 查看配置目录
ls -la ~/.openclaw-inbox/

# 查看 keypair（不要泄露！）
cat ~/.openclaw-inbox/device-keypair.json

# 查看 device token
cat ~/.openclaw-inbox/device-token.json
```

**预期文件结构：**

`~/.openclaw-inbox/device-keypair.json`:
```json
{
  "publicKey": "MCowBQYDK2VwAyEA...",
  "privateKey": "MC4CAQAwBQYDK2Vw..."
}
```

`~/.openclaw-inbox/device-token.json`:
```json
{
  "token": "device_token_1739635200000",
  "expiresAt": 1739721600000
}
```

### 4. 验证权限问题已解决

1. 打开浏览器访问 `http://localhost:5173`
2. 选择一个 Agent
3. 创建测试任务：输入 "测试 device identity"
4. 发送消息

**预期结果：**
- ✅ 任务正常创建
- ✅ Agent 正常回复
- ❌ 不再出现 "Permission denied" 错误

## 常见问题

### Q1: 如果看到 "Permission denied" 错误？

**可能原因：**
- Device identity 初始化失败
- Gateway token 无效
- Device token 过期

**解决方法：**
```bash
# 删除旧的 device identity
rm -rf ~/.openclaw-inbox/

# 重启服务器（会自动重新生成）
pnpm dev
```

### Q2: 如何查看 device ID？

**方法 1：查看日志**
```bash
pnpm dev | grep "Device ID"
```

**方法 2：计算现有 keypair 的 device ID**
```bash
node -e "
const crypto = require('crypto');
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.env.HOME + '/.openclaw-inbox/device-keypair.json', 'utf-8'));
const publicKey = Buffer.from(data.publicKey, 'base64');
console.log(crypto.createHash('sha256').update(publicKey).digest('hex'));
"
```

### Q3: 多台机器如何同步 device identity？

**手动同步：**
```bash
# 在机器 A 上打包
cd ~/.openclaw-inbox
tar czf device-identity.tar.gz device-keypair.json device-token.json

# 传输到机器 B
scp device-identity.tar.gz user@machine-b:~/

# 在机器 B 上解压
mkdir -p ~/.openclaw-inbox
tar xzf ~/device-identity.tar.gz -C ~/.openclaw-inbox/
chmod 700 ~/.openclaw-inbox
chmod 600 ~/.openclaw-inbox/*
```

**注意：** 每台机器应该使用独立的 device identity，只有需要共享设备配对状态时才同步。

### Q4: 如何重置 device identity？

```bash
# 删除所有 device identity 相关文件
rm -rf ~/.openclaw-inbox/

# 重启服务器（会自动重新生成）
pnpm dev
```

## 安全提醒

1. **私钥保护**
   - ⚠️ 永远不要分享 `device-keypair.json` 中的 privateKey
   - ✅ 文件权限已自动设置为 0600（仅所有者可读写）
   - ✅ 配置目录权限已设置为 0700（仅所有者可访问）

2. **Token 安全**
   - device token 类似于访问令牌，不应泄露
   - token 会在过期后自动更新
   - 如果 token 泄露，删除 `~/.openclaw-inbox/device-token.json` 并重启

3. **备份建议**
   - 定期备份 `~/.openclaw-inbox/` 目录
   - 备份文件应加密存储
   - 不要将 keypair 提交到 git 仓库

## 技术细节

### Device ID 计算方法
```javascript
const publicKeyBuffer = Buffer.from(publicKey_base64, 'base64');
const deviceId = crypto.createHash('sha256').update(publicKeyBuffer).digest('hex');
// 结果：64字符的十六进制字符串
```

### Connect 请求结构
```typescript
{
  method: 'connect',
  params: {
    scopes: ['operator.admin'],  // 已配对设备权限
    device: {
      id: deviceId,               // SHA256(publicKey)
      publicKey: publicKey_base64 // Ed25519 public key
    },
    auth: {
      deviceToken: "..." // 优先使用 device token
      // 或
      token: "..."       // 降级使用 gateway token
    }
  }
}
```

### 文件权限
```
~/.openclaw-inbox/               (drwx------)  0700
  ├── device-keypair.json        (-rw-------)  0600
  └── device-token.json          (-rw-------)  0600
```

## 相关文件

- **实现代码**: `packages/server/src/adapters/openclaw-adapter.ts`
- **测试脚本**: `test-device-identity.js`
- **详细文档**: `DEVICE_IDENTITY_IMPLEMENTATION.md`
- **实现总结**: `DEVICE_IDENTITY_SUMMARY.md`

## 下一步

✅ Device identity 已完全实现并可以使用

**建议操作：**
1. 运行测试脚本验证基础功能
2. 启动服务器并创建测试任务
3. 观察日志确认 device identity 正常工作
4. 验证权限错误已解决

**如有问题：**
- 检查 `~/.openclaw-inbox/` 目录和文件权限
- 查看服务器日志中的 `[Device Identity]` 消息
- 确认 `OPENCLAW_GATEWAY_URL` 和 `OPENCLAW_GATEWAY_TOKEN` 环境变量正确设置
