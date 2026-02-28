// API route for handling invest requests. receives amount in USD cents and recipient address, calculates SOL amount, and sends transaction from treasury to recipient.
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

    // Ensure client sends Content-Type: application/json
    const { usdCents, toAddress } = req.body as { usdCents?: number; toAddress?: string };
    if (typeof usdCents !== 'number' || !toAddress) {
      return res.status(400).json({ error: 'Missing usdCents (number) or toAddress (string)' });
    }

    const rpc = process.env.SOLANA_RPC_URL;
    const secretJson = process.env.SOL_TREASURY_SECRET;
    const mockPriceStr = process.env.MOCK_SOL_PRICE_USD || '100';

    if (!rpc || !secretJson) {
      return res.status(500).json({ error: 'Server not configured: missing SOLANA_RPC_URL or SOL_TREASURY_SECRET' });
    }

    const price = Number(mockPriceStr);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(500).json({ error: 'Invalid MOCK_SOL_PRICE_USD' });
    }

    const solAmount = (usdCents / 100) / price;
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      return res.status(400).json({ error: 'Amount too small at current MOCK_SOL_PRICE_USD' });
    }

    //Connect
    const connection = new Connection(rpc, 'confirmed');

    //Parse treasury key
    let secretArray: number[];
    try {
      secretArray = JSON.parse(secretJson) as number[];
    } catch {
      return res.status(500).json({ error: 'SOL_TREASURY_SECRET is not valid JSON array' });
    }
    const treasury = Keypair.fromSecretKey(Uint8Array.from(secretArray));

    // Validate recipient
    let recipient: PublicKey;
    try {
      recipient = new PublicKey(toAddress);
    } catch {
      return res.status(400).json({ error: 'Invalid toAddress public key' });
    }

    // Build & send tx
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
    console.error(err);
    return res.status(500).json({ error: err?.message || 'Unknown server error' });
  }
}
