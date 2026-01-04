# Deployment Guide

This guide walks through deploying the Moisture bullet hell dApp to production.

## Prerequisites

- Node.js 18+
- Sui CLI installed (`cargo install --locked --git https://github.com/MystenLabs/sui.git --branch main sui`)
- A Sui wallet with SUI tokens for deployment
- Firebase account (for chat and leaderboard)
- Domain name (optional, for production)

## 1. Deploy Smart Contract

### Setup Sui Wallet

```bash
# Create a new wallet (if needed)
sui client new-address ed25519

# Get your address
sui client active-address

# Request testnet tokens (if on testnet)
sui client faucet
```

### Build and Deploy

```bash
cd contracts/moisture

# Build the contract
sui move build

# Deploy to testnet
sui client publish --gas-budget 100000000

# Note the Package ID from the output
# Example: Published Objects: package 0x1234...
```

### Initialize Game Pool

After deploying, you need to create the game pool. Use the Sui CLI:

```bash
# First, generate the oracle keypair
cd oracle-server
npm install
npm run generate-keypair

# Note the public key bytes from the output
# Example: Bytes: [1, 2, 3, ...]

# Create the pool (replace values with your actual IDs)
sui client call \
  --package <PACKAGE_ID> \
  --module game_core \
  --function create_pool \
  --args <ADMIN_CAP_ID> <COIN_ID> "[<PUBLIC_KEY_BYTES>]" 0x6 \
  --gas-budget 100000000

# Note the created GamePool and OracleCap object IDs from the output
```

## 2. Setup Oracle Server

### Configuration

```bash
cd oracle-server

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your settings
# - PORT: Server port (default 3001)
# - ALLOWED_ORIGINS: Frontend URLs
```

### Generate Keypair (if not done above)

```bash
npm run generate-keypair

# IMPORTANT: Back up .keypair.json securely
# The public key must match what was used in create_pool()
```

### Run Server

```bash
# Development
npm run dev

# Production
npm start
```

### Deploy to Production

For production, deploy the oracle server to a secure server:

1. **Cloud Provider Options**:
   - Railway.app (easy Node.js deployment)
   - Fly.io
   - AWS EC2/ECS
   - Google Cloud Run
   - DigitalOcean App Platform

2. **Security Considerations**:
   - Store `.keypair.json` as a secure environment variable
   - Use HTTPS (required for production)
   - Set `ALLOWED_ORIGINS` to only your frontend domain
   - Enable rate limiting (already included)

Example Railway deployment:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard
# Upload keypair content as KEYPAIR_JSON env var
```

## 3. Setup Firebase

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project (or use existing)
3. Enable **Realtime Database** (Build > Realtime Database)
4. Choose region closest to your users
5. Start in **test mode** (update rules later)

### Configure Database Rules

In Firebase Console > Realtime Database > Rules:

```json
{
  "rules": {
    "chat": {
      "messages": {
        ".read": true,
        ".write": true,
        ".indexOn": ["timestamp"]
      }
    },
    "leaderboard": {
      "scores": {
        ".read": true,
        ".write": true,
        ".indexOn": ["survivalTime", "timestamp"]
      }
    }
  }
}
```

**For production**, restrict writes:
```json
{
  "rules": {
    "chat": {
      "messages": {
        ".read": true,
        ".write": "newData.child('sender').val().length <= 66 && newData.child('message').val().length <= 200"
      }
    },
    "leaderboard": {
      "scores": {
        ".read": true,
        ".write": "newData.child('survivalTime').val() <= 3600000"
      }
    }
  }
}
```

### Get Firebase Config

1. Project Settings > General > Your apps
2. Click Web app icon (</>) to create web app
3. Copy the config values

## 4. Deploy Frontend

### Configuration

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit `.env` with your values:
```env
# Sui Contract (from step 1)
VITE_PACKAGE_ID=0x...
VITE_GAME_POOL_ID=0x...
VITE_ORACLE_CAP_ID=0x...

# Oracle Server URL
VITE_ORACLE_URL=https://your-oracle-server.com

# Firebase (from step 3)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Build and Deploy

```bash
# Build for production
npm run build

# Preview locally
npm run preview
```

### Deploy to Hosting

**Vercel** (recommended):
```bash
npm install -g vercel
vercel
```

**Netlify**:
```bash
npm install -g netlify-cli
netlify deploy --prod
```

**GitHub Pages**:
- Push to GitHub
- Enable Pages in repository settings
- Set build command: `npm run build`
- Set publish directory: `dist`

## 5. Build Love2D Game for Web

The Love2D game needs to be compiled to JavaScript using love.js:

### Option 1: Pre-built love.js

1. Download love.js from [GitHub](https://github.com/Davidobot/love.js)
2. Package your game:
```bash
cd game
zip -r game.love .
```
3. Follow love.js instructions to create web build

### Option 2: Native App

For desktop/mobile, distribute the `.love` file or create platform-specific builds using:
- **macOS**: `love-release` or manual packaging
- **Windows**: `love-release` or NSIS installer
- **Linux**: AppImage or native package
- **iOS/Android**: Use LÖVE-Potion or native ports

## Environment Variables Summary

### Frontend (.env)
```env
VITE_PACKAGE_ID=0x...        # Sui package address
VITE_GAME_POOL_ID=0x...      # GamePool object ID
VITE_ORACLE_CAP_ID=0x...     # OracleCap object ID
VITE_ORACLE_URL=https://...  # Oracle server URL
VITE_FIREBASE_API_KEY=...    # Firebase config
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Oracle Server (.env)
```env
PORT=3001
ALLOWED_ORIGINS=https://yourdomain.com
KEYPAIR_PATH=./.keypair.json  # Or use KEYPAIR_JSON for cloud
```

## Testing

### Local Development

1. Start oracle server: `cd oracle-server && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Run game: `love game/`

### Testnet Testing

1. Deploy contract to Sui testnet
2. Get testnet SUI from faucet
3. Test full flow: connect wallet → enter game → play → submit score

## Troubleshooting

### "Invalid signature" error
- Ensure oracle keypair matches the public key used in `create_pool()`
- Check that message format matches between oracle server and contract

### "Round ended" error
- Rounds last 1 hour by default
- Call `distribute_rewards()` and start new round if needed

### Firebase permission denied
- Check database rules allow read/write
- Verify Firebase config in .env

### Wallet won't connect
- Ensure you're on the correct network (testnet/mainnet)
- Clear wallet cache and retry

## Security Checklist

- [ ] Oracle keypair stored securely (not in git)
- [ ] HTTPS enabled for oracle server and frontend
- [ ] Firebase rules restrict malicious writes
- [ ] Rate limiting enabled on oracle server
- [ ] Contract AdminCap stored securely
- [ ] Environment variables not exposed in client bundle
