// ── State ─────────────────────────────────────────────────────────────

const state = {
  traces: [],
  selectedTraceId: null,
  trace: null,           // full enriched trace from server
  selectedSpanId: null,
  forkingSpanId: null,
  forkInputValues: {},   // { fieldKey: currentValue } — survives re-renders
  forkLoading: false,
  forkResult: null,      // { replay_trace_id, summary, final_output }
  forkError: null,
}

// ── API ───────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// ── Trace list ────────────────────────────────────────────────────────

async function loadTraces() {
  try {
    state.traces = await api('/traces')
  } catch (e) {
    state.traces = []
  }
  renderTraceList()
}

function renderTraceList() {
  const el = document.getElementById('trace-list')
  if (!state.traces.length) {
    el.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:12px">No traces yet.</div>'
    return
  }
  el.innerHTML = state.traces.map(t => `
    <div class="trace-item ${t.trace_id === state.selectedTraceId ? 'active' : ''}"
         onclick="selectTrace('${t.trace_id}')">
      <div class="trace-item-id">${t.trace_id.slice(0, 16)}…</div>
      <div class="trace-item-meta">
        ${t.span_count} spans · ${t.llm_count} LLM · ${t.tool_count} tools
        ${t.duration_ms != null ? ' · ' + fmt(t.duration_ms) : ''}
      </div>
    </div>
  `).join('')
}

// ── Trace detail ──────────────────────────────────────────────────────

async function selectTrace(traceId) {
  if (state.selectedTraceId === traceId) return

  state.selectedTraceId = traceId
  state.selectedSpanId = null
  state.forkingSpanId = null
  state.forkResult = null
  state.forkError = null
  state.forkInputValues = {}

  renderTraceList()
  document.getElementById('trace-detail').innerHTML = `
    <div class="loading-msg"><span class="spinner"></span> Loading…</div>
  `

  try {
    state.trace = await api(`/traces/${traceId}`)
  } catch (e) {
    document.getElementById('trace-detail').innerHTML =
      `<div class="loading-msg" style="color:var(--red)">Failed to load trace: ${esc(e.message)}</div>`
    return
  }

  renderTrace()
}

function renderTrace() {
  const detail = document.getElementById('trace-detail')
  if (!state.trace) return

  const { trace_id, created_at, spans } = state.trace
  detail.innerHTML = `
    <div class="trace-header">
      <div class="trace-header-id">${trace_id.slice(0, 16)}…</div>
      <div class="trace-header-meta">${esc(created_at)} · ${spans.length} spans</div>
    </div>
    <div class="span-tree">
      ${spans.map(renderSpanRow).join('')}
    </div>
  `
}

// ── Span rendering ────────────────────────────────────────────────────

function renderSpanRow(span) {
  const isActive   = span.span_id === state.selectedSpanId
  const isForking  = span.span_id === state.forkingSpanId
  const indent     = span.depth * 20
  const statusCls  = span.status === 'ERROR' ? 'status-err' : 'status-ok'
  const statusIcon = span.status === 'ERROR' ? '✗' : '✓'

  const detail = isActive ? renderSpanDetail(span, isForking) : ''

  return `
    <div class="span-row ${isActive ? 'active' : ''}">
      <div class="span-header" onclick="toggleSpan('${span.span_id}')">
        <div style="width:${indent}px;flex-shrink:0"></div>
        <span class="span-status ${statusCls}">${statusIcon}</span>
        <span class="span-badge badge-${span.type}">${span.type}</span>
        <span class="span-name">${esc(span.display_name)}</span>
        <span class="span-duration">${span.duration_ms != null ? fmt(span.duration_ms) : ''}</span>
      </div>
      ${detail}
    </div>
  `
}

function renderSpanDetail(span, isForking) {
  const inputs  = span.inputs  || {}
  const hasIn   = Object.keys(inputs).length > 0
  const hasOut  = !!span.output

  const inputsHtml = hasIn ? `
    <div>
      <div class="detail-block-label">Inputs</div>
      ${Object.entries(inputs).map(([k, v]) => `
        <div class="detail-row">
          <span class="detail-key">${esc(k)}:</span>
          <span class="detail-val">${esc(String(v))}</span>
        </div>
      `).join('')}
    </div>
  ` : ''

  const outputHtml = hasOut ? `
    <div>
      <div class="detail-block-label">Output</div>
      <div class="output-text">${esc(String(span.output))}</div>
    </div>
  ` : ''

  let actionHtml = ''
  if (span.is_forkable && !isForking && !state.forkResult) {
    actionHtml = `<button class="fork-btn" onclick="startFork('${span.span_id}')">Fork here</button>`
  }
  if (isForking) {
    actionHtml = renderForkForm(span)
  }
  if (state.forkResult && state.forkingSpanId === span.span_id) {
    actionHtml = renderForkResult(state.forkResult) +
      `<button class="fork-btn" style="margin-top:8px;background:var(--muted)"
               onclick="resetFork('${span.span_id}')">Fork again</button>`
  }
  if (state.forkError && state.forkingSpanId === span.span_id) {
    actionHtml = `<div class="fork-error">${esc(state.forkError)}</div>` +
      renderForkForm(span)
  }

  return `
    <div class="span-detail">
      ${inputsHtml}
      ${outputHtml}
      ${actionHtml}
    </div>
  `
}

