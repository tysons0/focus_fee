# Focus-Fee (Hackathon)

Electron + React desktop focus tracker with a Vercel API that settles using Solana.

## 1) Install

From repo root:

```bash
npm install
cd desktop && npm install
```

## 2) Configure env

### Root (Vercel API)

Copy `.env.example` to `.env` in repo root and fill in:

- `SOLANA_RPC_URL` – Solana RPC (e.g. `https://api.devnet.solana.com`)
- `SOL_TREASURY_SECRET` – full JSON array for a devnet wallet secret key
- `MOCK_SOL_PRICE_USD` – optional, default `100`

### Desktop app

Copy `desktop/.env.example` to `desktop/.env`:

- **Local dev**: `VITE_BACKEND_URL=http://localhost:3000`
- **Production**: `VITE_BACKEND_URL=https://focusfee.vercel.app` (or your Vercel URL)

## 3) Run locally (desktop app)

From the project root, run:

```bash
npm run dev
```

This now starts:

- API server (port 3000)
- Electron desktop app (with Vite dev server)

If you want browser-only mode instead, run:

```bash
npm run dev:browser
```

Then open **http://localhost:5173** in your browser.

**Alternative (two terminals):** Run `npm run dev:api` in one terminal, then `npm run dev:web` in another. Open http://localhost:5173.

If port 3000 is in use: `$env:PORT=3001; npm run dev` and the app will proxy to 3001.

**Terminal 2 – Desktop app**:

```bash
npm run dev:desktop
```

Ensure `desktop/.env` has `VITE_BACKEND_URL=http://localhost:3000` for local API.

## 4) Deploy to Vercel

When ready to deploy the API:

```bash
npm run deploy
```

Or `vercel` for preview, `vercel --prod` for production.

Set env vars in Vercel dashboard (Settings → Environment Variables): `SOLANA_RPC_URL`, `SOL_TREASURY_SECRET`, `MOCK_SOL_PRICE_USD`.

Then update `desktop/.env` to use your Vercel URL for production builds.

## 5) Build desktop app

From repo root:

```bash
npm run build:desktop
```

## 6) API route

Settlement endpoint is:

`POST /api/invest`

Body:

```json
{
	"usdCents": 125,
	"toAddress": "<solana-public-key>"
}
```
