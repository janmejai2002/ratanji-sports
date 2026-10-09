# Ratanjee Sports — Digital Sports Management & Scoring System

A full-stack, real-time sports tournament management and digital scoring system built for XLRI Delhi tournaments and multi-sport competitions.

## Architecture

- **Frontend**: React 18, Vite 6, Tailwind CSS, Lucide Icons
- **Backend**: Node.js 22+ (native `node:sqlite` DatabaseSync), Express 4
- **Real-Time Engine**: Embedded dual-transport broadcaster (WebSockets + Server-Sent Events fallback)
- **Database**: SQLite with Write-Ahead Logging (WAL mode), transactional lifecycle management
- **Lifecycle FSM**: `Draft` (in-progress) → `Submitted` (referee concluded) → `Verified` (committee approved) → `Published` (official result & standings)

## Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Run unified dev environment (Server on :3001, Vite on :5173)
npm run dev
```

### Production Build & Serve
```bash
# Build React client into dist/
npm run build

# Start unified production server (serves static client + API + WebSockets)
npm start
```

## Cloud Deployment

This repository is pre-configured for 1-click zero-downtime deployment on **Render**, **Koyeb**, **Fly.io**, or any Docker container host:

- `render.yaml`: Render Blueprint specification
- `Dockerfile`: Production multi-layer Alpine container image
- Built-in static file serving and dynamic `$PORT` detection
