
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { usdCents, toAddress } = req.body as { usdCents?: number; toAddress?: string };
    if (!usdCents || !toAddress) {
      return res.status(400).json({ error: 'Missing usdCents or toAddress' });
    }

    const rpc = process.env.SOLANA_RPC_URL;
    const secretJson = process.env.SOL_TREASURY_SECRET;
    const mockPriceStr = process.env.MOCK_SOL_PRICE_USD || '100';

    if (!rpc || !secretJson) {
      return res.status(500).json({ error: 'Server not configured: missing RPC or treasury secret' });
    }

    const price = Number(mockPriceStr);
    const solAmount = (usdCents / 100) / price;
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

    if (lamports <= 0) {
      return res.status(400).json({ error: 'Amount too small at current MOCK_SOL_PRICE_USD' });
    }

    const connection = new Connection(rpc, 'confirmed');
    const treasury = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretJson)));
    const recipient = new PublicKey(toAddress);

    const tx = new Transaction().add(SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: recipient,
      lamports
    }));

    const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
    return res.status(200).json({
      sig,
      solAmount,
      explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Unknown server error' });
  }
}
