// ==UserScript==
// @name         ComfyUI Missing Model Helper v6.2 (Auto Dir + Save)
// @namespace    https://comfyui.local/missing-model
// @version      0.6.2
// @match        http://localhost:8000/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  /* ---------------- utils ---------------- */
  function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, { type: 'text', mimetype: 'text/plain' });
        return;
      }
    } catch {}
    navigator.clipboard?.writeText(text);
  }

  function findMissingDialog() {
    return [...document.querySelectorAll('.p-dialog')]
      .find(d => d.innerText?.includes('缺少模型'));
  }

  /* ---------------- panel ---------------- */
  let panel = null;

  function createPanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;
      width:480px;
      max-height:70vh;
      overflow:auto;
      background:rgba(18,18,18,.97);
      border:1px solid rgba(255,255,255,.12);
      border-radius:12px;
      padding:12px;
      z-index:999999;
      color:#eee;
      font-size:13px;
      box-shadow:0 10px 30px rgba(0,0,0,.55);
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <b>缺少模型 · 一键下载脚本</b>
        <button id="mm-close">✕</button>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <label>工具：
          <select id="mm-tool">
            <option value="curl" selected>curl</option>
            <option value="aria2c">aria2c</option>
          </select>
        </label>

        <label>源：
          <select id="mm-source">
            <option value="hf-mirror" selected>hf-mirror.com</option>
            <option value="hf">huggingface.co</option>
          </select>
        </label>
      </div>

      <textarea id="mm-script" readonly
        style="
          width:100%;
          height:260px;
          background:#0f0f0f;
          color:#9ef;
          border:1px solid #333;
          border-radius:8px;
          padding:8px;
          font-family:monospace;
          font-size:12px;
        "></textarea>

      <div style="margin-top:8px;display:flex;gap:8px">
        <button id="mm-copy">复制脚本</button>
        <button id="mm-refresh">刷新</button>
      </div>
    `;

    panel.addEventListener('click', e => {
      if (e.target.id === 'mm-close') {
        panel.remove();
        panel = null;
      }

      if (e.target.id === 'mm-copy') {
        copyText(panel.querySelector('#mm-script').value);
        e.target.textContent = '已复制';
        setTimeout(() => (e.target.textContent = '复制脚本'), 800);
      }

      if (e.target.id === 'mm-refresh') {
        updateScript();
      }
    });

    panel.querySelector('#mm-tool').onchange = updateScript;
    panel.querySelector('#mm-source').onchange = updateScript;

    document.body.appendChild(panel);
    return panel;
  }

  /* ---------------- core parsing ---------------- */

  function collectModels(dialog) {
    const models = [];

    dialog.querySelectorAll('[title]').forEach(el => {
      const url = el.getAttribute('title');
      if (!url || !/^https?:\/\/huggingface\.co\//i.test(url)) return;

      const text = (el.innerText || '').trim();
      const m = text.match(/^(\w+)\s*\/\s*([^\s]+)$/);
      if (!m) return;

      models.push({
        type: m[1],
        file: m[2],
        url
      });
    });

    return models;
  }

  function buildScript(models, tool, source) {
    if (!models.length) {
      return '# 未在 DOM 中识别到模型条目';
    }

    const lines = [];
    const mkdirs = new Set();

    models.forEach(m => {
      mkdirs.add(`models/${m.type}`);
    });

    // mkdir 全部目录（用 && 串）
    lines.push(
      [...mkdirs]
        .map(d => `mkdir -p "${d}"`)
        .join(' && ')
    );

    models.forEach(m => {
      const url =
        source === 'hf-mirror'
          ? m.url.replace('https://huggingface.co', 'https://hf-mirror.com')
          : m.url;

      if (tool === 'curl') {
        lines.push(
          `curl -L -o "models/${m.type}/${m.file}" "${url}"`
        );
      } else {
        lines.push(
          `aria2c -c -x16 -s16 -d "models/${m.type}" -o "${m.file}" "${url}"`
        );
      }
    });

    // 所有行用 && 连接
    return lines.join(' && \n');
  }

  function updateScript() {
    if (!panel) return;

    const dialog = findMissingDialog();
    const ta = panel.querySelector('#mm-script');

    if (!dialog) {
      ta.value = '# 未检测到「缺少模型」弹窗';
      return;
    }

    const models = collectModels(dialog);
    const tool = panel.querySelector('#mm-tool').value;
    const source = panel.querySelector('#mm-source').value;

    ta.value = buildScript(models, tool, source);
  }

  /* ---------------- observer ---------------- */
  const obs = new MutationObserver(() => {
    const dialog = findMissingDialog();
    if (!dialog) return;

    createPanel();
    const r = dialog.getBoundingClientRect();
    panel.style.left = `${r.right + 12}px`;
    panel.style.top = `${Math.max(12, r.top)}px`;

    updateScript();
  });

  obs.observe(document.body, { childList: true, subtree: true });
})();
