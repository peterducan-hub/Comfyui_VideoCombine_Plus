/**
 * VideoCombinePlus — Improved (multi-format + smart download naming)
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

/** Derive a sensible download filename from node state + server metadata */
function resolveDownloadName(node, gif) {
  // 1. Try the filename_prefix widget value on the node
  if (node.widgets) {
    const prefixWidget = node.widgets.find(w => w.name === "filename_prefix");
    const fmtWidget    = node.widgets.find(w => w.name === "format");
    if (prefixWidget?.value) {
      const ext = fmtWidget?.value || gif.format || "mp4";
      return `${prefixWidget.value}.${ext}`;
    }
  }
  // 2. Fall back to the raw server filename
  return gif.filename || "video.mp4";
}

function getFormatFromGif(gif) {
  if (gif.format) return gif.format;
  const ext = (gif.filename || "").split(".").pop().toLowerCase();
  return ext || "mp4";
}

function createPreviewWidget(node) {

  let isLooping = false;

  const container = document.createElement("div");
  container.style.cssText = `
    display:flex;
    flex-direction:column;
    height:100%;
    background:#0a0e18;
    border-radius:6px;
    overflow:hidden;
    position:relative;
  `;

  const videoWrap = document.createElement("div");
  videoWrap.style.cssText = `flex:1;background:#000;position:relative;`;

  const video = document.createElement("video");
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.style.cssText = `width:100%;height:100%;object-fit:contain;display:none;`;

  const gifImg = document.createElement("img");
  gifImg.style.cssText = `width:100%;height:100%;object-fit:contain;display:none;`;

  const placeholder = document.createElement("div");
  placeholder.textContent = "🎬 Video preview will appear here";
  placeholder.style.cssText = `color:#3a4a6a;text-align:center;padding:28px;`;

  // Format badge (top-right corner)
  const formatBadge = document.createElement("div");
  formatBadge.style.cssText = `
    display:none;
    position:absolute;
    top:8px;
    right:8px;
    background:#0e2a4acc;
    border:1px solid #1a5a9a;
    border-radius:4px;
    color:#60a8ff;
    font-size:10px;
    font-weight:700;
    letter-spacing:1px;
    padding:2px 6px;
    text-transform:uppercase;
    pointer-events:none;
  `;

  // Non-previewable format notice
  const noPreviewNotice = document.createElement("div");
  noPreviewNotice.style.cssText = `
    display:none;
    position:absolute;
    top:50%;
    left:50%;
    transform:translate(-50%,-50%);
    color:#60a8ff;
    text-align:center;
    font-size:13px;
    background:#0e1a2ecc;
    border:1px solid #1a5a9a;
    border-radius:8px;
    padding:16px 24px;
  `;


  // Metadata PNG indicator badge (bottom-left corner)
  const metaBadge = document.createElement('div');
  metaBadge.title = 'Workflow metadata PNG was saved alongside this video';
  metaBadge.style.cssText = `
    display:none;
    position:absolute;
    bottom:8px;
    left:8px;
    background:#0e2a4acc;
    border:1px solid #2a8a4a;
    border-radius:4px;
    color:#40d080;
    font-size:10px;
    font-weight:700;
    letter-spacing:0.5px;
    padding:2px 6px;
    pointer-events:none;
    gap:4px;
    align-items:center;
  `;
  metaBadge.textContent = '📄 workflow saved';

  videoWrap.append(placeholder, video, gifImg, formatBadge, metaBadge, noPreviewNotice);

  const bottomBar = document.createElement("div");
  bottomBar.style.cssText = `
    display:flex;
    align-items:center;
    gap:6px;
    background:#0e1a2e;
    padding:6px 8px;
  `;

  function btnStyle(active = false) {
    return `
      background:${active ? "#1a5a9a" : "#0e2a4a"};
      border:1px solid #1a5a9a;
      border-radius:4px;
      color:#60a8ff;
      width:28px;
      height:24px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
    `;
  }

  const playBtn = document.createElement("button");
  playBtn.textContent = "▶";
  playBtn.style.cssText = btnStyle();

  const soundBtn = document.createElement("button");
  soundBtn.textContent = "🔊";
  soundBtn.style.cssText = "background:none;border:none;font-size:16px;cursor:pointer;";

  const loopBtn = document.createElement("button");
  loopBtn.textContent = "🔁";
  loopBtn.style.cssText = btnStyle();

  const captureBtn = document.createElement("button");
  captureBtn.textContent = "📸";
  captureBtn.style.cssText = btnStyle();
  captureBtn.title = "Save current frame as PNG";

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "⬇";
  downloadBtn.style.cssText = btnStyle();
  downloadBtn.title = "Download video";

  playBtn.title   = "Play / Pause";
  soundBtn.title  = "Volume (double-click to mute)";
  loopBtn.title   = "Loop On / Off";

  const seekBar = document.createElement("input");
  seekBar.type = "range";
  seekBar.min = "0";
  seekBar.max = "1000";
  seekBar.style.cssText = `flex:1;min-width:0;accent-color:#2080e0;`;

  const timeLabel = document.createElement("span");
  timeLabel.style.cssText = `font-size:10px;color:#2a6aaa;min-width:50px;text-align:right;`;

  bottomBar.append(playBtn, soundBtn, loopBtn, captureBtn, downloadBtn, seekBar, timeLabel);
  container.append(videoWrap, bottomBar);

  // Volume popup
  const volPopup = document.createElement("div");
  volPopup.style.cssText = `
    position:absolute;
    bottom:40px;
    left:40px;
    display:none;
    background:#0e1a2e;
    padding:6px;
    border-radius:6px;
    border:1px solid #1a5a9a;
  `;

  const volSlider = document.createElement("input");
  volSlider.type = "range";
  volSlider.min = "0";
  volSlider.max = "100";
  volSlider.value = "80";
  volSlider.style.cssText = `
    writing-mode: vertical-lr;
    direction: rtl;
    height:100px;
    accent-color:#2080e0;
  `;

  volPopup.appendChild(volSlider);
  videoWrap.appendChild(volPopup);

  video.volume = volSlider.value / 100;

  // ── Playback controls ──────────────────────────────────────────────────────

  playBtn.onclick = () => {
    if (!video.src) return;
    video.paused ? video.play() : video.pause();
  };

  video.addEventListener("play",  () => playBtn.textContent = "⏸");
  video.addEventListener("pause", () => playBtn.textContent = "▶");

  loopBtn.onclick = () => {
    isLooping = !isLooping;
    video.loop = isLooping;
    loopBtn.style.background = isLooping ? "#1a5a9a" : "#0e2a4a";
  };

  soundBtn.onclick = (e) => {
    e.stopPropagation();
    volPopup.style.display = volPopup.style.display === "flex" ? "none" : "flex";
  };

  document.addEventListener("click", () => volPopup.style.display = "none");

  volSlider.oninput = () => {
    const v = volSlider.value / 100;
    video.volume = v;
    soundBtn.textContent = v === 0 ? "🔇" : v < 0.5 ? "🔉" : "🔊";
  };

  soundBtn.ondblclick = (e) => {
    e.stopPropagation();
    if (video.volume > 0) {
      video._lastVolume = video.volume;
      video.volume = 0;
      volSlider.value = 0;
      soundBtn.textContent = "🔇";
    } else {
      const restore = video._lastVolume || 0.8;
      video.volume = restore;
      volSlider.value = restore * 100;
      soundBtn.textContent = restore === 0 ? "🔇" : restore < 0.5 ? "🔉" : "🔊";
    }
  };

  function fmt(s) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  video.ontimeupdate = () => {
    if (!video.duration) return;
    seekBar.value = (video.currentTime / video.duration) * 1000;
    timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  };

  seekBar.oninput = () => {
    video.currentTime = (seekBar.value / 1000) * video.duration;
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
      // Use prefix if available
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

  function setFormatBadge(fmt) {
    formatBadge.textContent = fmt.toUpperCase();
    formatBadge.style.display = fmt ? 'block' : 'none';
  }

  function setMetaBadge(metaPng) {
    metaBadge.style.display = metaPng ? 'flex' : 'none';
  }

  function loadVideo(gif, autoplay = true) {
    if (!gif || !gif.filename) return;

    const format = getFormatFromGif(gif);
    const url    = buildPreviewUrl(gif);

    localStorage.setItem(getStorageKey(node), JSON.stringify(gif));

    setFormatBadge(format);
    setMetaBadge(gif.meta_png || null);
    placeholder.style.display = 'none';

    if (format === "gif") {
      // Show as <img> — native animated GIF support, no controls needed
      video.pause();
      video.style.display = "none";
      noPreviewNotice.style.display = "none";
      gifImg.src = url + "&t=" + Date.now();
      gifImg.style.display = "block";

      // Disable video-only controls
      playBtn.disabled  = true;
      seekBar.disabled  = true;
      timeLabel.textContent = "GIF";
      return;
    }

    // Reset GIF element
    gifImg.style.display = "none";
    gifImg.src = "";
    playBtn.disabled  = false;
    seekBar.disabled  = false;

    if (!PREVIEWABLE_FORMATS.has(format)) {
      // AVI etc. — can't preview in browser, show a download prompt instead
      video.style.display = "none";
      noPreviewNotice.innerHTML = `
        <div style="font-size:24px;margin-bottom:8px">📁</div>
        <strong style="color:#60a8ff">.${format.toUpperCase()}</strong> files can't be previewed here.<br>
        <span style="color:#3a6a9a;font-size:11px">Use the ⬇ button to download and play locally.</span>
      `;
      noPreviewNotice.style.display = "block";
      timeLabel.textContent = `.${format}`;
      return;
    }

    // Standard video preview (mp4 / webm / mov)
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
