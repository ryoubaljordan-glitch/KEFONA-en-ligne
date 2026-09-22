import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const jsonParser = express.json({ limit: '1mb' });
app.use('/api/payment-notify', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(jsonParser);
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
    successUrl: `${base}/payment-success.html?reference=${encodeURIComponent(reference)}`,
    failureUrl: `${base}/payment-failure.html?reference=${encodeURIComponent(reference)}`,
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
    return res.json({ paymentLink: data.data.paymentLink, reference: data.data.paymentReference || reference });
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
      message: p.message || null,
      amount: p.amount ?? null,
      isTestMode: p.isTestMode ?? null
    });
  } catch (err) {
    console.error('Papi status error:', err);
    return res.status(502).json({ error: 'Impossible de contacter Papi.' });
  }
});

function verifyPapiSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!Buffer.isBuffer(rawBody) || !header || !secret) return false;
  const parts = {};
  for (const item of header.split(',')) {
    const [key, ...rest] = item.trim().split('=');
    if (key) parts[key] = rest.join('=');
  }
  const { t, v1 } = parts;
  if (!/^\d+$/.test(t || '') || !/^[0-9a-f]{64}$/.test(v1 || '')) return false;
  if (toleranceSeconds > 0 && Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > toleranceSeconds) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  const received = Buffer.from(v1, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

app.post('/api/payment-notify', (req, res) => {
  const secret = process.env.PAPI_WEBHOOK_SECRET;
  if (!verifyPapiSignature(req.body, req.get('X-Papi-Signature'), secret)) {
    return res.status(401).json({ ok: false, error: 'Notification Papi non authentifiée.' });
  }
  try {
    const notification = JSON.parse(req.body.toString('utf8'));
    console.log('Papi notification verified:', JSON.stringify({
      merchantPaymentReference: notification.merchantPaymentReference,
      paymentStatus: notification.paymentStatus,
      paymentMethod: notification.paymentMethod,
      paymentReference: notification.paymentReference
    }));
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: 'Notification JSON invalide.' });
  }
});

app.get('/payment-success', (_req, res) => res.sendFile(path.join(__dirname, 'payment-success.html')));
app.get('/payment-failure', (_req, res) => res.sendFile(path.join(__dirname, 'payment-failure.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`KEFONA V5 running on port ${PORT}`));
