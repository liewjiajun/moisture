import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Rate limiting - prevent abuse
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Load or generate Oracle keypair
let oracleKeypair;

function loadKeypair() {
  const keypairPath = process.env.KEYPAIR_PATH || path.join(__dirname, '../.keypair.json');

  if (fs.existsSync(keypairPath)) {
    try {
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
      oracleKeypair = Ed25519Keypair.fromSecretKey(fromBase64(keypairData.secretKey));
      console.log('Loaded existing keypair');
      console.log('Oracle Public Key:', toBase64(oracleKeypair.getPublicKey().toRawBytes()));
    } catch (error) {
      console.error('Failed to load keypair:', error);
      process.exit(1);
    }
  } else {
    console.error('No keypair found! Run "npm run generate-keypair" first.');
    console.error('Expected path:', keypairPath);
    process.exit(1);
  }
}

// Create score message matching the Move contract format
function createScoreMessage(playerAddress, roundId, survivalTime) {
  // Remove 0x prefix and convert to bytes (32 bytes for Sui address)
  const addressBytes = new Uint8Array(32);
  const cleanAddress = playerAddress.replace('0x', '').padStart(64, '0');
  for (let i = 0; i < 32; i++) {
    addressBytes[i] = parseInt(cleanAddress.substr(i * 2, 2), 16) || 0;
  }

  // Convert roundId to 8 bytes (little endian)
  const roundBytes = new Uint8Array(8);
  let tempRound = BigInt(roundId);
  for (let i = 0; i < 8; i++) {
    roundBytes[i] = Number(tempRound & BigInt(0xff));
    tempRound = tempRound >> BigInt(8);
  }

  // Convert survivalTime to 8 bytes (little endian)
  const timeBytes = new Uint8Array(8);
  let tempTime = BigInt(survivalTime);
  for (let i = 0; i < 8; i++) {
    timeBytes[i] = Number(tempTime & BigInt(0xff));
    tempTime = tempTime >> BigInt(8);
  }

  // Concatenate all bytes (32 + 8 + 8 = 48 bytes total)
  const message = new Uint8Array(48);
  message.set(addressBytes, 0);
  message.set(roundBytes, 32);
  message.set(timeBytes, 40);

  return message;
}

// Validate replay data (basic anti-cheat)
function validateReplay(replayData) {
  const { playerId, roundId, survivalTime, events, checksum } = replayData;

  // Basic validation
  if (!playerId || typeof playerId !== 'string' || !playerId.startsWith('0x')) {
    return { valid: false, error: 'Invalid player address' };
  }

  if (typeof roundId !== 'number' || roundId <= 0) {
    return { valid: false, error: 'Invalid round ID' };
  }

  if (typeof survivalTime !== 'number' || survivalTime <= 0) {
    return { valid: false, error: 'Invalid survival time' };
  }

  // Sanity check: survival time shouldn't be unrealistically long (e.g., > 1 hour)
  if (survivalTime > 3600000) {
    return { valid: false, error: 'Survival time exceeds maximum allowed' };
  }

  // Validate events if provided
  if (events && Array.isArray(events)) {
    // Check for death event
    const hasDeathEvent = events.some(e => e.type === 'death');
    if (!hasDeathEvent) {
      return { valid: false, error: 'Missing death event' };
    }

    // Check timestamp sequence
    let lastTime = 0;
    for (const event of events) {
      if (event.timestamp < lastTime) {
        return { valid: false, error: 'Invalid event timestamp sequence' };
      }
      lastTime = event.timestamp;
    }

    // Check if survival time roughly matches death event
    const deathEvent = events.find(e => e.type === 'death');
    if (deathEvent) {
      const timeDiff = Math.abs(deathEvent.timestamp - survivalTime);
      if (timeDiff > 2000) { // Allow 2 second tolerance
        return { valid: false, error: 'Survival time mismatch with death event' };
      }
    }
  }

  // TODO: Add more sophisticated anti-cheat:
  // - Verify checksum matches game state
  // - Check for impossible movement patterns
  // - Verify bullet positions and collisions
  // - Cross-reference with server-side game state

  return { valid: true };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    publicKey: toBase64(oracleKeypair.getPublicKey().toRawBytes()),
  });
});

// Get oracle public key (for contract initialization)
app.get('/api/public-key', (req, res) => {
  const publicKey = oracleKeypair.getPublicKey().toRawBytes();
  res.json({
    publicKey: toBase64(publicKey),
    publicKeyHex: '0x' + Buffer.from(publicKey).toString('hex'),
    publicKeyBytes: Array.from(publicKey),
  });
});

// Verify and sign score
app.post('/api/verify-score', async (req, res) => {
  try {
    const { playerId, roundId, survivalTime, events, checksum } = req.body;

    // Validate replay data
    const validation = validateReplay({ playerId, roundId, survivalTime, events, checksum });
    if (!validation.valid) {
      return res.status(400).json({
        valid: false,
        error: validation.error
      });
    }

    // Create message and sign
    const message = createScoreMessage(playerId, roundId, survivalTime);
    const signature = await oracleKeypair.sign(message);

    // Log for auditing (in production, store this in a database)
    console.log(`Score verified: player=${playerId.slice(0, 10)}..., round=${roundId}, time=${survivalTime}ms`);

    res.json({
      valid: true,
      signature: Array.from(signature),
      signatureBase64: toBase64(signature),
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      valid: false,
      error: 'Internal server error'
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
loadKeypair();
app.listen(PORT, () => {
  console.log(`Oracle server running on port ${PORT}`);
  console.log(`Public key: ${toBase64(oracleKeypair.getPublicKey().toRawBytes())}`);
});
