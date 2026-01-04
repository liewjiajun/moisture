/**
 * Generate a new Ed25519 keypair for the Oracle server
 *
 * IMPORTANT: Keep the generated .keypair.json file secure!
 * - Never commit it to version control
 * - Back it up securely
 * - The same keypair must be used for the smart contract
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toBase64 } from '@mysten/sui/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keypairPath = path.join(__dirname, '../.keypair.json');

// Check if keypair already exists
if (fs.existsSync(keypairPath)) {
  console.log('Keypair already exists at:', keypairPath);
  console.log('Delete it first if you want to generate a new one.');

  // Show existing public key
  const existing = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  console.log('\nExisting Public Key (Base64):', existing.publicKey);
  console.log('Existing Public Key (Hex):', existing.publicKeyHex);
  process.exit(1);
}

// Generate new keypair
console.log('Generating new Ed25519 keypair...\n');

const keypair = Ed25519Keypair.generate();
const publicKey = keypair.getPublicKey().toRawBytes();
const secretKey = keypair.getSecretKey();

// Save keypair
const keypairData = {
  publicKey: toBase64(publicKey),
  publicKeyHex: '0x' + Buffer.from(publicKey).toString('hex'),
  publicKeyBytes: Array.from(publicKey),
  secretKey: toBase64(secretKey),
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(keypairPath, JSON.stringify(keypairData, null, 2));

console.log('Keypair generated successfully!');
console.log('Saved to:', keypairPath);
console.log('\n--- PUBLIC KEY (use this for smart contract) ---');
console.log('Base64:', keypairData.publicKey);
console.log('Hex:', keypairData.publicKeyHex);
console.log('Bytes:', JSON.stringify(keypairData.publicKeyBytes));
console.log('\n--- IMPORTANT ---');
console.log('1. Keep .keypair.json secure and NEVER commit it to git');
console.log('2. Use the public key bytes when calling create_pool()');
console.log('3. Back up this file - losing it means you cannot verify scores');