function renderForkForm(span) {
  const inputs = span.inputs || {}
  const savedVals = state.forkInputValues

  const fields = Object.entries(inputs).map(([k, v]) => {
    const current = savedVals[k] !== undefined ? savedVals[k] : String(v)
    const isLong  = current.length > 80
    const escaped = esc(current)
    return `
      <div class="fork-field">
        <label>${esc(k)}</label>
        ${isLong
          ? `<textarea rows="3" data-key="${esc(k)}">${escaped}</textarea>`
          : `<input type="text" data-key="${esc(k)}" value="${escaped}">`}
      </div>
    `
  }).join('')

  const isLoading = state.forkLoading
  return `
    <div class="fork-form" id="fork-form-${span.span_id}">
      <div class="fork-form-title">Edit inputs to fork</div>
      ${fields}
      <div class="fork-actions">
        <button class="btn-run" onclick="submitFork('${span.span_id}')" ${isLoading ? 'disabled' : ''}>
          ${isLoading
            ? '<span class="spinner"></span> Running replay…'
            : 'Run replay'}
        </button>
        <button class="btn-cancel" onclick="cancelFork()">Cancel</button>
      </div>
    </div>
  `
}

function renderForkResult(result) {
  return `
    <div class="fork-result">
      <div class="fork-result-title">✓ Replay complete</div>
      ${result.final_output ? `
        <div class="detail-block-label" style="margin-top:4px">New output</div>
        <div class="fork-result-output">${esc(result.final_output)}</div>
      ` : ''}
      <div class="fork-result-meta">
        ${esc(result.summary)}<br>
        ID: ${result.replay_trace_id.slice(0, 16)}…
      </div>
    </div>
  `
}

// ── Actions ───────────────────────────────────────────────────────────

function toggleSpan(spanId) {
  if (state.selectedSpanId === spanId) {
    state.selectedSpanId = null
    state.forkingSpanId  = null
    state.forkResult     = null
    state.forkError      = null
    state.forkInputValues = {}
  } else {
    state.selectedSpanId  = spanId
    state.forkingSpanId   = null
    state.forkResult      = null
    state.forkError       = null
    state.forkInputValues = {}
  }
  renderTrace()
}

function startFork(spanId) {
  const span = state.trace.spans.find(s => s.span_id === spanId)
  // seed forkInputValues from the span's current inputs
  state.forkInputValues = Object.fromEntries(
    Object.entries(span.inputs || {}).map(([k, v]) => [k, String(v)])
  )
  state.forkingSpanId = spanId
  state.forkResult    = null
  state.forkError     = null
  renderTrace()
  // focus first input after render
  requestAnimationFrame(() => {
    const first = document.querySelector('.fork-field input, .fork-field textarea')
    if (first) first.focus()
  })
}

function cancelFork() {
  state.forkingSpanId   = null
  state.forkResult      = null
  state.forkError       = null
  state.forkInputValues = {}
  renderTrace()
}

function resetFork(spanId) {
  state.forkResult = null
  state.forkError  = null
  startFork(spanId)
}

async function submitFork(spanId) {
  const span = state.trace.spans.find(s => s.span_id === spanId)
  if (!span) return

  // read current values from the form before re-render wipes the DOM
  const form = document.getElementById(`fork-form-${spanId}`)
  if (form) {
    form.querySelectorAll('[data-key]').forEach(el => {
      state.forkInputValues[el.dataset.key] = el.value
    })
  }

  state.forkLoading = true
  state.forkError   = null
  renderTrace()

  try {
    const result = await api(`/traces/${state.selectedTraceId}/fork`, {
      method: 'POST',
      body: JSON.stringify({
        span_id: spanId,
        inputs: { ...state.forkInputValues },
      }),
    })
    state.forkResult  = result
    state.forkLoading = false
  } catch (err) {
    state.forkError   = err.message
    state.forkLoading = false
  }
  renderTrace()
}

// ── Utils ─────────────────────────────────────────────────────────────

function fmt(ms) {
  if (ms == null) return ''
  if (ms < 1)    return `${ms.toFixed(2)}ms`
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Boot ──────────────────────────────────────────────────────────────

loadTraces()
