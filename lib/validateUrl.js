/**
 * Validates that a string is a well-formed, fetchable http(s) URL.
 * Pure function - returns a result object instead of throwing, so
 * callers (routes, tests) don't need try/catch just to validate input.
 *
 * @param {string} input
 * @returns {{ ok: true, url: URL } | { ok: false, reason: string }}
 */
function validateUrl(input) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { ok: false, reason: 'URL is required.' };
  }

  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch (err) {
    return { ok: false, reason: 'That does not look like a valid URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: `Unsupported protocol "${parsed.protocol}". Only http and https URLs can be audited.`,
    };
  }

  if (!parsed.hostname) {
    return { ok: false, reason: 'URL is missing a hostname.' };
  }

  return { ok: true, url: parsed };
}

module.exports = { validateUrl };
