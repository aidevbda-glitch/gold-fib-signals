# Gold Fib Signals 🥇📊

A real-time trading signal application for Gold (XAU/USD) based on **Fibonacci retracement** analysis. The app monitors gold prices, identifies key Fibonacci levels, and generates buy/sell signals with **plain-language explanations**.

![Gold Fib Signals Screenshot](screenshot.png)

## Features

- 📈 **Real-time gold price tracking** (XAU/USD)
- 🔢 **Automatic Fibonacci level calculation** from price swings
- 🟢🔴 **Buy/Sell signal generation** based on Fibonacci confluence
- 💬 **Plain-language explanations** for every signal
- 📊 **Interactive price chart** with Fibonacci overlays
- 🎯 **Signal strength indicators** (Strong/Moderate/Weak)

## How It Works

### Fibonacci Retracement Levels

The app calculates these key retracement levels from recent price swings:

| Level | Significance |
|-------|-------------|
| **23.6%** | Minor retracement |
| **38.2%** | Shallow retracement (strong trend) |
| **50%** | Psychological midpoint |
| **61.8%** | Golden ratio - KEY level |
| **78.6%** | Deep retracement |

### Signal Logic

**BUY Signals** are generated when:
- Price retraces to a key Fibonacci support level (38.2%, 50%, 61.8%)
- Trend context is bullish
- Price action shows signs of reversal

**SELL Signals** are generated when:
- Price retraces to a key Fibonacci resistance level
- Trend context is bearish
- Price action shows signs of reversal

Each signal includes a detailed explanation of **why** it was generated.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gold-fib-signals.git
cd gold-fib-signals

# Install dependencies
npm install

# Start development server
npm run dev
```

### API Configuration (Optional)

For real gold price data, set up API keys in `.env`:

```env
# GoldAPI.io (500 requests/month free)
VITE_GOLDAPI_KEY=your_api_key_here

# OR MetalpriceAPI (100 requests/month free)
VITE_METALPRICEAPI_KEY=your_api_key_here
```

Without API keys, the app uses realistic mock data for demonstration.

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Build tool
- **Zustand** - State management
- **Recharts** - Charting
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Project Structure

```
src/
├── components/
│   ├── PriceDisplay.tsx      # Current gold price card
│   ├── PriceChart.tsx        # Price chart with Fib levels
│   ├── FibonacciLevels.tsx   # Fib level display
│   ├── SignalCard.tsx        # Individual signal card
│   └── SignalsList.tsx       # Signals feed
├── services/
│   ├── FibonacciService.ts   # Fib calculation logic
│   ├── SignalService.ts      # Signal generation + explanations
│   └── GoldPriceService.ts   # Price data fetching
├── hooks/
│   └── useStore.ts           # Zustand store
├── types/
│   └── trading.ts            # TypeScript types
└── App.tsx                   # Main app component
```

## Signal Explanation Example

When a BUY signal is generated, you'll see something like:

> 🟢 **BUY SIGNAL (STRONG)**
> 
> Gold is currently trading at $2,645.30, which is very close to the 61.8% Fibonacci retracement level at $2,644.50.
> 
> The overall trend has been bullish, with a recent swing from $2,580.00 to $2,750.00.
> 
> **📊 Why Buy Here?**
> In an uptrend, the 61.8% level (golden ratio) is the most significant Fibonacci level. Price holding here strongly suggests the uptrend will resume. We're also seeing early signs of a bullish reversal in recent price action.
> 
> **⚠️ Risk Note:** Signal strength is strong. Multiple factors align for high confidence.

## Disclaimer

⚠️ **This is for educational purposes only. Not financial advice.**

Trading gold and other financial instruments involves significant risk. Always do your own research and consider consulting a financial advisor.

## License

MIT License - feel free to use and modify.
