# PolyTrader

A Polymarket trading bot inspired by the architecture of `feetball/trader`.

## Project Structure

- **`src/`**: The backend bot logic and API server.
    - **`bot.ts`**: The main trading loop.
    - **`clients/polymarket.ts`**: Wrapper for the official `@polymarket/clob-client`.
    - **`index.ts`**: Express server entry point.
- **`src/frontend/`**: Directory for the Next.js dashboard (see `src/frontend/README.md`).

## Prerequisites

- Node.js (v18+)
- A Polygon wallet private key (with some MATIC for gas, though Polymarket uses meta-transactions for many actions, you still need a signer).
- USDC on Polygon for trading.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Copy `.env.example` to `.env` and fill in your details.
   ```bash
   cp .env.example .env
   ```
   
   *Note: `PRIVATE_KEY` is required.*

3. **Build**
   ```bash
   npx tsc
   ```

4. **Run**
   ```bash
   npm start
   ```
   (You need to add `"start": "node dist/index.js"` to package.json scripts first, or run `node dist/index.js` directly).

## Development

To run in development mode with auto-reload:
```bash
npx ts-node src/index.ts
```

## API Endpoints

- `GET /api/status`: Check bot status.
- `POST /api/bot/start`: Start the trading loop.
- `POST /api/bot/stop`: Stop the trading loop.
