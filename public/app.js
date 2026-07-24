const form = document.getElementById('audit-form');
const input = document.getElementById('url-input');
const submitBtn = document.getElementById('submit-btn');
const resultArea = document.getElementById('result-area');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = input.value.trim();
  if (!url) return;

  setLoading();

  try {
    const res = await fetch(`/api/audit?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!res.ok) {
      renderError(data.error || `Request failed with status ${res.status}.`);
      return;
    }

    renderReport(data);
  } catch (err) {
    renderError('Could not reach the Page Pulse server. Is it running?');
  } finally {
    submitBtn.disabled = false;
  }
});

function setLoading() {
  submitBtn.disabled = true;
  resultArea.innerHTML = `<div class="card"><p class="loading">Auditing…</p></div>`;
}

function renderError(message) {
  resultArea.innerHTML = `
    <div class="card error-card">
      <strong>Couldn't complete the audit</strong>
      <p style="margin:8px 0 0;">${escapeHtml(message)}</p>
    </div>
  `;
}

function renderReport(data) {
  const isOk = data.httpStatus >= 200 && data.httpStatus < 400;
  const pillClass = isOk ? 'ok' : 'err';

  let bodyFields = '';

  if (data.parsed === false) {
    bodyFields = `
      <div class="field" style="grid-column: 1 / -1;">
        <div class="field-label">Note</div>
        <div class="field-value">${escapeHtml(data.note)}</div>
      </div>
    `;
  } else {
    bodyFields = `
      <div class="field">
        <div class="field-label">Title</div>
        <div class="field-value">${escapeHtml(data.title) || '<span style="color:var(--muted)">None found</span>'}</div>
      </div>
      <div class="field">
        <div class="field-label">Meta description</div>
        <div class="field-value">${escapeHtml(data.metaDescription) || '<span style="color:var(--muted)">None found</span>'}</div>
      </div>
      <div class="field">
        <div class="field-label">H1 count</div>
        <div class="field-value">${data.h1Count}</div>
      </div>
      <div class="field">
        <div class="field-label">Images missing alt text</div>
        <div class="field-value">${data.imagesMissingAltCount} of ${data.imagesTotalCount}</div>
      </div>
      <div class="field">
        <div class="field-label">Approx. word count</div>
        <div class="field-value">${data.wordCount.toLocaleString()}</div>
      </div>
    `;
  }

  resultArea.innerHTML = `
    <div class="card">
      <div class="status-row">
        <span class="status-pill ${pillClass}">${data.httpStatus}</span>
        <span class="meta-line">${data.responseTimeMs}ms · ${escapeHtml(data.contentType) || 'unknown content type'}</span>
      </div>
      <div class="meta-line" style="word-break:break-all;">${escapeHtml(data.url)}</div>
      <div class="field-grid">
        ${bodyFields}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
