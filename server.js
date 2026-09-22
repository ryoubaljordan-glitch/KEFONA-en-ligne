import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/health', (_req, res) => res.json({ ok: true, version: 'V5' }));

app.post('/api/payment-link', async (req, res) => {
  const { amount, reference, clientName, description, payerEmail, payerPhone, provider } = req.body || {};
  if (!amount || !reference || !clientName || !description) {
    return res.status(400).json({ error: 'amount, reference, clientName et description sont requis.' });
  }
  if (!process.env.PAPI_API_KEY) {
    return res.status(503).json({ error: 'PAPI_API_KEY non configurée.' });
  }

  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  const body = {
    amount: Number(amount),
    currency: 'MGA',
    reference: String(reference),
    clientName: String(clientName),
    description: String(description).slice(0, 255),
    successUrl: `${base}/payment-success?reference=${encodeURIComponent(reference)}`,
    failureUrl: `${base}/payment-failure?reference=${encodeURIComponent(reference)}`,
    notificationUrl: `${base}/api/payment-notify`,
    validDuration: 24,
    payerEmail: payerEmail || undefined,
    payerPhone: payerPhone || undefined,
    provider: provider === 'CARD' ? 'BRED' : (provider || undefined),
    isTestMode: String(process.env.PAPI_TEST_MODE).toLowerCase() === 'true'
  };

  try {
    const r = await fetch('https://app.papi.mg/engine/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': process.env.PAPI_API_KEY },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok || !data?.data?.paymentLink) {
      return res.status(r.status || 502).json({ error: data?.error?.message || 'Papi payment link error.' });
    }
    return res.json({ paymentLink: data.data.paymentLink, reference: data.data.paymentReference });
  } catch (err) {
    console.error('Papi error:', err);
    return res.status(502).json({ error: 'Impossible de contacter Papi.' });
  }
});

app.get('/api/payment-status', async (req, res) => {
  const reference = String(req.query.reference || '').trim();
  if (!reference) return res.status(400).json({ error: 'reference requise.' });
  if (!/^[A-Za-z0-9._-]+$/.test(reference)) return res.status(400).json({ error: 'reference invalide.' });
  if (!process.env.PAPI_API_KEY) return res.status(503).json({ error: 'PAPI_API_KEY non configurée.' });
  try {
    const r = await fetch(`https://app.papi.mg/engine/api/payment-links/${encodeURIComponent(reference)}`, {
      headers: { 'Token': process.env.PAPI_API_KEY }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status || 502).json({ error: data?.error?.message || 'Papi status error.' });
    const p = data?.data || {};
    return res.json({
      reference: p.merchantPaymentReference || reference,
      linkStatus: p.linkStatus || null,
      paymentStatus: p.paymentStatus || null,
      paymentMethod: p.paymentMethod || null,
      amount: p.amount ?? null,
      isTestMode: p.isTestMode ?? null
    });
  } catch (err) {
    console.error('Papi status error:', err);
    return res.status(502).json({ error: 'Impossible de contacter Papi.' });
  }
});

app.post('/api/payment-notify', (req, res) => {
  // IMPORTANT: production must verify Papi's notification signature/token before
  // changing an order's paid status. No order database is included in this V5
  // reconstruction because the source V5 is a frontend/localStorage preview.
  console.log('Papi notification received:', JSON.stringify(req.body));
  res.json({ ok: true });
});

app.get('/payment-success', (_req, res) => res.sendFile(path.join(__dirname, 'payment-success.html')));
app.get('/payment-failure', (_req, res) => res.sendFile(path.join(__dirname, 'payment-failure.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`KEFONA V5 running on port ${PORT}`));
