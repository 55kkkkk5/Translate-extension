/**
 * Ledger Translate Server — standalone, independent from Ledger.
 * Its only job: take a message and translate it (any language <-> Roman Urdu)
 * using Anthropic's API, gated behind one shared office password.
 */
const express = require('express');

const PORT = process.env.PORT || 4001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Permissive CORS — this service holds no user data, just proxies translation requests.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'ledger-translate-server' });
});

app.post('/api/translate', async (req, res) => {
  const { text, direction, password } = req.body || {};

  if (!ACCESS_PASSWORD) {
    return res.status(500).json({ error: 'Server not configured yet — set ACCESS_PASSWORD in environment variables.' });
  }
  if ((password || '') !== ACCESS_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password.' });
  }
  if (!text || !direction) {
    return res.status(400).json({ error: 'text and direction are required.' });
  }
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server not configured yet — set ANTHROPIC_API_KEY in environment variables.' });
  }

  const systemPrompt = direction === 'to_roman_urdu'
    ? 'You are a translator for a Discord commission-art business. Translate the user\'s message (it may be in English, French, Spanish, or any other language) into natural, casual Roman Urdu — Urdu written in Latin/English letters, the way Pakistanis text each other, NOT Urdu script and NOT overly formal. Output ONLY the translation, nothing else — no quotes, no notes, no explanation.'
    : 'You are a translator for a Discord commission-art business. The user\'s message is written in Roman Urdu (Urdu written in Latin/English letters). Translate it into natural, friendly, professional English suitable for messaging a client. Output ONLY the translation, nothing else — no quotes, no notes, no explanation.';

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    });
    const data = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(502).json({ error: data?.error?.message || 'Translation service error.' });
    }
    const translated = (data.content && data.content[0] && data.content[0].text || '').trim();
    res.json({ translated });
  } catch (e) {
    res.status(500).json({ error: 'Translation failed: ' + e.message });
  }
});

app.listen(PORT, () => {
  console.log('Translate server running on port ' + PORT);
});
