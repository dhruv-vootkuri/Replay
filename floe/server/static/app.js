// Replay Console — live dashboard over the traces directory.
// Views: overview · traces · pressure tests · replay log · tools

// ── State ─────────────────────────────────────────────────────────────

const state = {
  view: 'overview',
  meta: null,
  loading: false,

  stats: null,

  traces: [],
  trace: null,              // selected trace, fully enriched
  openSpanId: null,
  forkSpanId: null,
  forkValues: {},
  forkBusy: false,
  forkResult: null,
  forkError: null,

  prompts: [],
  runs: [],
  run: null,                // opened pressure run
  pf: null,                 // pressure form state
  showForm: false,

  replays: [],
  tools: null,
  poll: null,
}

const STATUS_GLYPH = {
  pass: '✓', warn: '!', fail: '✕', error: '✕',
  skipped: '·', pending: '·', running: '◔',
}

const TYPE_MARK = {
  llm: 'var(--mark-1)',
  tool: 'var(--mark-2)',
  task: 'var(--mark-3)',
  agent: 'var(--mark-4)',
  span: 'var(--border-strong)',
}

// ── API ───────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed (${res.status})`)
  }
  return res.json()
}

// ── Utils ─────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function attr(str) { return esc(str).replace(/'/g, '&#39;') }

