const { parseHtml } = require('../lib/parser');

describe('parseHtml', () => {
  test('happy path: extracts title, meta description, h1 count, missing-alt images, word count', () => {
    const html = `
      <html>
        <head>
          <title>  Acme Widgets — Home  </title>
          <meta name="description" content="The best widgets on the internet.">
        </head>
        <body>
          <h1>Welcome to Acme</h1>
          <img src="/logo.png" alt="Acme logo">
          <img src="/hero.jpg">
          <img src="/spacer.gif" alt="">
          <p>Four simple words here.</p>
        </body>
      </html>
    `;

    const result = parseHtml(html);

    expect(result.title).toBe('Acme Widgets — Home');
    expect(result.metaDescription).toBe('The best widgets on the internet.');
    expect(result.h1Count).toBe(1);
    // 3 images total, only /hero.jpg has no alt attribute at all.
    // alt="" is a deliberate "decorative image" marker and is not counted as missing.
    expect(result.imagesTotalCount).toBe(3);
    expect(result.imagesMissingAltCount).toBe(1);
    expect(result.wordCount).toBe(7); // "Welcome to Acme" (3) + "Four simple words here." (4)
  });

  test('failure case: empty string input never throws, returns zeroed report', () => {
    const result = parseHtml('');

    expect(result).toEqual({
      title: null,
      metaDescription: null,
      h1Count: 0,
      imagesMissingAltCount: 0,
      imagesTotalCount: 0,
      wordCount: 0,
    });
  });

  test('failure case: malformed/truncated HTML never throws, degrades gracefully', () => {
    const brokenHtml = '<html><head><title>Broken<body><h1>Oops<p>unclosed tags everywhere <img src="x.png"';

    expect(() => parseHtml(brokenHtml)).not.toThrow();

    const result = parseHtml(brokenHtml);
    // cheerio's forgiving parser still recovers a title and h1 even from
    // badly-formed markup - the point of this test is that it never
    // crashes the caller, not that every field is populated.
    expect(typeof result.wordCount).toBe('number');
    expect(result.wordCount).toBeGreaterThanOrEqual(0);
  });

  test('edge case: non-string input (e.g. null from a failed fetch) returns zeroed report, not a crash', () => {
    expect(() => parseHtml(null)).not.toThrow();
    expect(() => parseHtml(undefined)).not.toThrow();
    expect(parseHtml(undefined).title).toBeNull();
  });
});

describe('validateUrl', () => {
  const { validateUrl } = require('../lib/validateUrl');

  test('accepts well-formed https URL', () => {
    const result = validateUrl('https://example.com/page');
    expect(result.ok).toBe(true);
  });

  test('rejects garbage input', () => {
    const result = validateUrl('not a url at all');
    expect(result.ok).toBe(false);
  });

  test('rejects unsupported protocol', () => {
    const result = validateUrl('ftp://example.com/file.txt');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/protocol/i);
  });

  test('rejects empty input', () => {
    const result = validateUrl('');
    expect(result.ok).toBe(false);
  });
});
