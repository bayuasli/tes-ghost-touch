const zone = document.getElementById('zone');
const hint = document.getElementById('hint');
const logPanel = document.getElementById('log-panel');

const COLORS = ['#00e5ff', '#ff3d71', '#39ff14', '#ffaa00', '#bf7fff'];

let totalTouches = 0;
let maxSimultaneous = 0;
let sessionStart = null;
let holdDurations = [];
let touchStarts = {};
let lastTouchTime = null;
let intervals = [];
let peakRate = 0;
let rateWindow = [];
let rafId = null;

function now() {
  return performance.now();
}

function addLog(type, detail) {
  const ts = sessionStart ? ((now() - sessionStart) / 1000).toFixed(2) : '0.00';
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="ts">${ts}s</span><span class="ev">${type}</span><span class="detail">${detail}</span>`;
  logPanel.appendChild(entry);
  logPanel.scrollTop = logPanel.scrollHeight;
  if (logPanel.children.length > 200) logPanel.removeChild(logPanel.firstChild);
}

function updateFingerPips(count) {
  for (let i = 0; i < 5; i++) {
    document.getElementById('fp' + i).classList.toggle('active', i < count);
  }
}

function updateStats() {
  const elapsed = sessionStart ? (now() - sessionStart) / 1000 : 0;

  document.getElementById('s-total').textContent = totalTouches;
  document.getElementById('s-dur').textContent = elapsed.toFixed(1);
  document.getElementById('s-multi').textContent = maxSimultaneous;

  const cutoff = now() - 1000;
  rateWindow = rateWindow.filter(t => t > cutoff);
  const currentRate = rateWindow.length;
  document.getElementById('s-rate').textContent = currentRate;

  if (currentRate > peakRate) {
    peakRate = currentRate;
    document.getElementById('s-peak').textContent = peakRate;
  }

  document.getElementById('speed-bar').style.width = Math.min(currentRate / 20 * 100, 100) + '%';

  if (holdDurations.length > 0) {
    const avg = holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length;
    document.getElementById('s-hold').textContent = avg.toFixed(0);
  }

  if (intervals.length > 0) {
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    document.getElementById('s-interval').textContent = avg.toFixed(0);
  }
}

function spawnRipple(x, y, colorIdx) {
  const color = COLORS[colorIdx % COLORS.length];

  const r = document.createElement('div');
  r.className = 'ripple';
  r.style.cssText = `left:${x}px;top:${y}px;width:60px;height:60px;border:2px solid ${color};box-shadow:0 0 10px ${color};`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());

  const dot = document.createElement('div');
  dot.className = 'touch-dot';
  dot.style.cssText = `left:${x}px;top:${y}px;width:16px;height:16px;background:${color};box-shadow:0 0 12px ${color};`;
  zone.appendChild(dot);
  dot.addEventListener('animationend', () => dot.remove());
}

function startLoop() {
  function loop() {
    updateStats();
    rafId = requestAnimationFrame(loop);
  }
  loop();
}

// Touch events
zone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  hint.classList.add('hidden');

  if (!sessionStart) {
    sessionStart = now();
    startLoop();
  }

  const activeTouches = e.touches.length;
  if (activeTouches > maxSimultaneous) maxSimultaneous = activeTouches;
  updateFingerPips(activeTouches);

  const rect = zone.getBoundingClientRect();

  for (const t of e.changedTouches) {
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    const ts = now();

    totalTouches++;
    rateWindow.push(ts);
    touchStarts[t.identifier] = ts;

    if (lastTouchTime !== null) {
      intervals.push(ts - lastTouchTime);
      if (intervals.length > 100) intervals.shift();
    }
    lastTouchTime = ts;

    spawnRipple(x, y, t.identifier);
    addLog('TOUCH↓', `id:${t.identifier} pos:(${x.toFixed(0)},${y.toFixed(0)}) fingers:${activeTouches}`);
  }

  updateStats();
}, { passive: false });

zone.addEventListener('touchend', (e) => {
  e.preventDefault();

  for (const t of e.changedTouches) {
    if (touchStarts[t.identifier] !== undefined) {
      const dur = now() - touchStarts[t.identifier];
      holdDurations.push(dur);
      if (holdDurations.length > 100) holdDurations.shift();
      addLog('TOUCH↑', `id:${t.identifier} hold:${dur.toFixed(0)}ms fingers:${e.touches.length}`);
      delete touchStarts[t.identifier];
    }
  }

  updateFingerPips(e.touches.length);
  updateStats();
}, { passive: false });

zone.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

// Mouse fallback
zone.addEventListener('mousedown', (e) => {
  hint.classList.add('hidden');
  if (!sessionStart) { sessionStart = now(); startLoop(); }

  const rect = zone.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const ts = now();

  totalTouches++;
  rateWindow.push(ts);
  touchStarts['mouse'] = ts;

  if (lastTouchTime !== null) intervals.push(ts - lastTouchTime);
  if (intervals.length > 100) intervals.shift();
  lastTouchTime = ts;

  spawnRipple(x, y, 0);
  addLog('CLICK↓', `pos:(${x.toFixed(0)},${y.toFixed(0)})`);
  updateStats();
});

zone.addEventListener('mouseup', () => {
  if (touchStarts['mouse'] !== undefined) {
    const dur = now() - touchStarts['mouse'];
    holdDurations.push(dur);
    addLog('CLICK↑', `hold:${dur.toFixed(0)}ms`);
    delete touchStarts['mouse'];
    updateStats();
  }
});

// Controls
function resetAll() {
  totalTouches = 0;
  maxSimultaneous = 0;
  sessionStart = null;
  holdDurations = [];
  touchStarts = {};
  lastTouchTime = null;
  intervals = [];
  peakRate = 0;
  rateWindow = [];

  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  hint.classList.remove('hidden');
  logPanel.innerHTML = '';
  updateFingerPips(0);
  document.getElementById('speed-bar').style.width = '0%';

  ['s-total', 's-rate', 's-multi', 's-peak'].forEach(id => {
    document.getElementById(id).textContent = '0';
  });
  document.getElementById('s-dur').textContent = '0.0';
  document.getElementById('s-hold').textContent = '0';
  document.getElementById('s-interval').textContent = '—';
}

function exportData() {
  const elapsed = sessionStart ? (now() - sessionStart) / 1000 : 0;
  const avgHold = holdDurations.length
    ? (holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length).toFixed(1)
    : 0;
  const avgInterval = intervals.length
    ? (intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1)
    : 0;

  const data = {
    total_touches: totalTouches,
    duration_s: elapsed.toFixed(2),
    avg_tap_per_s: elapsed > 0 ? (totalTouches / elapsed).toFixed(2) : 0,
    peak_tap_per_s: peakRate,
    max_simultaneous_fingers: maxSimultaneous,
    avg_hold_ms: avgHold,
    avg_interval_ms: avgInterval,
    timestamp: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'touch-data.json';
  a.click();
}