function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms < 1) return `${ms.toFixed(2)}ms`
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function fmtNum(n) {
  if (n == null) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtPct(x) { return x == null ? '—' : `${Math.round(x * 100)}%` }

function ago(epochSeconds) {
  if (!epochSeconds) return '—'
  const secs = Date.now() / 1000 - epochSeconds
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function shortId(id) { return String(id || '').slice(0, 12) }

function clip(text, n = 130) {
  const str = String(text ?? '').replace(/\s+/g, ' ').trim()
  return str.length > n ? `${str.slice(0, n)}…` : str
}

function pill(text, kind) {
  return `<span class="pill pill-${kind || 'span'}">${esc(text)}</span>`
}

function statusPill(status) {
  return `<span class="pill pill-${status}">${STATUS_GLYPH[status] || ''} ${esc(status)}</span>`
}

function toast(message, kind = '') {
  const host = document.getElementById('toasts')
  const el = document.createElement('div')
  el.className = `toast ${kind ? `toast-${kind}` : ''}`
  el.innerHTML = esc(message)
  host.appendChild(el)
  setTimeout(() => el.remove(), 5200)
}

function empty(icon, title, body) {
  return `<div class="empty"><div class="empty-icon">${icon}</div>
    <h3>${esc(title)}</h3><p>${body}</p></div>`
}

// ── Charts ────────────────────────────────────────────────────────────

// Horizontal bars. One color per entity so a hue always means the same
// thing across the app; values sit at the tip, axis-free.
function barChart(rows, { color, colorFor, unit = '' } = {}) {
  if (!rows.length) return `<p class="small faint">Nothing recorded yet.</p>`
  const max = Math.max(...rows.map(r => r.value)) || 1
  const bars = rows.map(row => {
    const fill = colorFor ? colorFor(row) : (color || 'var(--mark-1)')
    const pct = Math.max((row.value / max) * 100, 2)
    return `<div class="bar-row">
      <div class="bar-name" title="${attr(row.label)}">${esc(row.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${fill}"></div></div>
      <div class="bar-value">${fmtNum(row.value)}${esc(unit)}</div>
    </div>`
  }).join('')
  return `<div class="bars">${bars}</div>`
}

function legend(items) {
  return `<div class="legend">${items.map(i => `
    <div class="legend-item"><span class="legend-key" style="background:${i.color}"></span>${esc(i.label)}</div>
  `).join('')}</div>`
}

// Stacked meter of run outcomes — segments separated by a surface gap,
// always paired with a labelled legend so color is never the only channel.
function outcomeMeter(totals) {
  const parts = [
    { key: 'pass', label: 'pass', color: 'var(--good)' },
    { key: 'warn', label: 'warn', color: 'var(--warn)' },
    { key: 'fail', label: 'fail', color: 'var(--bad)' },
    { key: 'error', label: 'error', color: 'var(--bad)' },
    { key: 'skipped', label: 'skipped', color: 'var(--surface-3)' },
    { key: 'running', label: 'running', color: 'var(--mark-1)' },
    { key: 'pending', label: 'pending', color: 'var(--surface-2)' },
  ].filter(p => (totals[p.key] || 0) > 0)
  const total = parts.reduce((sum, p) => sum + totals[p.key], 0) || 1
  return `<div class="meter">${parts.map(p =>
    `<span style="width:${(totals[p.key] / total) * 100}%;background:${p.color}"></span>`
  ).join('')}</div>
  <div class="legend">${parts.map(p => `<div class="legend-item">
    <span class="check-glyph glyph-${p.key === 'error' ? 'fail' : p.key}">${STATUS_GLYPH[p.key]}</span>
    ${totals[p.key]} ${esc(p.label)}
  </div>`).join('')}</div>`
}

function tile(label, value, foot, hero = false) {
  return `<div class="tile ${hero ? 'hero-tile' : ''}">
    <div class="tile-label">${esc(label)}</div>
    <div class="${hero ? 'hero-value' : 'tile-value'}">${value}</div>
    ${foot ? `<div class="tile-foot">${foot}</div>` : ''}
  </div>`
}

// ── Shell ─────────────────────────────────────────────────────────────

const VIEWS = {
  overview: {
    title: 'Overview',
    sub: 'Everything the CLI knows about, in one place.',
    render: renderOverview,
    load: loadOverview,
  },
  traces: {
    title: 'Traces',
    sub: 'Inspect any captured run and fork it at any step.',
    render: renderTraces,
    load: loadTraces,
  },
  pressure: {
    title: 'Pressure tests',
    sub: 'Replay one candidate system prompt against every stored trace.',
    render: renderPressure,
    load: loadPressure,
  },
  replays: {
    title: 'Replay log',
    sub: 'Every replay ever played, with its diff against the original.',
    render: renderReplays,
    load: loadReplays,
  },
  tools: {
    title: 'Tools',
    sub: 'What replay is allowed to re-run for real.',
    render: renderTools,
    load: loadTools,
  },
}

async function go(view, { reload = true } = {}) {
  if (!VIEWS[view]) view = 'overview'
  state.view = view
  if (location.hash !== `#${view}`) location.hash = view

  document.querySelectorAll('.rail-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view))

  const def = VIEWS[view]
  document.getElementById('view-title').textContent = def.title
  document.getElementById('view-sub').textContent = def.sub

  if (reload) {
    document.getElementById('view').innerHTML =
      `<p class="muted small"><span class="spinner"></span> Loading…</p>`
    document.getElementById('view-actions').innerHTML = ''
    try {
      await def.load()
    } catch (err) {
      document.getElementById('view').innerHTML =
        `<div class="banner banner-warn"><span class="banner-glyph">!</span>
          <div>Could not load this view: ${esc(err.message)}</div></div>`
      return
    }
  }
  paint()
  schedulePolling()
}

function paint() {
  document.getElementById('view').innerHTML = VIEWS[state.view].render()
  document.getElementById('view-actions').innerHTML = renderActions()
}

function renderActions() {
  if (state.view === 'traces' && state.trace) {
    return `
      <button class="btn btn-sm" onclick="openRaw()">Raw JSON</button>
      <button class="btn btn-sm btn-primary" onclick="pressureFromTrace()">Pressure test its prompt</button>`
  }
  if (state.view === 'pressure') {
    return `<button class="btn btn-sm ${state.showForm ? '' : 'btn-primary'}"
      onclick="toggleForm()">${state.showForm ? 'Hide form' : '+ New run'}</button>`
  }
  return ''
}

function renderRail() {
  const meta = state.meta
  const counts = {
    traces: state.stats?.totals.traces ?? state.traces.length,
    pressure: state.stats?.totals.pressure_runs ?? state.runs.length,
    replays: state.stats?.totals.replays ?? state.replays.length,
    tools: meta?.tools_loaded ?? 0,
  }
  for (const [key, value] of Object.entries(counts)) {
    const el = document.getElementById(`count-${key}`)
    if (el) el.textContent = value || ''
  }
  if (!meta) return
  document.getElementById('rail-status').innerHTML = `
    <div class="mono trunc" title="${attr(meta.traces_dir)}">./${esc(meta.traces_dir)}</div>
    <div>${meta.tools_loaded
      ? `<span class="ok">✓</span> ${meta.tools_loaded} tool${meta.tools_loaded === 1 ? '' : 's'} loaded`
      : `<span class="no">!</span> no tools loaded`}</div>
    <div>${meta.has_api_key
      ? `<span class="ok">✓</span> API key present`
      : `<span class="no">!</span> no API key`}</div>`
}

function schedulePolling() {
  clearInterval(state.poll)
  const live = state.runs.some(r => ['queued', 'running'].includes(r.status))
    || (state.run && ['queued', 'running'].includes(state.run.status))
  if (state.view !== 'pressure' || !live) return
  state.poll = setInterval(async () => {
    try {
      state.runs = await api('/pressure')
      if (state.run) state.run = await api(`/pressure/${state.run.run_id}`)
      paint()
      renderRail()
      if (!state.runs.some(r => ['queued', 'running'].includes(r.status))
          && !(state.run && ['queued', 'running'].includes(state.run.status))) {
        clearInterval(state.poll)
      }
    } catch (err) {
      clearInterval(state.poll)
    }
  }, 1600)
}

// ── Overview ──────────────────────────────────────────────────────────

async function loadOverview() {
  const [meta, stats] = await Promise.all([api('/meta'), api('/stats')])
  state.meta = meta
  state.stats = stats
  renderRail()
}

function renderOverview() {
  const { totals, tool_usage, span_mix, recent_traces, recent_replays, recent_runs } = state.stats

  if (!totals.traces) {
    return empty('◇', 'No traces captured yet', `
      Add <code>replay.init()</code> to your agent script and run it once —
      every LLM call and tool call lands in <code>./${esc(state.meta.traces_dir)}</code>,
      and this dashboard picks it up on refresh.`)
  }

  const hero = totals.checks_graded
    ? tile('Pressure checks passing', fmtPct(totals.pass_rate),
        `${fmtNum(totals.checks_passed)} of ${fmtNum(totals.checks_graded)} graded trace runs across
         ${totals.pressure_runs} pressure run${totals.pressure_runs === 1 ? '' : 's'}`, true)
    : tile('Traces ready to test', fmtNum(totals.traces),
        `no pressure run yet — <a href="#pressure" onclick="go('pressure')">test a system prompt</a>`, true)

  const tiles = [
    hero,
    tile('Traces', fmtNum(totals.traces), `${fmtNum(totals.spans)} spans`),
    tile('LLM calls', fmtNum(totals.llm_calls), `${fmtNum(totals.tokens)} tokens`),
    tile('Tool calls', fmtNum(totals.tool_calls), `${tool_usage.length} distinct tools`),
    tile('Replays played', fmtNum(totals.replays), 'forks + pressure runs'),
    tile('System prompts', fmtNum(totals.prompts), 'distinct, across all traces'),
  ].join('')

  const mixRows = span_mix.map(s => ({ label: s.type, value: s.count }))
  const toolRows = tool_usage.slice(0, 8).map(t => ({ label: t.name, value: t.count }))

  return `
  <div class="stack">
    <div class="grid grid-tiles">${tiles}</div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><span class="card-title">Span mix</span>
          <span class="card-note">by kind, all traces</span></div>
        ${barChart(mixRows, { colorFor: r => TYPE_MARK[r.label] || 'var(--mark-1)' })}
        ${legend(span_mix.map(s => ({ label: s.type, color: TYPE_MARK[s.type] || 'var(--mark-1)' })))}
      </div>
      <div class="card">
        <div class="card-head"><span class="card-title">Tool usage</span>
          <span class="card-note">traces that call each tool</span></div>
        ${barChart(toolRows, { color: 'var(--mark-2)' })}
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><span class="card-title">Recent traces</span>
          <button class="btn btn-sm btn-ghost" onclick="go('traces')">All traces →</button></div>
        <div class="list">${recent_traces.map(t => `
          <button class="list-item" onclick="openTrace('${t.trace_id}')">
            <div class="list-main">
              <div class="list-title trunc">${esc(clip(t.question, 74) || t.trace_id)}</div>
              <div class="list-sub">${esc(shortId(t.trace_id))} · ${t.llm_count} LLM ·
                ${t.tool_count} tools · ${fmtMs(t.duration_ms)}${t.replay_count
                  ? ` · ${t.replay_count} replay${t.replay_count === 1 ? '' : 's'}` : ''}</div>
            </div>
            ${t.status === 'ERROR' ? statusPill('fail') : ''}
          </button>`).join('')}</div>
      </div>

      <div class="card">
        <div class="card-head"><span class="card-title">Latest pressure runs</span>
          <button class="btn btn-sm btn-ghost" onclick="go('pressure')">All runs →</button></div>
        ${recent_runs.length ? `<div class="list">${recent_runs.map(r => `
          <button class="list-item" onclick="openRun('${r.run_id}')">
            <div class="list-main">
              <div class="list-title trunc">${esc(r.name)}</div>
              <div class="list-sub">${r.trace_count} traces · ${esc(r.status)} · ${ago(r.created_at)}</div>
            </div>
            ${statusPill(r.verdict)}
          </button>`).join('')}</div>`
          : `<p class="small faint">No pressure run yet. Pick a system prompt and
             <a href="#pressure" onclick="go('pressure')">run it against every trace</a>.</p>`}

        ${recent_replays.length ? `
          <div class="section-label" style="margin-top:16px">Latest replays</div>
          <div class="list">${recent_replays.slice(0, 4).map(r => `
            <button class="list-item" onclick="openDiff('${r.replay_id}')">
              <div class="list-main">
                <div class="list-title trunc">${esc(clip(r.final_output, 62) || r.summary)}</div>
                <div class="list-sub">${esc(r.source)} · ${esc(shortId(r.replay_id))} · ${ago(r.replayed_at)}</div>
              </div>
            </button>`).join('')}</div>` : ''}
      </div>
    </div>
  </div>`
}

// ── Traces ────────────────────────────────────────────────────────────

async function loadTraces() {
  const [meta, traces] = await Promise.all([api('/meta'), api('/traces')])
  state.meta = meta
  state.traces = traces
  renderRail()
  if (state.trace) {
    const still = traces.some(t => t.trace_id === state.trace.trace_id)
    if (!still) state.trace = null
  }
}

function renderTraces() {
  if (!state.traces.length) {
    return empty('◇', 'No traces captured yet', `
      Run your agent with <code>replay.init()</code> once, then refresh.`)
  }

  const list = state.traces.map(t => `
    <button class="list-item ${state.trace?.trace_id === t.trace_id ? 'active' : ''}"
            onclick="openTrace('${t.trace_id}')">
      <div class="list-main">
        <div class="list-title trunc">${esc(clip(t.question, 58) || shortId(t.trace_id))}</div>
        <div class="list-sub">${esc(shortId(t.trace_id))} · ${t.span_count} spans ·
          ${t.llm_count} LLM · ${t.tool_count} tools</div>
      </div>
      ${t.replay_count ? `<span class="pill">↺ ${t.replay_count}</span>` : ''}
    </button>`).join('')

  return `<div class="panes">
    <div class="card pane-scroll"><div class="list">${list}</div></div>
    <div>${state.trace ? renderTraceDetail() : empty('◇', 'Pick a trace',
      'Select a trace on the left to walk its spans and fork any step.')}</div>
  </div>`
}

function renderTraceDetail() {
  const t = state.trace
  return `<div class="stack">
    <div class="card">
      <div class="card-head">
        <span class="card-title">${esc(shortId(t.trace_id))}</span>
        <span class="card-note">${esc(t.created_at)} · ${esc(t.model || 'unknown model')}</span>
      </div>
      <div class="grid grid-tiles" style="margin-bottom:14px">
        ${tile('Spans', t.span_count)}
        ${tile('LLM calls', t.llm_count)}
        ${tile('Tool calls', t.tool_count)}
        ${tile('Duration', fmtMs(t.duration_ms))}
        ${tile('Tokens', fmtNum(t.total_tokens))}
      </div>
      ${t.question ? `<div class="section-label">Question</div>
        <div class="blockquote">${esc(t.question)}</div>` : ''}
      ${t.final_output ? `<div class="section-label" style="margin-top:12px">Final answer</div>
        <div class="blockquote after">${esc(t.final_output)}</div>` : ''}
      ${t.system_prompt != null ? `
        <div class="section-label" style="margin-top:12px">System prompt</div>
        <div class="blockquote mono-quote">${esc(t.system_prompt)}</div>
        <div class="row" style="margin-top:9px">
          <button class="btn btn-sm btn-primary" onclick="pressureFromTrace()">
            Pressure test this prompt against all traces</button>
        </div>` : `
        <div class="banner banner-info" style="margin-top:12px"><span class="banner-glyph">i</span>
          <div>This trace has no system message, so there is no prompt to pressure test.
          You can still fork any span below.</div></div>`}
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">Spans</span>
        <span class="card-note">click a span to inspect it · ◆ marks a forkable step</span></div>
      ${t.spans.map(renderSpanRow).join('')}
    </div>

    ${t.replays.length ? `<div class="card">
      <div class="card-head"><span class="card-title">Replays of this trace</span>
        <span class="card-note">${t.replays.length}</span></div>
      <div class="list">${t.replays.map(r => `
        <button class="list-item" onclick="openDiff('${r.replay_id}')">
          <div class="list-main">
            <div class="list-title trunc">${esc(clip(r.final_output, 66) || r.summary)}</div>
            <div class="list-sub">${esc(r.source)}${r.label ? ` · ${esc(r.label)}` : ''} ·
              changed ${r.changes.map(c => esc(c.field)).join(', ') || '—'} · ${ago(r.replayed_at)}</div>
          </div>
          <span class="pill">diff →</span>
        </button>`).join('')}</div>
    </div>` : ''}
  </div>`
}

function renderSpanRow(span) {
  const open = span.span_id === state.openSpanId
  const statusCls = span.status === 'ERROR' ? 'status-err' : 'status-ok'
  const icon = span.status === 'ERROR' ? '✗' : '✓'
  return `<div class="span-row ${open ? 'open' : ''}">
    <button class="span-head" onclick="toggleSpan('${span.span_id}')">
      <span style="width:${span.depth * 16}px;flex-shrink:0"></span>
      <span class="span-status ${statusCls}">${icon}</span>
      ${pill(span.type, span.type)}
      <span class="span-name">${esc(span.display_name)}</span>
      <span class="span-meta">${span.is_forkable ? '◆ ' : ''}${fmtMs(span.duration_ms)}</span>
    </button>
    ${open ? renderSpanDetail(span) : ''}
  </div>`
}

function renderSpanDetail(span) {
  const inputs = Object.entries(span.inputs || {})
  const forking = state.forkSpanId === span.span_id
  const result = forking ? state.forkResult : null

  let action = ''
  if (span.is_forkable && !forking) {
    action = `<div><button class="btn btn-sm btn-primary"
      onclick="startFork('${span.span_id}')">Fork here</button></div>`
  } else if (forking && result) {
    action = renderForkResult(span, result)
  } else if (forking) {
    action = renderForkForm(span)
  }

  return `<div class="span-detail">
    ${span.model ? `<div class="kv"><span class="kv-key">model</span>
      <span class="kv-val mono">${esc(span.model)}${span.tokens ? ` · ${span.tokens} tokens` : ''}</span></div>` : ''}
    <div class="kv"><span class="kv-key">span id</span><span class="kv-val mono">${esc(span.span_id)}</span></div>
    ${inputs.length ? `<div>
      <div class="section-label">Inputs</div>
      ${inputs.map(([k, v]) => `<div class="kv">
        <span class="kv-key">${esc(k)}</span><span class="kv-val">${esc(clip(v, 700))}</span></div>`).join('')}
    </div>` : ''}
    ${span.output ? `<div>
      <div class="section-label">Output</div>
      <div class="blockquote">${esc(clip(span.output, 1400))}</div></div>` : ''}
    ${state.forkError && forking
      ? `<div class="banner banner-warn"><span class="banner-glyph">!</span>
         <div>${esc(state.forkError)}</div></div>` : ''}
    ${action}
  </div>`
}

function renderForkForm(span) {
  const fields = Object.entries(span.inputs || {}).map(([key, original]) => {
    const value = state.forkValues[key] !== undefined ? state.forkValues[key] : String(original)
    const long = String(value).length > 70
    return `<div class="field">
      <label>${esc(key)}</label>
      ${long
        ? `<textarea rows="4" class="${key === 'system' ? 'prompt-box' : ''}"
             data-fork-key="${attr(key)}">${esc(value)}</textarea>`
        : `<input type="text" data-fork-key="${attr(key)}" value="${attr(value)}">`}
    </div>`
  }).join('')

  return `<div class="stack" id="fork-form">
    <div class="section-label">Change an input, then replay everything downstream</div>
    ${fields}
    <div class="row">
      <button class="btn btn-primary btn-sm" onclick="submitFork('${span.span_id}')"
        ${state.forkBusy ? 'disabled' : ''}>
        ${state.forkBusy ? '<span class="spinner"></span> Replaying…' : 'Run replay'}</button>
      <button class="btn btn-sm btn-ghost" onclick="cancelFork()">Cancel</button>
    </div>
    ${state.meta && !state.meta.tools_loaded ? `
      <div class="banner banner-warn"><span class="banner-glyph">!</span>
        <div>No tools are registered in this server process, so the replayed agent
        can't call any. Run your agent script once to write
        <code class="inline">.replay/tool_sources.py</code>, then restart
        <code class="inline">replay serve</code>.</div></div>` : ''}
  </div>`
}

function renderForkResult(span, result) {
  const changedSystem = state.forkValues.system !== undefined
    && state.forkValues.system !== (span.inputs.system ?? '')
  return `<div class="stack">
    <div class="banner banner-info"><span class="banner-glyph">✓</span>
      <div>Replay complete · <span class="mono">${esc(shortId(result.replay_trace_id))}</span></div></div>
    ${result.final_output ? `<div>
      <div class="section-label">New final answer</div>
      <div class="blockquote after">${esc(result.final_output)}</div></div>` : ''}
    <div class="small faint">${esc(result.summary)}</div>
    <div class="row row-wrap">
      <button class="btn btn-sm" onclick="openDiff('${result.replay_trace_id}')">See the diff</button>
      <button class="btn btn-sm btn-ghost" onclick="startFork('${span.span_id}')">Fork again</button>
      ${changedSystem ? `<button class="btn btn-sm btn-primary"
        onclick="pressureFromFork()">Pressure test this prompt against all traces</button>` : ''}
    </div>
  </div>`
}

async function openTrace(traceId) {
  if (state.view !== 'traces') await go('traces')
  state.openSpanId = null
  state.forkSpanId = null
  state.forkResult = null
  state.forkError = null
  state.forkValues = {}
  try {
    state.trace = await api(`/traces/${traceId}`)
  } catch (err) {
    toast(err.message, 'error')
    return
  }
  paint()
}

function toggleSpan(spanId) {
  state.openSpanId = state.openSpanId === spanId ? null : spanId
  state.forkSpanId = null
  state.forkResult = null
  state.forkError = null
  state.forkValues = {}
  paint()
}

function startFork(spanId) {
  const span = state.trace.spans.find(s => s.span_id === spanId)
  state.forkValues = Object.fromEntries(
    Object.entries(span.inputs || {}).map(([k, v]) => [k, String(v)]))
  state.forkSpanId = spanId
  state.forkResult = null
  state.forkError = null
  paint()
  requestAnimationFrame(() => {
    const first = document.querySelector('#fork-form [data-fork-key]')
    if (first) first.focus()
  })
}

function cancelFork() {
  state.forkSpanId = null
  state.forkResult = null
  state.forkError = null
  state.forkValues = {}
  paint()
}

function captureForkValues() {
  document.querySelectorAll('#fork-form [data-fork-key]').forEach(el => {
    state.forkValues[el.dataset.forkKey] = el.value
  })
}

async function submitFork(spanId) {
  captureForkValues()
  state.forkBusy = true
  state.forkError = null
  paint()
  try {
    state.forkResult = await api(`/traces/${state.trace.trace_id}/fork`, {
      method: 'POST',
      body: JSON.stringify({ span_id: spanId, inputs: { ...state.forkValues } }),
    })
    toast('Replay complete', 'ok')
  } catch (err) {
    state.forkError = err.message
  }
  state.forkBusy = false
  paint()
  loadTraces().then(renderRail).catch(() => {})
}

async function openRaw() {
  const raw = await api(`/traces/${state.trace.trace_id}/raw`)
  openDrawer(`Raw trace`, shortId(state.trace.trace_id),
    `<pre class="raw">${esc(JSON.stringify(raw, null, 2))}</pre>`)
}

// ── Pressure tests ────────────────────────────────────────────────────

async function loadPressure() {
  const [meta, prompts, runs, traces] = await Promise.all([
    api('/meta'), api('/prompts'), api('/pressure'),
    state.traces.length ? Promise.resolve(state.traces) : api('/traces'),
  ])
  state.meta = meta
  state.prompts = prompts
  state.runs = runs
  state.traces = traces
  renderRail()
  if (!state.pf) resetForm()
  if (state.run) {
    try { state.run = await api(`/pressure/${state.run.run_id}`) }
    catch { state.run = null }
  }
  if (!runs.length && !state.run) state.showForm = true
}

function resetForm(overrides = {}) {
  const withPrompt = state.prompts.find(p => p.prompt)
  state.pf = {
    name: '',
    prompt: withPrompt ? withPrompt.prompt : '',
    baselineTraceId: null,
    selected: state.traces.map(t => t.trace_id),
    checks: structuredClone(state.meta.default_checks),
    temperature: 0,
    concurrency: 2,
    busy: false,
    ...overrides,
  }
}

function toggleForm() {
  state.showForm = !state.showForm
  if (state.showForm && !state.pf) resetForm()
  paint()
}

function renderPressure() {
  if (!state.traces.length) {
    return empty('◈', 'Nothing to pressure test yet', `
      Pressure tests replay a candidate system prompt against traces you have
      already captured. Run your agent once with <code>replay.init()</code> first.`)
  }
  return `<div class="stack">
    ${state.showForm ? renderPressureForm() : ''}
    ${state.run ? renderRunDetail() : ''}
    ${renderRunList()}
  </div>`
}

function renderPressureForm() {
  const pf = state.pf
  const promptOptions = state.prompts.map((p, i) => {
    const label = p.prompt
      ? `${clip(p.prompt, 64)} — ${p.trace_count} trace${p.trace_count === 1 ? '' : 's'}`
      : `(${p.trace_count} trace${p.trace_count === 1 ? '' : 's'} with no system prompt)`
    return p.prompt ? `<option value="${i}">${esc(label)}</option>` : ''
  }).join('')

  const traceRows = state.traces.map(t => `
    <label class="check-row">
      <input type="checkbox" ${pf.selected.includes(t.trace_id) ? 'checked' : ''}
             onchange="toggleTrace('${t.trace_id}', this.checked)">
      <span class="check-row-body">
        <span class="check-row-title">${esc(clip(t.question, 78) || shortId(t.trace_id))}</span>
        <span class="check-row-desc">${esc(shortId(t.trace_id))} · ${t.llm_count} LLM ·
          ${t.tool_count} tools${t.system_prompt == null
            ? ' · <em>had no system prompt — this one gets added</em>' : ''}</span>
      </span>
    </label>`).join('')

  const checkRows = state.meta.checks.map(def => {
    const cfg = pf.checks[def.id] || {}
    let config = ''
    if (cfg.enabled && def.id === 'must_contain') {
      config = configInput(def.id, 'values', 'Tokyo, 13.9M', (cfg.values || []).join(', '), 'list')
    } else if (cfg.enabled && def.id === 'must_not_contain') {
      config = configInput(def.id, 'values', 'I cannot, as an AI', (cfg.values || []).join(', '), 'list')
    } else if (cfg.enabled && def.id === 'regex') {
      config = configInput(def.id, 'pattern', '\\d+\\s?(M|million)', cfg.pattern || '', 'text')
    } else if (cfg.enabled && def.id === 'similarity') {
      config = configInput(def.id, 'threshold', '0.4', cfg.threshold ?? 0.4, 'number')
    } else if (cfg.enabled && def.id === 'max_extra_llm_calls') {
      config = configInput(def.id, 'tolerance', '1', cfg.tolerance ?? 1, 'number')
    } else if (cfg.enabled && def.id === 'tools_preserved') {
      config = `<div class="check-config"><select onchange="setCheckConfig('${def.id}','mode',this.value)">
        <option value="superset" ${cfg.mode !== 'exact' ? 'selected' : ''}>still calls the original tools</option>
        <option value="exact" ${cfg.mode === 'exact' ? 'selected' : ''}>calls exactly the same tools</option>
      </select></div>`
    }
    return `<label class="check-row">
      <input type="checkbox" ${cfg.enabled ? 'checked' : ''}
             onchange="setCheckEnabled('${def.id}', this.checked)">
      <span class="check-row-body">
        <span class="check-row-title">${esc(def.label)}
          ${pill(def.severity === 'warn' ? 'warning' : 'blocking',
                 def.severity === 'warn' ? 'warn' : 'fail')}</span>
        <span class="check-row-desc">${esc(def.description)}</span>
        ${config}
      </span>
    </label>`
  }).join('')

  const selectedCount = pf.selected.length
  return `<div class="card">
    <div class="card-head">
      <span class="card-title">New pressure run</span>
      <span class="card-note">every selected trace is replayed with this prompt swapped in</span>
    </div>

    ${state.meta.tools_loaded ? '' : `
      <div class="banner banner-warn" style="margin-bottom:14px">
        <span class="banner-glyph">!</span>
        <div>No tools are registered in this server process, so replays can't call tools and
        tool-dependent checks will be skipped. Run your agent script once to write
        <code class="inline">.replay/tool_sources.py</code>, then restart the server.</div></div>`}
    ${state.meta.has_api_key ? '' : `
      <div class="banner banner-warn" style="margin-bottom:14px">
        <span class="banner-glyph">!</span>
        <div>No <code class="inline">OPENAI_API_KEY</code> in the server's environment. Replays make
        real model calls, so every trace will come back as an error until one is set.</div></div>`}

    <div class="grid grid-2">
      <div class="stack">
        <div class="field">
          <label>Start from an existing prompt</label>
          <select onchange="pickPrompt(this.value)">
            <option value="">— choose a prompt to edit —</option>
            ${promptOptions}
          </select>
        </div>
        <div class="field">
          <label>Candidate system prompt</label>
          <textarea class="prompt-box" rows="9" oninput="state.pf.prompt = this.value"
            placeholder="You are a concise trip-planning assistant…">${esc(pf.prompt)}</textarea>
        </div>
        <div class="row">
          <div class="field" style="flex:1">
            <label>Run name</label>
            <input type="text" value="${attr(pf.name)}" placeholder="terser answers v2"
                   oninput="state.pf.name = this.value">
          </div>
          <div class="field" style="width:104px">
            <label>Temp</label>
            <input type="number" step="0.1" min="0" max="2" value="${pf.temperature}"
                   oninput="state.pf.temperature = parseFloat(this.value) || 0">
          </div>
          <div class="field" style="width:104px">
            <label>Parallel</label>
            <input type="number" step="1" min="1" max="8" value="${pf.concurrency}"
                   oninput="state.pf.concurrency = parseInt(this.value) || 1">
          </div>
        </div>
      </div>

      <div class="stack">
        <div>
          <div class="card-head" style="margin-bottom:6px">
            <span class="card-title">Traces to test (${selectedCount}/${state.traces.length})</span>
            <span class="row">
              <button class="btn btn-sm btn-ghost" onclick="selectTraces('all')">All</button>
              <button class="btn btn-sm btn-ghost" onclick="selectTraces('prompt')">Sharing this prompt</button>
              <button class="btn btn-sm btn-ghost" onclick="selectTraces('none')">None</button>
            </span>
          </div>
          <div style="max-height:186px;overflow-y:auto">${traceRows}</div>
        </div>
        <div>
          <div class="card-title" style="margin-bottom:2px">Checks</div>
          <div>${checkRows}</div>
        </div>
      </div>
    </div>

    <div class="row" style="margin-top:16px">
      <button class="btn btn-primary" onclick="submitRun()"
        ${pf.busy || !selectedCount ? 'disabled' : ''}>
        ${pf.busy ? '<span class="spinner"></span> Starting…'
          : `Run against ${selectedCount} trace${selectedCount === 1 ? '' : 's'}`}</button>
      <span class="small faint">Each trace costs one full agent replay — real model calls.</span>
    </div>
  </div>`
}

function configInput(checkId, key, placeholder, value, kind) {
  const type = kind === 'number' ? 'number' : 'text'
  const step = kind === 'number' ? 'step="0.05"' : ''
  const parse = kind === 'number' ? 'parseFloat(this.value)'
    : kind === 'list' ? "this.value.split(',').map(s => s.trim()).filter(Boolean)"
    : 'this.value'
  return `<div class="check-config">
    <input type="${type}" ${step} value="${attr(value)}" placeholder="${attr(placeholder)}"
      oninput="setCheckConfig('${checkId}','${key}', ${parse})"></div>`
}

function setCheckEnabled(checkId, enabled) {
  state.pf.checks[checkId] = { ...(state.pf.checks[checkId] || {}), enabled }
  paint()
}

function setCheckConfig(checkId, key, value) {
  state.pf.checks[checkId] = { ...(state.pf.checks[checkId] || {}), [key]: value }
}

function pickPrompt(index) {
  if (index === '') return
  const bucket = state.prompts[Number(index)]
  if (!bucket || !bucket.prompt) return
  state.pf.prompt = bucket.prompt
  state.pf.selected = state.traces.map(t => t.trace_id)
  paint()
}

function toggleTrace(traceId, checked) {
  const set = new Set(state.pf.selected)
  checked ? set.add(traceId) : set.delete(traceId)
  state.pf.selected = state.traces.map(t => t.trace_id).filter(id => set.has(id))
  paint()
}

function selectTraces(mode) {
  if (mode === 'all') state.pf.selected = state.traces.map(t => t.trace_id)
  else if (mode === 'none') state.pf.selected = []
  else {
    const bucket = state.prompts.find(p => p.prompt === state.pf.prompt)
    state.pf.selected = bucket ? [...bucket.trace_ids]
      : state.traces.filter(t => t.system_prompt != null).map(t => t.trace_id)
  }
  paint()
}

async function submitRun() {
  const pf = state.pf
  if (!pf.prompt.trim()) { toast('A candidate system prompt is required', 'error'); return }
  pf.busy = true
  paint()
  try {
    const created = await api('/pressure', {
      method: 'POST',
      body: JSON.stringify({
        system_prompt: pf.prompt,
        trace_ids: pf.selected,
        checks: pf.checks,
        name: pf.name,
        temperature: pf.temperature,
        concurrency: pf.concurrency,
        baseline_trace_id: pf.baselineTraceId,
      }),
    })
    state.showForm = false
    state.runs = await api('/pressure')
    state.run = await api(`/pressure/${created.run_id}`)
    toast(`Running against ${created.trace_count} traces`, 'ok')
  } catch (err) {
    toast(err.message, 'error')
  }
  pf.busy = false
  paint()
  schedulePolling()
}

function renderRunList() {
  if (!state.runs.length) return ''
  return `<div class="card">
    <div class="card-head"><span class="card-title">Run history</span>
      <span class="card-note">${state.runs.length} run${state.runs.length === 1 ? '' : 's'}</span></div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Run</th><th>Verdict</th><th>Outcomes</th><th class="num">Traces</th>
        <th>Prompt</th><th>When</th><th></th>
      </tr></thead>
      <tbody>${state.runs.map(r => {
        const t = r.totals || {}
        return `<tr>
          <td><button class="btn btn-sm btn-ghost" onclick="openRun('${r.run_id}')">${esc(r.name)}</button>
            <div class="small faint">${esc(r.status)}${['queued', 'running'].includes(r.status)
              ? ' <span class="spinner"></span>' : ''}</div></td>
          <td>${statusPill(r.verdict)}</td>
          <td style="min-width:160px">
            <span class="small faint">
              ${['pass', 'warn', 'fail', 'error', 'skipped'].filter(k => t[k])
                .map(k => `<span class="check-glyph glyph-${k === 'error' ? 'fail' : k}">${STATUS_GLYPH[k]}</span>${t[k]} ${k}`)
                .join(' &nbsp; ') || '—'}</span></td>
          <td class="num">${r.trace_count}</td>
          <td class="small faint" style="max-width:280px">${esc(clip(r.system_prompt, 90))}</td>
          <td class="small faint">${ago(r.created_at)}</td>
          <td class="num">${['queued', 'running'].includes(r.status)
            ? `<button class="btn btn-sm btn-danger" onclick="cancelRun('${r.run_id}')">Cancel</button>`
            : `<button class="btn btn-sm btn-ghost" onclick="openRun('${r.run_id}')">Open</button>`}</td>
        </tr>`
      }).join('')}</tbody>
    </table></div>
  </div>`
}

function renderRunDetail() {
  const run = state.run
  const t = run.totals || {}
  const live = ['queued', 'running'].includes(run.status)

  const matrix = run.results.map((res, i) => `
    <button class="cell cell-${res.status}" onclick="openResult(${i})"
      title="${attr(`${shortId(res.trace_id)} — ${res.status}${res.error ? `: ${res.error}` : ''}`)}">
      ${STATUS_GLYPH[res.status] || ''}</button>`).join('')

  return `<div class="card">
    <div class="card-head">
      <div>
        <span class="card-title">${esc(run.name)}</span>
        <div class="small faint">${run.trace_ids.length} traces · started ${ago(run.started_at || run.created_at)}
          · ${esc(run.status)} ${live ? '<span class="spinner"></span>' : ''}</div>
      </div>
      <div class="row">
        ${statusPill(run.verdict)}
        ${live ? `<button class="btn btn-sm btn-danger" onclick="cancelRun('${run.run_id}')">Cancel</button>` : ''}
        <button class="btn btn-sm btn-ghost" onclick="closeRun()">Close</button>
      </div>
    </div>

    ${(run.notes || []).map(note => `<div class="banner banner-warn" style="margin-bottom:12px">
      <span class="banner-glyph">!</span><div>${esc(note)}</div></div>`).join('')}

    <div class="grid grid-tiles" style="margin-bottom:16px">
      ${tile('Verdict', `${STATUS_GLYPH[run.verdict] || ''} ${run.verdict}`,
             t.graded ? `${t.graded} of ${t.total} graded` : 'not graded yet')}
      ${tile('Passing', t.graded ? fmtPct(t.pass_rate) : '—', `${t.pass || 0} clean`)}
      ${tile('Failing', t.fail || 0, `${t.error || 0} errored`)}
      ${tile('Warnings', t.warn || 0, `${t.skipped || 0} skipped`)}
    </div>

    <div class="section-label">Outcome by trace</div>
    ${outcomeMeter(t)}
    <div class="matrix" style="margin-top:12px">${matrix}</div>

    <div class="section-label" style="margin-top:18px">Candidate prompt</div>
    <div class="blockquote mono-quote">${esc(run.system_prompt)}</div>

    <div class="section-label" style="margin-top:18px">Per-trace results</div>
    ${run.results.map((res, i) => renderResultCard(res, i)).join('')}
  </div>`
}

function renderResultCard(res, index) {
  const failing = res.checks.filter(c => ['fail', 'error'].includes(c.status))
  const warning = res.checks.filter(c => c.status === 'warn')
  const shown = failing.length || warning.length ? [...failing, ...warning] : res.checks.slice(0, 2)

  return `<div class="result-card">
    <div class="row">
      <span class="check-glyph glyph-${res.status === 'error' ? 'fail' : res.status}">
        ${STATUS_GLYPH[res.status] || ''}</span>
      <div class="list-main">
        <div class="list-title trunc">${esc(clip(res.question, 88) || shortId(res.trace_id))}</div>
        <div class="list-sub">${esc(shortId(res.trace_id))}
          ${res.duration_ms ? ` · ${fmtMs(res.duration_ms)}` : ''}
          ${res.error ? ` · ${esc(res.error)}` : ''}</div>
      </div>
      ${statusPill(res.status)}
      <button class="btn btn-sm btn-ghost" onclick="openResult(${index})">Details</button>
    </div>
    ${shown.length ? `<div class="checks">${shown.map(renderCheckLine).join('')}</div>` : ''}
  </div>`
}

function renderCheckLine(check) {
  const glyph = check.status === 'error' ? 'fail' : check.status
  return `<div class="check-line">
    <span class="check-glyph glyph-${glyph}">${STATUS_GLYPH[check.status] || ''}</span>
    <span class="check-label">${esc(check.label)}</span>
    <span class="check-detail">${esc(check.detail)}</span>
  </div>`
}

async function openRun(runId) {
  if (state.view !== 'pressure') {
    await go('pressure')
  }
  try {
    state.run = await api(`/pressure/${runId}`)
    state.showForm = false
  } catch (err) {
    toast(err.message, 'error')
    return
  }
  paint()
  schedulePolling()
}

function closeRun() { state.run = null; paint() }

async function cancelRun(runId) {
  try {
    await api(`/pressure/${runId}/cancel`, { method: 'POST' })
    toast('Cancelling — in-flight traces will finish', 'ok')
  } catch (err) { toast(err.message, 'error') }
}

function openResult(index) {
  const res = state.run.results[index]
  const body = `
    <div class="stack">
      <div class="row row-wrap">
        ${statusPill(res.status)}
        <span class="mono faint">${esc(res.trace_id)}</span>
      </div>
      ${res.error ? `<div class="banner banner-warn"><span class="banner-glyph">!</span>
        <div>${esc(res.error)}</div></div>` : ''}
      ${res.question ? `<div><div class="section-label">Question</div>
        <div class="blockquote">${esc(res.question)}</div></div>` : ''}
      ${res.checks.length ? `<div><div class="section-label">Checks</div>
        <div class="checks">${res.checks.map(renderCheckLine).join('')}</div></div>` : ''}
      ${res.old_system_prompt != null ? `<div>
        <div class="section-label">Prompt before</div>
        <div class="blockquote mono-quote before">${esc(res.old_system_prompt)}</div>
        <div class="section-label" style="margin-top:10px">Prompt after</div>
        <div class="blockquote mono-quote after">${esc(state.run.system_prompt)}</div></div>` : ''}
      ${res.original ? `<div class="diff-body">
        <div><div class="diff-side-label">Original answer</div>
          <div class="blockquote before">${esc(res.original.final_output || '—')}</div>
          <div class="small faint" style="margin-top:6px">
            ${res.original.llm_calls} LLM calls · tools: ${esc(res.original.tools.join(', ') || 'none')}</div></div>
        <div><div class="diff-side-label">Replayed answer</div>
          <div class="blockquote after">${esc(res.replay?.final_output || '—')}</div>
          <div class="small faint" style="margin-top:6px">
            ${res.replay?.llm_calls ?? 0} LLM calls · tools: ${esc(res.replay?.tools.join(', ') || 'none')}</div></div>
      </div>` : ''}
      ${res.replay_id ? `<div><button class="btn btn-sm"
        onclick="openDiff('${res.replay_id}')">Open the full span diff</button></div>` : ''}
    </div>`
  openDrawer('Pressure result', shortId(res.trace_id), body)
}

function pressureFromTrace() {
  const t = state.trace
  if (!t || t.system_prompt == null) {
    toast('This trace has no system prompt to test', 'error')
    return
  }
  startPressureWith(t.system_prompt, t.trace_id)
}

function pressureFromFork() {
  startPressureWith(state.forkValues.system, state.trace?.trace_id)
}

async function startPressureWith(prompt, baselineTraceId) {
  await go('pressure')
  resetForm({ prompt, baselineTraceId, selected: state.traces.map(t => t.trace_id) })
  state.showForm = true
  state.run = null
  paint()
  document.getElementById('view').scrollTop = 0
}

// ── Replay log ────────────────────────────────────────────────────────

async function loadReplays() {
  const [meta, replays] = await Promise.all([api('/meta'), api('/replays')])
  state.meta = meta
  state.replays = replays
  renderRail()
}

function renderReplays() {
  if (!state.replays.length) {
    return empty('↺', 'No replays yet', `
      Fork a span from the <a href="#traces" onclick="go('traces')">Traces</a> view, or run a
      pressure test — every replay is logged here with its diff.`)
  }
  return `<div class="card">
    <div class="card-head"><span class="card-title">Played replays</span>
      <span class="card-note">newest first · click a row for the diff</span></div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Replay</th><th>Source</th><th>Forked at</th><th>Changed</th>
        <th>New answer</th><th class="num">Spans</th><th>When</th>
      </tr></thead>
      <tbody>${state.replays.map(r => `
        <tr>
          <td><button class="btn btn-sm btn-ghost mono"
            onclick="openDiff('${r.replay_id}')">${esc(shortId(r.replay_id))}</button>
            <div class="small faint mono">from ${esc(shortId(r.original_trace_id))}</div></td>
          <td>${pill(r.source, r.source === 'pressure' ? 'forked' : 'downstream')}
            ${r.label ? `<div class="small faint">${esc(clip(r.label, 26))}</div>` : ''}</td>
          <td class="small">${pill(r.fork_span_type || 'span', r.fork_span_type || 'span')}
            <div class="small faint">${esc(clip(r.fork_span_name, 24))}</div></td>
          <td class="small">${r.changes.length
            ? r.changes.map(c => `<div><span class="mono">${esc(c.field)}</span>
                <span class="faint">→ ${esc(clip(c.after, 40))}</span></div>`).join('')
            : '<span class="faint">—</span>'}</td>
          <td class="small faint" style="max-width:260px">${esc(clip(r.final_output, 90)) || '—'}</td>
          <td class="num">${r.span_count}</td>
          <td class="small faint">${ago(r.replayed_at)}</td>
        </tr>`).join('')}</tbody>
    </table></div>
  </div>`
}

async function openDiff(replayId) {
  openDrawer('Replay diff', shortId(replayId),
    `<p class="muted small"><span class="spinner"></span> Building diff…</p>`)
  let diff
  try {
    diff = await api(`/replays/${replayId}/diff`)
  } catch (err) {
    document.getElementById('drawer-body').innerHTML =
      `<div class="banner banner-warn"><span class="banner-glyph">!</span><div>${esc(err.message)}</div></div>`
    return
  }

  const rows = diff.rows.map(row => {
    const showSides = row.changed || row.fields.length
    return `<div class="diff-row">
      <div class="diff-head">
        ${pill(row.replay_type, row.replay_type)}
        ${pill(row.span_type, row.span_type)}
        <span class="span-name">${esc(row.name)}</span>
        <span class="span-meta">${row.note ? `${esc(row.note)} · ` : ''}${fmtMs(row.duration_ms)}</span>
      </div>
      ${row.fields.length ? row.fields.map(f => `
        <div class="diff-body">
          <div><div class="diff-side-label">${esc(f.field)} before</div>
            <div class="blockquote before mono-quote">${esc(f.before || '—')}</div></div>
          <div><div class="diff-side-label">${esc(f.field)} after</div>
            <div class="blockquote after mono-quote">${esc(f.after || '—')}</div></div>
        </div>`).join('') : ''}
      ${showSides && !row.fields.length ? `
        <div class="diff-body">
          <div><div class="diff-side-label">Before</div>
            <div class="blockquote before">${esc(clip(row.before, 700) || '—')}</div></div>
          <div><div class="diff-side-label">After</div>
            <div class="blockquote after">${esc(clip(row.after, 700) || '—')}</div></div>
        </div>` : ''}
    </div>`
  }).join('')

  document.getElementById('drawer-body').innerHTML = `
    <div class="stack">
      <div class="row row-wrap">
        ${pill(diff.source, diff.source === 'pressure' ? 'forked' : 'downstream')}
        <span class="small faint">${esc(diff.summary)}</span>
      </div>
      <div class="diff-body">
        <div><div class="diff-side-label">Original answer</div>
          <div class="blockquote before">${esc(diff.final_before || '—')}</div></div>
        <div><div class="diff-side-label">Replayed answer</div>
          <div class="blockquote after">${esc(diff.final_after || '—')}</div></div>
      </div>
      <div>
        <div class="section-label">Spans</div>
        <div class="banner banner-info"><span class="banner-glyph">i</span><div>
          <b>cached</b> reused from the original · <b>forked</b> the step you changed ·
          <b>downstream</b> re-executed after the fork point</div></div>
        <div style="margin-top:10px">${rows}</div>
      </div>
    </div>`
}

// ── Tools ─────────────────────────────────────────────────────────────

async function loadTools() {
  const [meta, tools] = await Promise.all([api('/meta'), api('/tools')])
  state.meta = meta
  state.tools = tools
  renderRail()
}

function renderTools() {
  const { tools, sources_exist, sources_file } = state.tools
  if (!tools.length) {
    return empty('⚙', 'No tools registered', `
      Decorate your tools with <code>@replay.tool(safe=True)</code> and run the script once.
      Replay snapshots their source into <code>${esc(sources_file)}</code> so replays and
      pressure tests can re-run them for real.`)
  }
  return `<div class="stack">
    ${sources_exist ? '' : `<div class="banner banner-warn"><span class="banner-glyph">!</span>
      <div>No <code class="inline">${esc(sources_file)}</code> on disk — replays can't run tools
      for real until your agent script has been run once.</div></div>`}
    <div class="card">
      <div class="card-head"><span class="card-title">Tool registry</span>
        <span class="card-note">${tools.length} tool${tools.length === 1 ? '' : 's'}</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Tool</th><th>Arguments</th><th>Description</th>
          <th>On replay</th><th>Saved preference</th></tr></thead>
        <tbody>${tools.map(t => `
          <tr>
            <td class="mono">${esc(t.name)}</td>
            <td class="small faint mono">${esc(t.parameters.join(', ') || '—')}</td>
            <td class="small faint" style="max-width:300px">${esc(clip(t.description, 110) || '—')}</td>
            <td>${t.can_run_real ? pill('runs for real', 'pass')
              : t.has_alternative ? pill('alternative', 'warn') : pill('asks / skips', 'skipped')}</td>
            <td><select onchange="setToolPreference('${attr(t.name)}', this.value)">
              <option value="" ${!t.preference ? 'selected' : ''}>— none —</option>
              <option value="run" ${t.preference === 'run' ? 'selected' : ''}>always run</option>
              <option value="skip" ${t.preference === 'skip' ? 'selected' : ''}>always skip</option>
              <option value="alternative" ${t.preference === 'alternative' ? 'selected' : ''}>always alternative</option>
            </select></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>`
}

async function setToolPreference(name, preference) {
  try {
    await api(`/tools/${encodeURIComponent(name)}/preference`, {
      method: 'POST',
      body: JSON.stringify({ preference: preference || null }),
    })
    toast(`${name}: ${preference || 'preference cleared'}`, 'ok')
    await loadTools()
    paint()
  } catch (err) { toast(err.message, 'error') }
}

// ── Drawer ────────────────────────────────────────────────────────────

function openDrawer(title, sub, bodyHtml) {
  document.getElementById('drawer-title').textContent = title
  document.getElementById('drawer-sub').textContent = sub
  document.getElementById('drawer-body').innerHTML = bodyHtml
  document.getElementById('drawer').hidden = false
}

function closeDrawer() { document.getElementById('drawer').hidden = true }

// ── Boot ──────────────────────────────────────────────────────────────

document.querySelectorAll('.rail-item').forEach(el =>
  el.addEventListener('click', () => go(el.dataset.view)))

document.getElementById('refresh-btn').addEventListener('click', () => go(state.view))

document.addEventListener('click', event => {
  if (event.target.closest('[data-close-drawer]')) closeDrawer()
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeDrawer()
})
window.addEventListener('hashchange', () => {
  const view = location.hash.replace('#', '')
  if (view && view !== state.view) go(view)
})

go(location.hash.replace('#', '') || 'overview')
