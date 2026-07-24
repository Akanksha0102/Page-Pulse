const express = require('express');
const axios = require('axios');
const path = require('path');

console.log('Files in __dirname:', require('fs').readdirSync(__dirname));
try {
  console.log('Files in public/:', require('fs').readdirSync(path.join(__dirname, 'public')));
} catch (err) {
  console.log('ERROR reading public/:', err.message);
}
const app = express();
const PORT = process.env.PORT || 3000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB cap so a huge page can't hang the server

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/audit', async (req, res) => {
  const rawUrl = req.query.url;

  const validation = validateUrl(rawUrl);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.reason });
  }
  const targetUrl = validation.url.toString();

  const startedAt = Date.now();
  let response;

  try {
    response = await axios.get(targetUrl, {
      timeout: FETCH_TIMEOUT_MS,
      maxRedirects: 5,
      maxContentLength: MAX_RESPONSE_BYTES,
      // Don't throw on 4xx/5xx - we want to report the target's real
      // status code in our JSON rather than collapsing it into a 500.
      validateStatus: () => true,
      responseType: 'text',
      headers: {
        'User-Agent':
          'PagePulse/1.0 (+https://github.com/; site auditing bot)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });
  } catch (err) {
    const responseTimeMs = Date.now() - startedAt;

    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: `Request to ${targetUrl} timed out after ${FETCH_TIMEOUT_MS}ms.`,
        responseTimeMs,
      });
    }
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      return res.status(502).json({
        error: `Could not resolve host for ${targetUrl}.`,
        responseTimeMs,
      });
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      return res.status(502).json({
        error: `Connection to ${targetUrl} was refused or reset.`,
        responseTimeMs,
      });
    }
    if (err.message && err.message.includes('maxContentLength')) {
      return res.status(413).json({
        error: `Response from ${targetUrl} exceeded the ${MAX_RESPONSE_BYTES} byte limit.`,
        responseTimeMs,
      });
    }
    return res.status(502).json({
      error: `Failed to fetch ${targetUrl}: ${err.message || 'unknown error'}.`,
      responseTimeMs,
    });
  }

  const responseTimeMs = Date.now() - startedAt;
  const contentType = response.headers['content-type'] || '';
  const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');

  const baseReport = {
    url: targetUrl,
    httpStatus: response.status,
    responseTimeMs,
    contentType: contentType || null,
  };

  if (!isHtml) {
    return res.status(200).json({
      ...baseReport,
      parsed: false,
      note: 'Response was not HTML, so page content could not be analyzed.',
    });
  }

  const parsed = parseHtml(response.data);

  return res.status(200).json({
    ...baseReport,
    parsed: true,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    h1Count: parsed.h1Count,
    imagesTotalCount: parsed.imagesTotalCount,
    imagesMissingAltCount: parsed.imagesMissingAltCount,
    wordCount: parsed.wordCount,
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Page Pulse listening on http://localhost:${PORT}`);
});

module.exports = app;
