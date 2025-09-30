// ==UserScript==
// @name         Pr0Plug
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Connect to Intiface Central and control devices from any page
// @author       crispy
// @match        https://pr0gramm.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pr0gramm.com
// @require      https://cdn.jsdelivr.net/npm/buttplug@3/dist/web/buttplug.min.js
// @grant        none
// ==/UserScript==



(function () {
    'use strict';

    // Change this if your Intiface Central websocket port differs.
    // Use wss://127.0.0.1:12346 if you've enabled TLS.
    const DEFAULT_WS = 'ws://127.0.0.1:12345';

    // Allow override via localStorage so you don't need to edit the script:
    // localStorage.setItem('tm_buttplug_ws', 'ws://127.0.0.1:12345')
    const WS_URL = localStorage.getItem('tm_buttplug_ws') || DEFAULT_WS;

    const Buttplug = window.Buttplug || window.buttplug;
    if (!Buttplug) {
      console.error('[TM-Buttplug] Buttplug library not found.');
      return;
    }

    const client = new Buttplug.ButtplugClient('Pr0Plug');
    let isConnecting = false;

    // UI
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:2147483647',
      'background:#111',
      'color:#fff',
      'font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      'border:1px solid #333',
      'border-radius:8px',
      'padding:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,0.35)',
      'max-width:260px',
      'min-width:220px',
      'user-select:none',
    ].join(';');

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong>Pr0Plug</strong>
        <button id="bp-minimize" style="background:#222;color:#bbb;border:1px solid #444;border-radius:6px;padding:2px 6px;cursor:pointer">−</button>
      </div>
      <div id="bp-content" style="margin-top:8px">
        <div style="margin-bottom:6px">WS: <code style="color:#9cf">${WS_URL}</code></div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="bp-connect" style="flex:1;background:#2d6cdf;color:#fff;border:0;border-radius:6px;padding:6px;cursor:pointer">Connect</button>
          <button id="bp-scan" style="flex:1;background:#1f8b4c;color:#fff;border:0;border-radius:6px;padding:6px;cursor:pointer">Scan</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <input id="bp-strength" type="range" min="0" max="100" value="40" style="flex:1">
          <span id="bp-strength-val" style="width:32px;text-align:right">40%</span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="bp-vibe" style="flex:1;background:#b158e6;color:#fff;border:0;border-radius:6px;padding:6px;cursor:pointer">Vibrate</button>
          <button id="bp-stop" style="flex:1;background:#a33;color:#fff;border:0;border-radius:6px;padding:6px;cursor:pointer">Stop</button>
        </div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer">
        <input id="bp-auto" type="checkbox">
        <span>Auto Pattern by Post ID</span>
        <span id="bp-postid" style="margin-left:auto;color:#889"></span>
      </label>
      <div style="margin-bottom:8px">
        <div style="color:#889;font-size:11px;margin-bottom:4px">Pattern</div>
        <div id="bp-pattern" style="height:40px;background:#0b0b0b;border:1px solid #222;border-radius:6px;padding:4px;display:flex;align-items:flex-end;gap:3px;overflow:hidden"></div>
        <div id="bp-pattern-info" style="color:#889;font-size:11px;margin-top:4px"></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <span style="width:48px;color:#889;font-size:11px">Cycle</span>
          <input id="bp-pattern-seconds" type="range" min="2" max="30" step="1" value="12" style="flex:1">
          <span id="bp-pattern-seconds-val" style="width:36px;text-align:right;color:#bbb">12s</span>
        </div>
      </div>
        <div id="bp-status" style="color:#9cf;margin-bottom:6px">Disconnected</div>
        <div id="bp-devices" style="max-height:120px;overflow:auto;background:#0b0b0b;border:1px solid #222;border-radius:6px;padding:6px"></div>

        <label style="display:flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer">
          <input id="bp-adv-toggle" type="checkbox">
          <span>Advanced Settings</span>
        </label>
        <div id="bp-adv" style="display:none;margin-top:8px;background:#0b0b0b;border:1px solid #222;border-radius:6px;padding:8px;max-height:180px;overflow:auto"></div>
        <div style="margin-top:6px;color:#889">Tip: set ws via localStorage key <code>tm_buttplug_ws</code></div>
      </div>
    `;
    document.documentElement.appendChild(panel);

    const $ = (id) => panel.querySelector(id);
    const el = {
      minimize: $('#bp-minimize'),
      content: $('#bp-content'),
      connect: $('#bp-connect'),
      scan: $('#bp-scan'),
      strength: $('#bp-strength'),
      strengthVal: $('#bp-strength-val'),
      vibe: $('#bp-vibe'),
      stop: $('#bp-stop'),
      auto: $('#bp-auto'),
      status: $('#bp-status'),
      devices: $('#bp-devices'),
      postId: $('#bp-postid'),
      pattern: $('#bp-pattern'),
      patternInfo: $('#bp-pattern-info'),
      patternSeconds: $('#bp-pattern-seconds'),
      patternSecondsVal: $('#bp-pattern-seconds-val'),
      // Capability inputs moved to Advanced panel; queried dynamically
      advToggle: $('#bp-adv-toggle'),
      adv: $('#bp-adv'),
    };

    let isMinimized = false;
    function toggleMinimize() {
      isMinimized = !isMinimized;
      if (el.minimize) el.minimize.textContent = isMinimized ? '+' : '−';
      if (el.content) el.content.style.display = isMinimized ? 'none' : 'block';
    }

    function setStatus(text, color = '#9cf') {
      el.status.textContent = text;
      el.status.style.color = color;
      console.log('[TM-Buttplug]', text);
    }

    function getCurrentPostId() {
      try {
        const path = location.pathname || '';
        const parts = path.split('/').filter(Boolean);
        const last = parts[parts.length - 1] || '';
        const match = last.match(/^\d+$/);
        return match ? Number(match[0]) : null;
      } catch (_) {
        return null;
      }
    }

    function updatePostIdLabel() {
      const id = getCurrentPostId();
      el.postId.textContent = id ? `#${id}` : '';
      renderPatternPreview();
    }

    // Simple seeded RNG (xorshift32)
    function createRng(seedNumber) {
      let state = (seedNumber >>> 0) || 1;
      return function next() {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        // Convert to [0,1)
        return ((state >>> 0) / 4294967296);
      };
    }

    function buildPatternFromId(postId) {
      const rng = createRng(postId);
      const length = 8 + Math.floor(rng() * 6); // 8-13 segments
      const segments = [];
      for (let i = 0; i < length; i++) {
        const duration = 350 + Math.floor(rng() * 900); // 350-1250 ms
        // Bias a little towards mid-high intensities
        const r = rng();
        const intensity = Math.min(1, Math.max(0.1, Math.pow(r, 0.6)));
        segments.push({ duration, intensity });
      }
      return segments;
    }

    let currentPattern = [];
    let currentPatternIndex = -1;

    function renderPatternPreview() {
      const id = getCurrentPostId();
      if (!el.pattern) return;
      const base = strengthFloat();
      if (!id) {
        el.pattern.innerHTML = '';
        el.patternInfo.textContent = '';
        return;
      }
      const pattern = buildPatternFromId(id);
      const total = pattern.reduce((a, s) => a + s.duration, 0) || 1;
      const desiredMs = getPatternTotalMs();
      const scale = desiredMs / total;
      el.pattern.innerHTML = pattern
        .map((s, idx) => {
          const height = Math.max(6, Math.round(s.intensity * base * 36));
          const width = Math.max(6, Math.round((s.duration / total) * 220));
          const active = idx === currentPatternIndex && el.auto.checked;
          const bg = active ? '#2d6cdf' : '#444';
          return `<div title="${Math.round(s.intensity * 100)}% • ${s.duration}ms" style="height:${height}px;width:${width}px;background:${bg};border-radius:3px"></div>`;
        })
        .join('');
      el.patternInfo.textContent = `Segments: ${pattern.length} • Base ${Math.round(base * 100)}% • Cycle ${(desiredMs/1000)|0}s`;
    }

    function delay(ms) {
      return new Promise((res) => setTimeout(res, ms));
    }

    // Pattern cycle duration (seconds) persistence
    const PATTERN_SEC_KEY = 'bp_pattern_seconds_v1';
    function getPatternTotalMs() {
      const sec = Math.max(2, Math.min(30, Number(localStorage.getItem(PATTERN_SEC_KEY) || el.patternSeconds?.value || 12)));
      return sec * 1000;
    }
    function loadPatternSecondsToUI() {
      try {
        const sec = Number(localStorage.getItem(PATTERN_SEC_KEY));
        if (el.patternSeconds && isFinite(sec) && sec >= 2 && sec <= 30) el.patternSeconds.value = String(sec);
      } catch (_) {}
    }

    // Per-device capabilities as reported by Intiface/Buttplug
    const deviceCaps = new Map(); // device.index -> { vib, rot, lin, air, osc }
    function extractCapsFromAttributes(attrs) {
      let keyList = [];
      if (!attrs) attrs = {};
      if (Array.isArray(attrs)) {
        keyList = attrs.map(String);
      } else {
        keyList = Object.keys(attrs);
        // Some libs nest under MessageAttributes or similar
        if (keyList.length === 0) {
          const nested = attrs.MessageAttributes || attrs.messageattributes;
          if (nested && typeof nested === 'object') keyList = Object.keys(nested);
        }
      }
      const norm = keyList.map((k) => String(k).toLowerCase());
      const hasCI = (needle) => norm.some((k) => k.includes(String(needle).toLowerCase()));
      const caps = {
        vib: false,
        rot: false,
        lin: false,
        air: false,
        osc: false,
      };
      // Direct matches
      if (hasCI('vibrate')) caps.vib = true;
      if (hasCI('rotate')) caps.rot = true;
      if (hasCI('linear') || hasCI('position')) caps.lin = true;
      if (hasCI('air') || hasCI('pressure') || hasCI('suction')) caps.air = true;
      if (hasCI('oscillate') || hasCI('oscillation')) caps.osc = true;

      // ScalarCmd style (if present), try to infer by child keys/values
      const scalar = attrs.ScalarCmd || attrs.scalarcmd || attrs.Scalar || attrs.scalar;
      if (scalar) {
        const sKeys = Array.isArray(scalar) ? scalar.map(String) : Object.keys(scalar);
        const sNorm = sKeys.map((k) => String(k).toLowerCase());
        if (sNorm.some((k) => k.includes('vibrate'))) caps.vib = true;
        if (sNorm.some((k) => k.includes('oscill'))) caps.osc = true;
      }
      return caps;
    }
    function readDeviceAttributes(device) {
      const attrs = device.messageAttributes || device._messageAttributes || device._allowedMessages || device.allowedMessages || {};
      return extractCapsFromAttributes(attrs);
    }
    function updateCapsForDevice(device) {
      try {
        const caps = readDeviceAttributes(device);
        // Fallback: if nothing detected, derive from method presence
        if (!caps.vib && !caps.rot && !caps.lin && !caps.air && !caps.osc) {
          deviceCaps.set(device.index, {
            vib: typeof device.vibrate === 'function',
            rot: typeof device.rotate === 'function',
            lin: typeof device.linear === 'function',
            air: typeof device.air === 'function',
            osc: typeof device.oscillate === 'function',
          });
        } else {
          deviceCaps.set(device.index, caps);
        }
      } catch (_) {
        deviceCaps.set(device.index, {
          vib: typeof device.vibrate === 'function',
          rot: typeof device.rotate === 'function',
          lin: typeof device.linear === 'function',
          air: typeof device.air === 'function',
          osc: typeof device.oscillate === 'function',
        });
      }
    }

    // Capabilities persistence
    const CAPS_KEY = 'bp_caps_v1';
    function loadCaps() {
      try {
        const v = JSON.parse(localStorage.getItem(CAPS_KEY) || '{}');
        return {
          vib: v.vib !== false, // default true
          rot: v.rot !== false,
          lin: v.lin !== false,
          air: v.air !== false,
          osc: v.osc !== false,
        };
      } catch (_) {
        return { vib: true, rot: true, lin: true, air: true, osc: true };
      }
    }
    function saveCaps(c) {
      localStorage.setItem(CAPS_KEY, JSON.stringify(c));
    }
    function getCaps() {
      const root = el.adv || panel;
      const q = (id) => root.querySelector(id);
      const vibEl = q('#bp-cap-vib');
      const rotEl = q('#bp-cap-rot');
      const linEl = q('#bp-cap-lin');
      const airEl = q('#bp-cap-air');
      const oscEl = q('#bp-cap-osc');
      if (!vibEl && !rotEl && !linEl && !airEl && !oscEl) {
        // Fallback to saved settings if controls not rendered
        return loadCaps();
      }
      return {
        vib: !!vibEl?.checked,
        rot: !!rotEl?.checked,
        lin: !!linEl?.checked,
        air: !!airEl?.checked,
        osc: !!oscEl?.checked,
      };
    }
    function applyCapsToUI() {
      const c = loadCaps();
      const root = el.adv || panel;
      const set = (id, val) => { const n = root.querySelector(id); if (n) n.checked = val; };
      set('#bp-cap-vib', c.vib !== false);
      set('#bp-cap-rot', c.rot !== false);
      set('#bp-cap-lin', c.lin !== false);
      set('#bp-cap-air', c.air !== false);
      set('#bp-cap-osc', c.osc !== false);
    }
    function wireCapsUI() {
      const root = el.adv || panel;
      const handler = () => saveCaps(getCaps());
      ['#bp-cap-vib','#bp-cap-rot','#bp-cap-lin','#bp-cap-air','#bp-cap-osc'].forEach((sel) => {
        const n = root.querySelector(sel);
        if (n) n.addEventListener('change', handler);
      });
    }

    async function actuateAllAt(intensity) {
      if (!client.connected) return false;
      const devices = Array.from(client.devices.values());
      if (devices.length === 0) return false;
      let acted = 0;
      const caps = getCaps();
      for (const d of devices) {
        try {
          const limited = applyDeviceLimits(d, Math.max(0, Math.min(1, intensity)));
          const dc = deviceCaps.get(d.index) || readDeviceAttributes(d);
          // Vibrate
          if (caps.vib && dc.vib && typeof d.vibrate === 'function') {
            await d.vibrate(limited);
            acted++;
          }
          // Rotate (speed 0..1, default clockwise)
          if (caps.rot && dc.rot && typeof d.rotate === 'function') {
            try { await d.rotate(limited); acted++; } catch (_) {}
          }
          // Linear stroke: alternate between per-device min/max position with duration based on intensity
          if (caps.lin && dc.lin && typeof d.linear === 'function') {
            if (!window.__bpLinearNextEnd) window.__bpLinearNextEnd = new Map();
            const map = window.__bpLinearNextEnd;
            const prev = map.has(d.index) ? map.get(d.index) : 0;
            const lim = getDeviceLimits(d);
            const low = Math.max(0, Math.min(1, Number(lim.min) || 0));
            const high = Math.max(low, Math.min(1, Number(lim.max) || 1));
            const targetPos = prev ? low : high;
            map.set(d.index, targetPos);
            const duration = Math.max(150, Math.round(1000 - 800 * limited));
            try { await d.linear(targetPos, duration); acted++; } catch (_) {}
          }
          // Air (suction/pressure 0..1)
          if (caps.air && dc.air && typeof d.air === 'function') {
            try { await d.air(limited); acted++; } catch (_) {}
          }
          // Oscillate (amplitude/speed 0..1)
          if (caps.osc && dc.osc && typeof d.oscillate === 'function') {
            try { await d.oscillate(limited); acted++; } catch (_) {}
          }
        } catch (_) {}
      }
      return acted > 0;
    }

    // Advanced per-device limits storage and rendering
    const ADV_KEY = 'bp_adv_limits_v1';
    function loadAdv() {
      try {
        return JSON.parse(localStorage.getItem(ADV_KEY) || '{}');
      } catch (_) {
        return {};
      }
    }
    function saveAdv(data) {
      localStorage.setItem(ADV_KEY, JSON.stringify(data));
    }
    function getDeviceKey(d) {
      return String(d.index);
    }
    function getDeviceLimits(d) {
      const all = loadAdv();
      const key = getDeviceKey(d);
      const entry = all[key] || { min: 0, max: 1 };
      let min = Number(entry.min);
      let max = Number(entry.max);
      if (!isFinite(min)) min = 0;
      if (!isFinite(max)) max = 1;
      min = Math.max(0, Math.min(1, min));
      max = Math.max(0, Math.min(1, max));
      if (min > max) [min, max] = [max, min];
      return { min, max };
    }
    function setDeviceLimits(indexKey, min, max) {
      const all = loadAdv();
      all[indexKey] = { min, max };
      saveAdv(all);
    }
    function applyDeviceLimits(d, value) {
      const { min, max } = getDeviceLimits(d);
      return Math.max(min, Math.min(max, value));
    }

    function renderAdvancedPanel() {
      if (!el.adv) return;
      const devices = Array.from(client.devices.values());
      const capControls = `
        <div style="margin-bottom:8px">
          <div style="color:#889;font-size:11px;margin-bottom:4px">Capabilities</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;color:#bbb">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input id="bp-cap-vib" type="checkbox"> <span>Vibrate</span></label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input id="bp-cap-rot" type="checkbox"> <span>Rotate</span></label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input id="bp-cap-lin" type="checkbox"> <span>Linear</span></label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input id="bp-cap-air" type="checkbox"> <span>Air</span></label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input id="bp-cap-osc" type="checkbox"> <span>Oscillate</span></label>
          </div>
        </div>`;
      const rows = devices.map((d) => {
        const key = getDeviceKey(d);
        const { min, max } = getDeviceLimits(d);
        const minPct = Math.round(min * 100);
        const maxPct = Math.round(max * 100);
        return `
          <div data-device="${key}" style="padding:6px 4px;border-bottom:1px solid #1a1a1a">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:4px">
              <strong style="font-size:12px">${d.name}</strong>
              <span style="color:#889;font-size:11px">Id: ${d.index}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:28px;color:#889;font-size:11px">Min</span>
              <input type="range" min="0" max="100" value="${minPct}" data-kind="min" style="flex:1">
              <span class="bp-min-val" style="width:36px;text-align:right;color:#bbb">${minPct}%</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
              <span style="width:28px;color:#889;font-size:11px">Max</span>
              <input type="range" min="0" max="100" value="${maxPct}" data-kind="max" style="flex:1">
              <span class="bp-max-val" style="width:36px;text-align:right;color:#bbb">${maxPct}%</span>
            </div>
          </div>`;
      });
      el.adv.innerHTML = capControls + (devices.length ? rows.join('') : '<div style="color:#666">No devices.</div>');

      el.adv.querySelectorAll('input[type="range"]').forEach((inp) => {
        inp.addEventListener('input', (ev) => {
          const target = ev.currentTarget;
          const row = target.closest('[data-device]');
          if (!row) return;
          const key = row.getAttribute('data-device');
          const minRange = row.querySelector('input[data-kind="min"]');
          const maxRange = row.querySelector('input[data-kind="max"]');
          if (Number(minRange.value) > Number(maxRange.value)) {
            if (target.getAttribute('data-kind') === 'min') {
              maxRange.value = minRange.value;
            } else {
              minRange.value = maxRange.value;
            }
          }
          const minPct = Number(minRange.value);
          const maxPct = Number(maxRange.value);
          row.querySelector('.bp-min-val').textContent = `${minPct}%`;
          row.querySelector('.bp-max-val').textContent = `${maxPct}%`;
          setDeviceLimits(key, minPct / 100, maxPct / 100);
        });
      });

      // After rendering, set and wire capability toggles
      applyCapsToUI();
      wireCapsUI();
    }

    let autoAbort = { token: 0 };
    async function runAutoPatternFor(postId) {
      const token = Date.now();
      autoAbort.token = token;
      const base = strengthFloat();
      const pattern = buildPatternFromId(postId);
      currentPattern = pattern;
      currentPatternIndex = -1;
      renderPatternPreview();
      setStatus(`Auto pattern for #${postId}`);
      // Loop until toggled off or navigated
      while (el.auto.checked && autoAbort.token === token) {
        // Scale durations so the whole loop matches desired cycle time
        const sourceTotal = pattern.reduce((a, s) => a + s.duration, 0) || 1;
        const targetTotal = getPatternTotalMs();
        const timeScale = targetTotal / sourceTotal;
        for (let i = 0; i < pattern.length; i++) {
          const seg = pattern[i];
          if (!el.auto.checked || autoAbort.token !== token) break;
          currentPatternIndex = i;
          renderPatternPreview();
          const ok = await actuateAllAt(seg.intensity * base);
          if (!ok) {
            // If we cannot act (no matching caps/devices), hint once
            setStatus('No enabled capabilities match connected devices', '#f99');
            await delay(800);
          } else {
            await delay(Math.max(80, Math.round(seg.duration * timeScale)));
          }
        }
        currentPatternIndex = -1;
        renderPatternPreview();
      }
    }

    function stopAutoPattern() {
      autoAbort.token = Date.now();
      currentPatternIndex = -1;
      renderPatternPreview();
    }

    function handleLocationMaybeChanged() {
      updatePostIdLabel();
      if (!el.auto.checked) return;
      const id = getCurrentPostId();
      if (id) {
        stopAutoPattern();
        runAutoPatternFor(id).catch(() => {});
      }
    }

    function listDevices() {
      const items = Array.from(client.devices.values()).map((d) => {
        updateCapsForDevice(d);
        const c = deviceCaps.get(d.index) || {};
        const caps = [];
        if (c.vib) caps.push('Vibrate');
        if (c.rot) caps.push('Rotate');
        if (c.lin) caps.push('Linear');
        if (c.air) caps.push('Air');
        if (c.osc) caps.push('Oscillate');
        return `<div style="padding:4px 2px;border-bottom:1px solid #1a1a1a">
          <div><strong>${d.name}</strong></div>
          <div style="color:#889;font-size:11px">Id: ${d.index}</div>
          <div style=\"color:#889;font-size:11px\">${caps.join(', ')}</div>
        </div>`;
      });
      el.devices.innerHTML = items.join('') || '<div style="color:#666">No devices.</div>';
      if (el.advToggle && el.advToggle.checked) renderAdvancedPanel();
    }

    async function safeConnect() {
      if (client.connected || isConnecting) return;
      isConnecting = true;
      try {
        setStatus(`Connecting to ${WS_URL} ...`);
        const connector = new Buttplug.ButtplugBrowserWebsocketClientConnector(WS_URL);
        await client.connect(connector);
        setStatus('Connected', '#7fe08a');
        el.connect.textContent = 'Disconnect';
        el.connect.disabled = false;
        listDevices();
      } catch (e) {
        console.error(e);
        setStatus('Failed to connect (check Intiface Central)', '#f99');
      } finally {
        isConnecting = false;
      }
    }

    async function safeDisconnect() {
      try {
        if (!client.connected) return;
        setStatus('Disconnecting...');
        await client.disconnect();
      } catch (e) {
        console.warn('Disconnect error', e);
      } finally {
        el.connect.textContent = 'Connect';
        el.connect.disabled = false;
        setStatus('Disconnected');
        el.devices.innerHTML = '<div style="color:#666">No devices.</div>';
      }
    }

    async function scan() {
      if (!client.connected) {
        setStatus('Not connected', '#f99');
        return;
      }
      try {
        setStatus('Scanning...');
        await client.startScanning();
        // Auto-stop scan after a short window to reduce noise
        setTimeout(() => {
          client.stopScanning().catch(() => {});
        }, 4000);
      } catch (e) {
        console.error(e);
        setStatus('Scan failed', '#f99');
      }
    }

    function strengthFloat() {
      const v = Number(el.strength.value) || 0;
      return Math.max(0, Math.min(1, v / 100));
    }

    async function vibrateAll() {
      if (!client.connected) return setStatus('Not connected', '#f99');
      const s = strengthFloat();
      const devices = Array.from(client.devices.values());
      if (devices.length === 0) return setStatus('No devices found', '#f99');

      let acted = 0;
      for (const d of devices) {
        try {
          const limited = applyDeviceLimits(d, s);
          const caps = getCaps();
          let did = false;
          if (caps.vib && typeof d.vibrate === 'function') { await d.vibrate(limited); did = true; }
          if (caps.rot && typeof d.rotate === 'function') { try { await d.rotate(limited); did = true; } catch (_) {} }
          if (caps.lin && typeof d.linear === 'function') { try { await d.linear(limited, Math.max(150, Math.round(200 + 800 * limited))); did = true; } catch (_) {} }
          if (caps.air && typeof d.air === 'function') { try { await d.air(limited); did = true; } catch (_) {} }
          if (caps.osc && typeof d.oscillate === 'function') { try { await d.oscillate(limited); did = true; } catch (_) {} }
          if (did) acted++;
        } catch (e) {
          console.warn('Vibrate failed for', d.name, e);
        }
      }
      setStatus(acted ? `Actuating at ${(s * 100) | 0}%` : 'No supported capability', acted ? '#7fe08a' : '#f99');
    }

    async function stopAll() {
      if (!client.connected) return setStatus('Not connected', '#f99');
      const devices = Array.from(client.devices.values());
      if (devices.length === 0) return setStatus('No devices found', '#f99');

      let acted = 0;
      for (const d of devices) {
        try {
          await d.stop();
          acted++;
        } catch (e) {
          console.warn('Stop failed for', d.name, e);
        }
      }
      setStatus(acted ? 'Stopped' : 'No controllable devices', acted ? '#7fe08a' : '#f99');
    }

    // Device events
    client.addListener('deviceadded', (device) => {
      setStatus(`Device added: ${device.name}`, '#7fe08a');
      updateCapsForDevice(device);
      listDevices();
      if (el.advToggle && el.advToggle.checked) renderAdvancedPanel();
    });
    client.addListener('deviceremoved', (device) => {
      setStatus(`Device removed: ${device.name}`, '#f9c');
      listDevices();
      if (el.advToggle && el.advToggle.checked) renderAdvancedPanel();
    });
    client.addListener('scanningfinished', () => {
      setStatus('Scan finished', '#9cf');
      listDevices();
      if (el.advToggle && el.advToggle.checked) renderAdvancedPanel();
    });

    // UI events
    el.minimize.addEventListener('click', toggleMinimize);
    function handleConnectToggle() {
      if (client.connected) {
        safeDisconnect().catch(() => {});
      } else {
        safeConnect().catch(() => {});
      }
    }
    el.connect.addEventListener('click', handleConnectToggle);
    el.scan.addEventListener('click', scan);
    el.vibe.addEventListener('click', vibrateAll);
    function handleStopClick() {
      stopAutoPattern();
      if (el.auto.checked) el.auto.checked = false;
      stopAll();
      setStatus('Stopped');
    }
    el.stop.addEventListener('click', handleStopClick);
    el.strength.addEventListener('input', () => {
      el.strengthVal.textContent = `${el.strength.value}%`;
      renderPatternPreview();
    });
    if (el.patternSeconds) {
      const syncVal = () => { if (el.patternSecondsVal) el.patternSecondsVal.textContent = `${el.patternSeconds.value}s`; };
      el.patternSeconds.addEventListener('input', () => {
        syncVal();
        const sec = Math.max(2, Math.min(30, Number(el.patternSeconds.value) || 12));
        localStorage.setItem(PATTERN_SEC_KEY, String(sec));
        renderPatternPreview();
        if (el.auto.checked) {
          stopAutoPattern();
          const id = getCurrentPostId();
          if (id) runAutoPatternFor(id).catch(() => {});
        }
      });
      syncVal();
    }
    el.auto.addEventListener('change', () => {
      if (el.auto.checked) {
        const id = getCurrentPostId();
        if (id) runAutoPatternFor(id).catch(() => {});
        else setStatus('No post id in URL for auto pattern', '#f99');
      } else {
        stopAutoPattern();
        setStatus('Auto pattern off');
      }
    });

    // Advanced toggle
    el.advToggle.addEventListener('change', () => {
      el.adv.style.display = el.advToggle.checked ? 'block' : 'none';
      if (el.advToggle.checked) renderAdvancedPanel();
    });

    // Observe SPA-style URL changes
    (function installLocationObserver() {
      const fire = () => window.dispatchEvent(new Event('locationchange'));
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      history.pushState = function () { const r = origPush.apply(this, arguments); fire(); return r; };
      history.replaceState = function () { const r = origReplace.apply(this, arguments); fire(); return r; };
      window.addEventListener('popstate', fire);
      window.addEventListener('locationchange', handleLocationMaybeChanged);
    })();

    // Optional: auto-connect if Intiface is running
    // Comment out if you prefer manual connect
    setTimeout(() => {
      // Keep initial behavior but sync button text if already connected
      if (!client.connected) safeConnect().catch(() => {});
      else { el.connect.textContent = 'Disconnect'; el.connect.disabled = false; }
    }, 500);

    // Initialize post id label on load
    updatePostIdLabel();
    renderPatternPreview();
    // Initialize capabilities
    applyCapsToUI();
    wireCapsUI();
    loadPatternSecondsToUI();
    if (el.patternSeconds) { const sec = Math.max(2, Math.min(30, Number(el.patternSeconds.value) || 12)); el.patternSeconds.value = String(sec); if (el.patternSecondsVal) el.patternSecondsVal.textContent = `${sec}s`; }
    renderAdvancedPanel();
  })();
