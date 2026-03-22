# Gold Fib Signals 🥇📊

A real-time trading signal application for Gold (XAU/USD) based on **Fibonacci retracement** analysis. The app monitors gold prices, identifies key Fibonacci levels, and generates buy/sell signals with **plain-language explanations**.

## Features

- 📈 **Real-time gold price tracking** (XAU/USD via Yahoo Finance API - FREE)
- 🔢 **Automatic Fibonacci level calculation** from price swings
- 🟢🔴 **Buy/Sell signal generation** based on Fibonacci confluence
- 🌍 **Macro factor integration** - Fed policy, DXY, Treasury yields
- 📊 **Macro regime classification** - Hawkish/dovish Fed, recession risk, etc.
- 🎯 **Signal strength adjustment** based on macro alignment
- 💬 **Plain-language explanations** for every signal with macro context
- 📊 **Interactive price chart** with Fibonacci overlays
- 🎯 **Signal strength indicators** (Strong/Moderate/Weak)
- 🏦 **Gold Products comparison** (Spot, Futures, ETFs, CFDs, Options)
- 💾 **SQLite persistence** for signals and price history
- 🐳 **Docker support** for easy deployment

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
├─────────────────────┬───────────────────────────────────┤
│     Frontend        │           Backend                  │
│  (React + Nginx)    │    (Node.js + Express)            │
│     Port 8080       │        Port 3001                  │
│                     │                                    │
│  ┌───────────────┐  │  ┌─────────────────────────────┐  │
│  │  React App    │  │  │  Express API Server         │  │
│  │  - Charts     │◄─┼──┤  - /api/price/current       │  │
│  │  - Signals    │  │  │  - /api/price/history       │  │
│  │  - Products   │  │  │  - /api/signals             │  │
│  └───────────────┘  │  └──────────┬──────────────────┘  │
│                     │             │                      │
│                     │  ┌──────────▼──────────────────┐  │
│                     │  │  SQLite Database            │  │
│                     │  │  - Price history (3 years)  │  │
│                     │  │  - Trading signals          │  │
│                     │  │  - Price snapshots          │  │
│                     │  └─────────────────────────────┘  │
└─────────────────────┴───────────────────────────────────┘
                              │
                              ▼
                    Yahoo Finance API (FREE)
                    - Real-time prices
                    - Historical OHLCV data
```

## Quick Start with Docker 🐳

```bash
# Clone the repository
git clone https://github.com/aidevbda-glitch/gold-fib-signals.git
cd gold-fib-signals

# Build and run with Docker Compose
docker compose up -d

# View logs
docker compose logs -f

# Access the app
open http://localhost:8080
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 8080 | React app served by Nginx |
| Backend | 3001 | Node.js API with SQLite |

### Data Persistence

SQLite database is stored in a Docker volume (`gold-data`). Data persists across container restarts.

## Development Setup

### Prerequisites
- Node.js 20+
- npm or yarn

### Frontend Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Start dev server (with auto-reload)
npm run dev

# Or start production server
npm start
```

### Environment Variables

Create `.env` in the root directory:

```env
# API URL (for frontend)
VITE_API_URL=http://localhost:3001/api

# Backend port
PORT=3001
```

## API Endpoints

### Price Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/price/current` | GET | Current gold price |
| `/api/price/history?range=1y&interval=1d` | GET | Historical OHLCV data |
| `/api/price/cached?days=365` | GET | Cached history from DB |

**Range options:** `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `3y`, `max`
**Interval options:** `1m`, `5m`, `15m`, `1h`, `1d`, `1wk`, `1mo`

### Signal Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signals` | GET | Get signals (paginated) |
| `/api/signals` | POST | Save a new signal |
| `/api/signals/latest` | GET | Get most recent signal |
| `/api/signals/stats` | GET | Get signal statistics |
| `/api/signals/range?start=&end=` | GET | Signals by date range |

## Data Sources

### Yahoo Finance (FREE - No API Key Required)
- **Symbol:** `GC=F` (Gold Futures COMEX)
- **Real-time:** Updates every few seconds during market hours
- **Historical:** Up to 20 years of daily data
- **No cost, no rate limits** (reasonable usage)

## Gold Product Types

The app includes a separate screen comparing different ways to trade gold:

| Product | Risk | Best For |
|---------|------|----------|
| **Spot (XAU/USD)** | Medium | Day/swing traders |
| **Futures (GC)** | High | Experienced traders, hedgers |
| **Physical ETFs** | Low | Long-term investors |
| **Miners ETFs** | High | Growth investors |
| **CFDs** | Very High | Short-term speculators |
| **Options** | High | Options traders, hedgers |

Each product type lists recommended brokers with ratings, fees, and pros/cons.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Zustand, Recharts, Tailwind CSS
- **Backend:** Node.js, Express, better-sqlite3
- **Infrastructure:** Docker, Nginx
- **Data:** Yahoo Finance API (free)

## Project Structure

```
gold-fib-signals/
├── src/                      # Frontend source
│   ├── components/           # React components
│   ├── services/             # API services
│   ├── hooks/                # Custom hooks (Zustand store)
│   ├── types/                # TypeScript types
│   ├── pages/                # Page components
│   └── data/                 # Static data (products, brokers)
├── backend/                  # Backend source
│   ├── src/
│   │   ├── index.js          # Express server
│   │   ├── database.js       # SQLite setup
│   │   ├── goldPriceService.js
│   │   └── signalService.js
│   └── data/                 # SQLite database files
├── docker-compose.yml        # Docker orchestration
├── Dockerfile                # Frontend container
├── nginx.conf                # Nginx configuration
└── backend/Dockerfile        # Backend container
```

## Disclaimer

⚠️ **This is for educational purposes only. Not financial advice.**

Trading gold and other financial instruments involves significant risk. Always do your own research and consider consulting a financial advisor.

## License

MIT License - feel free to use and modify.
