import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const BASE = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const VERSION = 'V5-PAPI-ROOTFIX-1';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/health', (_req, res) => res.json({ ok: true, version: VERSION }));

app.post('/api/payment-link', async (req, res) => {
  const { amount, reference, clientName, description, payerEmail, payerPhone, provider } = req.body || {};
  if (!amount || !reference || !clientName || !description) {
    return res.status(400).json({ error: 'amount, reference, clientName et description sont requis.' });
  }
  if (!process.env.PAPI_API_KEY) return res.status(503).json({ error: 'PAPI_API_KEY non configurée.' });

  // Papi's card provider is BRED. Other choices can be locked directly.
  const papiProvider = provider === 'CARD' ? 'BRED' : provider;
  const body = {
    amount: Number(amount),
    currency: 'MGA',
    reference: String(reference),
    clientName: String(clientName),
    description: String(description).slice(0, 255),
    successUrl: `${BASE}/payment-success?reference=${encodeURIComponent(reference)}`,
    failureUrl: `${BASE}/payment-failure?reference=${encodeURIComponent(reference)}`,
    notificationUrl: `${BASE}/api/payment-notify`,
    validDuration: 24,
    payerEmail: payerEmail || undefined,
    payerPhone: payerPhone || undefined,
    provider: papiProvider || undefined,
    isTestMode: String(process.env.PAPI_TEST_MODE).toLowerCase() === 'true',
    testReason: String(process.env.PAPI_TEST_MODE).toLowerCase() === 'true' ? 'KEFONA end-to-end payment test' : undefined
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
    return res.json({
      paymentLink: data.data.paymentLink,
      reference: data.data.paymentReference,
      notificationToken: data.data.notificationToken || null
    });
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
  // Keep the callback fast. The browser independently re-checks Papi's authoritative
  // payment-status endpoint, so a delayed/retried notification cannot block checkout.
  const n = req.body || {};
  console.log('Papi notification:', JSON.stringify({
    paymentStatus: n.paymentStatus,
    paymentMethod: n.paymentMethod,
    paymentReference: n.paymentReference,
    merchantPaymentReference: n.merchantPaymentReference,
    hasNotificationToken: Boolean(n.notificationToken)
  }));
  return res.status(200).json({ ok: true });
});

app.get('/payment-success', (_req, res) => res.sendFile(path.join(__dirname, 'payment-success.html')));
app.get('/payment-failure', (_req, res) => res.sendFile(path.join(__dirname, 'payment-failure.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`KEFONA ${VERSION} running on port ${PORT}`));
