# Focus-Fee (Hackathon)

Electron + React desktop focus tracker with a Vercel API that settles using Solana.

## 1) Install

From repo root:

```bash
npm install
npm --prefix desktop install
```

## 2) Configure env

### Root (Vercel API)

Create `.env` in repo root:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOL_TREASURY_SECRET=[1,2,3,...]
MOCK_SOL_PRICE_USD=100
```

Notes:
- `SOL_TREASURY_SECRET` must be the full JSON array for a devnet wallet secret key.
- Mock pricing is intentional for hackathon speed.

### Desktop app

Create `desktop/.env`:

```env
VITE_BACKEND_URL=https://your-vercel-project.vercel.app
```

## 3) Run desktop app

From repo root:

```bash
npm run dev:desktop
```

If port `5173` is busy, stop the process using it and rerun.

## 4) Build desktop app

From repo root:

```bash
npm run build:desktop
```

## 5) API route

Settlement endpoint is:

`POST /api/invest`

Body:

```json
{
	"usdCents": 125,
	"toAddress": "<solana-public-key>"
}
```
