const cheerio = require('cheerio');

/**
 * Parses an HTML string into the report fields Page Pulse cares about.
 * Pure function: no I/O, no network. Never throws - malformed or empty
 * HTML just yields empty/zeroed fields instead of crashing the caller.
 *
 * @param {string} html - raw HTML body
 * @returns {{
 *   title: string|null,
 *   metaDescription: string|null,
 *   h1Count: number,
 *   imagesMissingAltCount: number,
 *   imagesTotalCount: number,
 *   wordCount: number
 * }}
 */
function parseHtml(html) {
  const empty = {
    title: null,
    metaDescription: null,
    h1Count: 0,
    imagesMissingAltCount: 0,
    imagesTotalCount: 0,
    wordCount: 0,
  };

  if (typeof html !== 'string' || html.trim().length === 0) {
    return empty;
  }

  let $;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    // cheerio is very forgiving, but guard anyway - never let bad markup
    // take down the request.
    return empty;
  }

  const titleText = $('title').first().text().trim();
  const title = titleText.length > 0 ? titleText : null;

  const metaDescRaw = $('meta[name="description"]').first().attr('content');
  const metaDescription =
    typeof metaDescRaw === 'string' && metaDescRaw.trim().length > 0
      ? metaDescRaw.trim()
      : null;

  const h1Count = $('h1').length;

  const images = $('img');
  const imagesTotalCount = images.length;
  let imagesMissingAltCount = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    // Missing alt attribute entirely, or present but empty/whitespace,
    // both count as "missing" for accessibility auditing purposes -
    // except an explicitly empty alt="" is a valid decorative-image
    // marker in HTML, so we only count truly absent alt attributes.
    if (alt === undefined) {
      imagesMissingAltCount += 1;
    }
  });

  // Approximate word count: strip script/style (their text isn't
  // page content), take the remaining visible text, collapse
  // whitespace, split, count non-empty tokens. This is an
  // approximation - it won't match a human's reading-level word
  // count exactly (e.g. it counts nav/footer boilerplate too) but is
  // stable and cheap to compute.
  $('script, style, noscript').remove();
  const bodyText = $('body').length > 0 ? $('body').text() : $.root().text();
  const words = bodyText
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
  const wordCount = words.length;

  return {
    title,
    metaDescription,
    h1Count,
    imagesMissingAltCount,
    imagesTotalCount,
    wordCount,
  };
}

module.exports = { parseHtml };
