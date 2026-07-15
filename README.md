# Algorand Monitor Dashboard

> **Real-time monitoring for Algorand wallets, smart contracts, and assets — right from your browser.**

## Overview

Algorand Monitor Dashboard is a web app for keeping an eye on activity across the Algorand blockchain. From a single tabbed interface you can track transactions on specific wallets, watch smart-contract application calls, inspect assets created or held by an address, and discover which accounts a wallet has recently interacted with. It talks directly to public Algorand nodes and indexers (via AlgoNode) and can switch between **MainNet** and **TestNet** on the fly, so no API keys or backend of your own are required.

## Features

- **Wallet Monitor** — add one or more Algorand addresses and poll for incoming and outgoing transactions in near real time, with live active-monitor counts.
- **Contract Monitor** — watch a smart-contract application by App ID, filter by method signatures, and observe application-call events and transactions at a configurable polling frequency.
- **Asset Monitor** — look up the assets associated with an address and see asset-creation stats broken down by week, month, year, and total, resolved from indexer transaction history.
- **New Account Monitor** — given an address and a time frame (day / week / month / year), list the accounts it has sent payments to.
- **MainNet / TestNet toggle** — switch networks instantly; endpoints are swapped automatically for every monitor.
- **Live dashboard** — summary cards show how many wallet, contract, and asset monitors are currently active.
- **Direct explorer links** and a clean, responsive UI with light/dark support.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (Radix UI primitives), `lucide-react` icons
- **Algorand:** `algosdk` and `@algorandfoundation/algokit-utils` (plus `@algorandfoundation/algokit-subscriber` in the setup helper) against AlgoNode public endpoints
- **Charts & forms:** Recharts, React Hook Form, Zod
- **Tooling:** pnpm, PostCSS

## Getting Started

```bash
# Clone the repository
git clone https://github.com/nickthelegend/algorand-monitor.git
cd algorand-monitor

# Install dependencies (pnpm recommended; npm also works)
pnpm install

# Start the development server
pnpm dev
# → open http://localhost:3000

# Production build
pnpm build
pnpm start
```

No environment variables are needed — the app uses public AlgoNode MainNet/TestNet endpoints out of the box.

## Project Structure

```
algorand-monitor/
├── app/                      # Next.js App Router (layout, page, global styles)
│   ├── layout.tsx
│   ├── page.tsx              # Dashboard shell with the four monitor tabs
│   └── globals.css
├── components/
│   ├── WalletMonitor.tsx     # Wallet transaction monitoring
│   ├── ContractMonitor.tsx   # Smart-contract / app-call monitoring
│   ├── AssetMonitor.tsx      # Asset lookup & creation stats
│   ├── NewAccountMonitor.tsx # Interacted-accounts lookup
│   └── ui/                   # shadcn/ui component library
├── hooks/                    # Reusable React hooks
├── lib/                      # Utilities
├── scripts/
│   └── setup-algorand.js     # Standalone AlgorandSubscriber setup helpers
├── public/                   # Static assets
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

---

Built by [nickthelegend](https://github.com/nickthelegend) · [nickthelegend.tech](https://nickthelegend.tech)
