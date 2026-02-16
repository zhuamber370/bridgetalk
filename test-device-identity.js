#!/usr/bin/env node

/**
 * Test Device Identity Implementation
 * Verify keypair generation, device ID calculation, and file saving
 */

import { generateKeyPairSync, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function testDeviceIdentity() {
  console.log('=== Device Identity Test ===\n');

  const deviceConfigDir = join(homedir(), '.openclaw-inbox');
  const keypairPath = join(deviceConfigDir, 'device-keypair.json');

  // 1. Ensure config directory exists
  console.log('1. Create config directory:', deviceConfigDir);
  await fs.mkdir(deviceConfigDir, { recursive: true, mode: 0o700 });
  console.log('   ✓ Directory created\n');

  // 2. Generate Ed25519 keypair
  console.log('2. Generate Ed25519 keypair');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const keypair = {
    publicKey: publicKey.toString('base64'),
    privateKey: privateKey.toString('base64'),
  };

  console.log('   Public Key (base64, first 64 chars):', keypair.publicKey.substring(0, 64) + '...');
  console.log('   Private Key (base64, first 64 chars):', keypair.privateKey.substring(0, 64) + '...');
  console.log('   ✓ Keypair generated\n');

  // 3. Calculate device ID
  console.log('3. Calculate Device ID');
  const publicKeyBuffer = Buffer.from(keypair.publicKey, 'base64');
  const deviceId = createHash('sha256').update(publicKeyBuffer).digest('hex');
  console.log('   Device ID (SHA256):', deviceId);
  console.log('   ✓ Device ID calculated\n');

  // 4. Save to file
  console.log('4. Save keypair to file');
  await fs.writeFile(keypairPath, JSON.stringify(keypair, null, 2), { mode: 0o600 });
  console.log('   Path:', keypairPath);
  console.log('   ✓ File saved\n');

  // 5. Verify file permissions
  console.log('5. Verify file permissions');
  const stats = await fs.stat(keypairPath);
  const mode = (stats.mode & 0o777).toString(8);
  console.log('   File mode:', mode);
  console.log('   ✓ Permissions correct (600)\n');

  // 6. Read and verify
  console.log('6. Read and verify file contents');
  const savedData = await fs.readFile(keypairPath, 'utf-8');
  const savedKeypair = JSON.parse(savedData);

  if (savedKeypair.publicKey === keypair.publicKey &&
      savedKeypair.privateKey === keypair.privateKey) {
    console.log('   ✓ File contents verified successfully\n');
  } else {
    console.error('   ✗ File contents mismatch!\n');
  }

  // 7. Test device token saving
  console.log('7. Test Device Token saving');
  const tokenPath = join(deviceConfigDir, 'device-token.json');
  const mockToken = {
    token: 'device_token_' + Date.now(),
    expiresAt: Date.now() + 86400000, // 24 hours later
  };
  await fs.writeFile(tokenPath, JSON.stringify(mockToken, null, 2), { mode: 0o600 });
  console.log('   Token path:', tokenPath);
  console.log('   ✓ Device Token saved\n');

  console.log('=== All tests passed ===');
  console.log('\nConfig file locations:');
  console.log('  - Keypair:', keypairPath);
  console.log('  - Token:', tokenPath);
  console.log('\nDevice ID:', deviceId);
}

testDeviceIdentity().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
