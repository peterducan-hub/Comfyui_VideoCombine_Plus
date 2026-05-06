/**
 * VideoCombinePlus — Modern UI reskin
 * Logic unchanged — only styles and icons updated.
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Formats where the browser <video> element can natively preview
const PREVIEWABLE_FORMATS = new Set(["mp4", "webm", "mov"]);

// MIME types for download blob construction
const FORMAT_MIME = {
  mp4:  "video/mp4",
  webm: "video/webm",
  mov:  "video/quicktime",
  avi:  "video/x-msvideo",
  gif:  "image/gif",
};

// ── SVG icon library ───────────────────────────────────────────────────────────
const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  loop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  capture: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  volHigh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  volLow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  volMute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  film: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
};

// Inject global styles once
const STYLE_ID = "vcp-styles";
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vcp-root {
      --vcp-bg:       #0d1117;
      --vcp-surface:  #161b27;
      --vcp-border:   #21293a;
      --vcp-accent:   #3b82f6;
      --vcp-accent2:  #60a5fa;
      --vcp-green:    #34d399;
      --vcp-text:     #94a3b8;
      --vcp-text-dim: #3d5275;
      --vcp-radius:   8px;
      font-family: 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--vcp-bg);
      border-radius: var(--vcp-radius);
      overflow: hidden;
      position: relative;
    }

    .vcp-video-wrap {
      flex: 1;
      background: #000;
      position: relative;
      overflow: hidden;
    }

    .vcp-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--vcp-text-dim);
      font-size: 12px;
      letter-spacing: 0.05em;
    }

    .vcp-placeholder-icon {
      width: 36px;
      height: 36px;
      opacity: 0.3;
      color: var(--vcp-accent2);
    }

    .vcp-badge {
      position: absolute;
      display: none;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      pointer-events: none;
      backdrop-filter: blur(8px);
    }

    .vcp-badge-format {
      top: 10px;
      right: 10px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: var(--vcp-accent2);
    }

    .vcp-badge-meta {
      bottom: 10px;
      left: 10px;
      background: rgba(52, 211, 153, 0.12);
      border: 1px solid rgba(52, 211, 153, 0.3);
      color: var(--vcp-green);
    }

    .vcp-badge-meta svg {
      width: 9px;
      height: 9px;
    }

    .vcp-no-preview {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      background: rgba(13, 17, 23, 0.9);
      border: 1px solid var(--vcp-border);
      border-radius: 12px;
      padding: 20px 28px;
      backdrop-filter: blur(12px);
    }

    .vcp-no-preview-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }

    .vcp-no-preview-title {
      color: var(--vcp-accent2);
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .vcp-no-preview-sub {
      color: var(--vcp-text-dim);
      font-size: 11px;
    }

    /* ── Controls bar ── */
    .vcp-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--vcp-surface);
      border-top: 1px solid var(--vcp-border);
      padding: 6px 8px;
    }

    .vcp-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: var(--vcp-text);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      padding: 0;
    }

    .vcp-btn svg {
      width: 14px;
      height: 14px;
      display: block;
    }

    .vcp-btn:hover {
      background: rgba(59, 130, 246, 0.12);
      border-color: rgba(59, 130, 246, 0.3);
      color: var(--vcp-accent2);
    }

    .vcp-btn:disabled {
      opacity: 0.3;
      cursor: default;
      pointer-events: none;
    }

    .vcp-btn.active {
      background: rgba(59, 130, 246, 0.18);
      border-color: rgba(59, 130, 246, 0.5);
      color: var(--vcp-accent2);
    }

    .vcp-btn-play {
      width: 32px;
      height: 28px;
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
      color: var(--vcp-accent2);
    }

    .vcp-btn-play:hover {
      background: rgba(59, 130, 246, 0.28);
      border-color: rgba(59, 130, 246, 0.55);
    }

    .vcp-divider {
      width: 1px;
      height: 16px;
      background: var(--vcp-border);
      flex-shrink: 0;
      margin: 0 2px;
    }

    /* ── Seek bar ── */
    .vcp-seek {
      flex: 1;
      min-width: 0;
      height: 3px;
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      border-radius: 3px;
      cursor: pointer;
      outline: none;
      margin: 0 6px;
      /* expand clickable area without affecting layout */
      padding: 8px 0;
      box-sizing: content-box;
    }

    .vcp-seek::-webkit-slider-runnable-track {
      height: 3px;
      border-radius: 2px;
    }

    .vcp-seek::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #5b9eff;
      box-shadow: 0 0 0 2px rgba(91,158,255,0.3), 0 1px 4px rgba(0,0,0,0.5);
      cursor: pointer;
      margin-top: -5.5px;
      transition: transform 0.12s, box-shadow 0.12s;
    }

    .vcp-seek:hover::-webkit-slider-thumb {
      transform: scale(1.15);
      box-shadow: 0 0 0 4px rgba(91,158,255,0.2), 0 2px 8px rgba(91,158,255,0.4);
    }

    .vcp-seek::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #5b9eff;
      border: none;
      cursor: pointer;
    }

    .vcp-seek::-moz-range-track {
      height: 3px;
      border-radius: 3px;
      background: transparent;
    }

    .vcp-time {
      font-size: 10px;
      font-variant-numeric: tabular-nums;
      color: var(--vcp-text-dim);
      min-width: 72px;
      text-align: right;
      flex-shrink: 0;
      letter-spacing: 0.02em;
    }

    /* ── Volume popup ── */
    .vcp-vol-popup {
      position: absolute;
      bottom: 46px;
      left: 36px;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      background: var(--vcp-surface);
      border: 1px solid var(--vcp-border);
      border-radius: 10px;
      padding: 10px 8px;
      backdrop-filter: blur(12px);
      z-index: 10;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }

    .vcp-vol-label {
      font-size: 9px;
      color: var(--vcp-text-dim);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .vcp-vol-slider {
      writing-mode: vertical-lr;
      direction: rtl;
      height: 80px;
      -webkit-appearance: none;
      appearance: none;
      width: 4px;
      background: transparent;
      border-radius: 3px;
      cursor: pointer;
      outline: none;
      padding: 0 8px;
      box-sizing: content-box;
    }

    .vcp-vol-slider::-webkit-slider-runnable-track {
      width: 4px;
      border-radius: 3px;
    }

    .vcp-vol-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #5b9eff;
      box-shadow: 0 0 0 2px rgba(91,158,255,0.3), 0 1px 4px rgba(0,0,0,0.4);
      cursor: pointer;
      margin-left: -5px;
      transition: transform 0.12s, box-shadow 0.12s;
    }

    .vcp-vol-slider:hover::-webkit-slider-thumb {
      transform: scale(1.15);
      box-shadow: 0 0 0 4px rgba(91,158,255,0.2), 0 2px 8px rgba(91,158,255,0.4);
    }

    .vcp-vol-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #5b9eff;
      border: none;
      cursor: pointer;
    }

    .vcp-vol-slider::-moz-range-track {
      width: 4px;
      border-radius: 3px;
      background: transparent;
    }
  `;
  document.head.appendChild(style);
}

// ── Helper utilities ───────────────────────────────────────────────────────────

function buildPreviewUrl(gif) {
  const { filename, subfolder, type } = gif;
  const params = new URLSearchParams({
    filename,
    subfolder: subfolder || "",
    type: type || "output"
  });
  return `${api.api_base}/view?${params.toString()}`;
}

function getStorageKey(node) {
  return "VCP_lastVideo_" + node.id;
}

function resolveDownloadName(node, gif) {
  if (node.widgets) {
    const prefixWidget = node.widgets.find(w => w.name === "filename_prefix");
    const fmtWidget    = node.widgets.find(w => w.name === "format");
    if (prefixWidget?.value) {
      const ext = fmtWidget?.value || gif.format || "mp4";
      return `${prefixWidget.value}.${ext}`;
    }
  }
  return gif.filename || "video.mp4";
}

function getFormatFromGif(gif) {
  if (gif.format) return gif.format;
  const ext = (gif.filename || "").split(".").pop().toLowerCase();
  return ext || "mp4";
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** Paint a horizontal slider fill: accent colour from 0 → pct%, dimmed track from pct% → 100% */
function updateSliderFill(slider, pct) {
  const accent = '#5b9eff';
  const track  = '#2a3347';
  // background-origin:content-box + no-repeat confines the gradient to the 3px track,
  // keeping the padding area transparent so thumb centering isn't affected
  slider.style.backgroundImage =
    `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, ${track} ${pct}%, ${track} 100%)`;
  slider.style.backgroundRepeat = 'no-repeat';
  slider.style.backgroundSize = '100% 3px';
  slider.style.backgroundPosition = 'center';
}

/** Paint a vertical slider fill (writing-mode vertical-lr, direction rtl = grows upward) */
function updateVolFill(slider, pct) {
  const accent = '#5b9eff';
  const track  = '#2a3347';
  slider.style.backgroundImage =
    `linear-gradient(to top, ${accent} 0%, ${accent} ${pct}%, ${track} ${pct}%, ${track} 100%)`;
  slider.style.backgroundRepeat = 'no-repeat';
  slider.style.backgroundSize = '3px 100%';
  slider.style.backgroundPosition = 'center';
}

// ── Widget factory ─────────────────────────────────────────────────────────────

function createPreviewWidget(node) {
  let isLooping = false;

  // Root
  const container = el("div", "vcp-root");

  // Video area
  const videoWrap = el("div", "vcp-video-wrap");

  const video = document.createElement("video");
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.style.cssText = "width:100%;height:100%;object-fit:contain;display:none;";

  const gifImg = document.createElement("img");
  gifImg.style.cssText = "width:100%;height:100%;object-fit:contain;display:none;";

  // Placeholder
  const placeholder = el("div", "vcp-placeholder");
  const placeholderIcon = el("div", "vcp-placeholder-icon", ICONS.film);
  const placeholderText = el("span", "", "Video preview will appear here");
  placeholder.append(placeholderIcon, placeholderText);

  // Format badge (top-right)
  const formatBadge = el("div", "vcp-badge vcp-badge-format");

  // Meta badge (bottom-left)
  const metaBadge = el("div", "vcp-badge vcp-badge-meta");
  metaBadge.title = "Workflow metadata PNG was saved alongside this video";
  metaBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> workflow`;

  // No-preview notice
  const noPreviewNotice = el("div", "vcp-no-preview");

  videoWrap.append(placeholder, video, gifImg, formatBadge, metaBadge, noPreviewNotice);

  // Controls bar
  const controls = el("div", "vcp-controls");

  // Play button
  const playBtn = el("button", "vcp-btn vcp-btn-play", ICONS.play);
  playBtn.title = "Play / Pause";

  // Volume button
  const soundBtn = el("button", "vcp-btn", ICONS.volHigh);
  soundBtn.title = "Volume (double-click to mute)";

  // Loop button
  const loopBtn = el("button", "vcp-btn", ICONS.loop);
  loopBtn.title = "Loop On / Off";

  // Divider
  const div1 = el("div", "vcp-divider");

  // Capture button
  const captureBtn = el("button", "vcp-btn", ICONS.capture);
  captureBtn.title = "Save current frame as PNG";

  // Download button
  const downloadBtn = el("button", "vcp-btn", ICONS.download);
  downloadBtn.title = "Download video";

  // Divider
  const div2 = el("div", "vcp-divider");

  // Seek bar
  const seekBar = document.createElement("input");
  seekBar.type = "range";
  seekBar.min = "0";
  seekBar.max = "1000";
  seekBar.className = "vcp-seek";

  // Time label
  const timeLabel = el("span", "vcp-time", "0:00 / 0:00");

  controls.append(playBtn, soundBtn, loopBtn, div1, captureBtn, downloadBtn, div2, seekBar, timeLabel);
  container.append(videoWrap, controls);

  // Volume popup
  const volPopup = el("div", "vcp-vol-popup");
  const volLabel  = el("div", "vcp-vol-label", "VOL");
  const volSlider = document.createElement("input");
  volSlider.type = "range";
  volSlider.min = "0";
  volSlider.max = "100";
  volSlider.value = "80";
  volSlider.className = "vcp-vol-slider";
  volPopup.append(volLabel, volSlider);
  videoWrap.appendChild(volPopup);

  video.volume = volSlider.value / 100;
  // Initialise fills to reflect default values
  updateSliderFill(seekBar, 0);
  updateVolFill(volSlider, Number(volSlider.value));

  // ── Playback controls ──────────────────────────────────────────────────────

  playBtn.onclick = () => {
    if (!video.src) return;
    video.paused ? video.play() : video.pause();
  };

  video.addEventListener("play",  () => { playBtn.innerHTML = ICONS.pause; });
  video.addEventListener("pause", () => { playBtn.innerHTML = ICONS.play;  });

  loopBtn.onclick = () => {
    isLooping = !isLooping;
    video.loop = isLooping;
    loopBtn.classList.toggle("active", isLooping);
  };

  soundBtn.onclick = (e) => {
    e.stopPropagation();
    volPopup.style.display = volPopup.style.display === "flex" ? "none" : "flex";
  };

  document.addEventListener("click", () => volPopup.style.display = "none");

  function updateVolIcon(v) {
    soundBtn.innerHTML = v === 0 ? ICONS.volMute : v < 0.5 ? ICONS.volLow : ICONS.volHigh;
  }

  volSlider.oninput = () => {
    const v = volSlider.value / 100;
    video.volume = v;
    updateVolIcon(v);
    updateVolFill(volSlider, volSlider.value);
  };

  soundBtn.ondblclick = (e) => {
    e.stopPropagation();
    if (video.volume > 0) {
      video._lastVolume = video.volume;
      video.volume = 0;
      volSlider.value = 0;
    } else {
      const restore = video._lastVolume || 0.8;
      video.volume = restore;
      volSlider.value = restore * 100;
    }
    updateVolIcon(video.volume);
    updateVolFill(volSlider, volSlider.value);
  };

  function fmt(s) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  video.ontimeupdate = () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    seekBar.value = pct * 10; // max=1000
    timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
    updateSliderFill(seekBar, pct);
  };

  seekBar.oninput = () => {
    video.currentTime = (seekBar.value / 1000) * video.duration;
    updateSliderFill(seekBar, seekBar.value / 10);
  };

  // ── Frame capture ──────────────────────────────────────────────────────────

  captureBtn.onclick = () => {
    if (!video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const prefix = node.widgets?.find(w => w.name === "filename_prefix")?.value || "frame";
      a.download = `${prefix}_frame.png`;
      a.click();
    });
  };

  // ── Download ───────────────────────────────────────────────────────────────

  downloadBtn.onclick = async () => {
    const gif = node._lastVideo;
    if (!gif) { alert("No video available yet — run the node first."); return; }

    const suggested = resolveDownloadName(node, gif);
    const name = prompt("Save as:", suggested);
    if (!name) return;

    try {
      const params = new URLSearchParams({
        filename: gif.filename,
        subfolder: gif.subfolder || "",
        type: gif.type || "output"
      });
      const url = `${api.api_base}/view?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

    } catch (err) {
      console.error("[VideoCombinePlus] Download error:", err);
      alert(`Download failed: ${err.message}`);
    }
  };

  // ── Load / display logic ───────────────────────────────────────────────────

  function setFormatBadge(f) {
    formatBadge.textContent = f.toUpperCase();
    formatBadge.style.display = f ? "flex" : "none";
  }

  function setMetaBadge(metaPng) {
    metaBadge.style.display = metaPng ? "flex" : "none";
  }

  function loadVideo(gif, autoplay = true) {
    if (!gif || !gif.filename) return;

    const format = getFormatFromGif(gif);
    const url    = buildPreviewUrl(gif);

    localStorage.setItem(getStorageKey(node), JSON.stringify(gif));

    setFormatBadge(format);
    setMetaBadge(gif.meta_png || null);
    placeholder.style.display = "none";

    if (format === "gif") {
      video.pause();
      video.style.display = "none";
      noPreviewNotice.style.display = "none";
      gifImg.src = url + "&t=" + Date.now();
      gifImg.style.display = "block";

      playBtn.disabled  = true;
      seekBar.disabled  = true;
      timeLabel.textContent = "GIF";
      return;
    }

    gifImg.style.display = "none";
    gifImg.src = "";
    playBtn.disabled  = false;
    seekBar.disabled  = false;

    if (!PREVIEWABLE_FORMATS.has(format)) {
      video.style.display = "none";
      noPreviewNotice.innerHTML = `
        <div class="vcp-no-preview-icon">📁</div>
        <div class="vcp-no-preview-title">.${format.toUpperCase()} — not previewable</div>
        <div class="vcp-no-preview-sub">Use the download button to save and play locally.</div>
      `;
      noPreviewNotice.style.display = "block";
      timeLabel.textContent = `.${format}`;
      return;
    }

    noPreviewNotice.style.display = "none";
    video.pause();
    video.removeAttribute("src");
    video.load();

    video.src = url + "&t=" + Date.now();
    video.style.display = "block";

    video.onloadedmetadata = () => {
      video.loop = isLooping;
      if (autoplay) video.play().catch(() => {});
    };
  }

  // Restore last video on node re-open
  setTimeout(() => {
    const saved = localStorage.getItem(getStorageKey(node));
    if (!saved) return;
    try {
      const gif = JSON.parse(saved);
      node._lastVideo = gif;
      loadVideo(gif, false);
    } catch {}
  }, 200);

  return { container, loadVideo, video };
}

// ── ComfyUI extension registration ────────────────────────────────────────────

app.registerExtension({
  name: "VideoCombinePlus",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "VideoCombinePlus") return;

    nodeType.prototype.onNodeCreated = function () {
      const { container, loadVideo, video } = createPreviewWidget(this);
      this.addDOMWidget("video_preview", "PREVIEW", container);
      this._loadVideo = loadVideo;
      this._videoEl   = video;
    };

    nodeType.prototype.onExecuted = function (msg) {
      if (msg?.gifs?.length) {
        const gif = msg.gifs[msg.gifs.length - 1];
        this._lastVideo = gif;
        this._loadVideo(gif, true);
      }
    };

    nodeType.prototype.onDrawBackground = function () {
      if (!this._lastVideo || !this._loadVideo || !this._videoEl) return;
      if (!this._videoEl.src) {
        this._loadVideo(this._lastVideo, false);
      }
    };
  },
});
