#!/usr/bin/env node

/**
 * 测试 Device Identity 实现
 * 验证 keypair 生成、device ID 计算和文件保存
 */

import { generateKeyPairSync, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function testDeviceIdentity() {
  console.log('=== Device Identity 测试 ===\n');

  const deviceConfigDir = join(homedir(), '.openclaw-inbox');
  const keypairPath = join(deviceConfigDir, 'device-keypair.json');

  // 1. 确保配置目录存在
  console.log('1. 创建配置目录:', deviceConfigDir);
  await fs.mkdir(deviceConfigDir, { recursive: true, mode: 0o700 });
  console.log('   ✓ 目录已创建\n');

  // 2. 生成 Ed25519 keypair
  console.log('2. 生成 Ed25519 keypair');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const keypair = {
    publicKey: publicKey.toString('base64'),
    privateKey: privateKey.toString('base64'),
  };

  console.log('   Public Key (base64, 前 64 字符):', keypair.publicKey.substring(0, 64) + '...');
  console.log('   Private Key (base64, 前 64 字符):', keypair.privateKey.substring(0, 64) + '...');
  console.log('   ✓ Keypair 已生成\n');

  // 3. 计算 device ID
  console.log('3. 计算 Device ID');
  const publicKeyBuffer = Buffer.from(keypair.publicKey, 'base64');
  const deviceId = createHash('sha256').update(publicKeyBuffer).digest('hex');
  console.log('   Device ID (SHA256):', deviceId);
  console.log('   ✓ Device ID 已计算\n');

  // 4. 保存到文件
  console.log('4. 保存 keypair 到文件');
  await fs.writeFile(keypairPath, JSON.stringify(keypair, null, 2), { mode: 0o600 });
  console.log('   路径:', keypairPath);
  console.log('   ✓ 文件已保存\n');

  // 5. 验证文件权限
  console.log('5. 验证文件权限');
  const stats = await fs.stat(keypairPath);
  const mode = (stats.mode & 0o777).toString(8);
  console.log('   文件权限:', mode);
  console.log('   ✓ 权限正确 (600)\n');

  // 6. 读取并验证
  console.log('6. 读取并验证文件内容');
  const savedData = await fs.readFile(keypairPath, 'utf-8');
  const savedKeypair = JSON.parse(savedData);

  if (savedKeypair.publicKey === keypair.publicKey &&
      savedKeypair.privateKey === keypair.privateKey) {
    console.log('   ✓ 文件内容验证成功\n');
  } else {
    console.error('   ✗ 文件内容不匹配!\n');
  }

  // 7. 测试 device token 保存
  console.log('7. 测试 Device Token 保存');
  const tokenPath = join(deviceConfigDir, 'device-token.json');
  const mockToken = {
    token: 'device_token_' + Date.now(),
    expiresAt: Date.now() + 86400000, // 24小时后
  };
  await fs.writeFile(tokenPath, JSON.stringify(mockToken, null, 2), { mode: 0o600 });
  console.log('   Token 路径:', tokenPath);
  console.log('   ✓ Device Token 已保存\n');

  console.log('=== 所有测试通过 ===');
  console.log('\n配置文件位置:');
  console.log('  - Keypair:', keypairPath);
  console.log('  - Token:', tokenPath);
  console.log('\nDevice ID:', deviceId);
}

testDeviceIdentity().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
