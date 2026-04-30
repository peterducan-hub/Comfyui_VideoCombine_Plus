/**
 * VideoCombinePlus — FINAL (VOLUME ICON FIX)
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

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

function createPreviewWidget(node) {

  let currentVideoURL = null;

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

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.style.cssText = `
    position:absolute;
    background:#0e2a4a;
    color:#60a8ff;
    font-size:11px;
    padding:4px 6px;
    border-radius:4px;
    pointer-events:none;
    opacity:0;
    transition:opacity 0.15s;
    z-index:999;
    white-space:nowrap;
  `;
  container.appendChild(tooltip);

  function attachTooltip(el, text) {
    el.addEventListener("mouseenter", () => {
      tooltip.textContent = text;

      const rect = el.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();

      tooltip.style.left = (rect.left - parentRect.left - 6) + "px";
      tooltip.style.top = (rect.top - parentRect.top - rect.height - 10) + "px";

      tooltip.style.opacity = "1";
    });

    el.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
    });
  }

  const videoWrap = document.createElement("div");
  videoWrap.style.cssText = `flex:1;background:#000;position:relative;`;

  const video = document.createElement("video");
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.style.cssText = `width:100%;height:100%;object-fit:contain;display:none;`;

  const placeholder = document.createElement("div");
  placeholder.textContent = "🎬 Video preview will appear here";
  placeholder.style.cssText = `color:#3a4a6a;text-align:center;padding:28px;`;

  videoWrap.append(placeholder, video);

  const bottomBar = document.createElement("div");
  bottomBar.style.cssText = `
    display:flex;
    align-items:center;
    gap:6px;
    background:#0e1a2e;
    padding:6px 8px;
  `;

  function btnStyle() {
    return `
      background:#0e2a4a;
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

  const captureBtn = document.createElement("button");
  captureBtn.textContent = "📸";
  captureBtn.style.cssText = btnStyle();

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "⬇";
  downloadBtn.style.cssText = btnStyle();

  const seekBar = document.createElement("input");
  seekBar.type = "range";
  seekBar.min = "0";
  seekBar.max = "1000";
  seekBar.style.cssText = `flex:1;min-width:0;accent-color:#2080e0;`;

  const timeLabel = document.createElement("span");
  timeLabel.style.cssText = `font-size:10px;color:#2a6aaa;min-width:50px;text-align:right;`;

  bottomBar.append(playBtn, soundBtn, captureBtn, downloadBtn, seekBar, timeLabel);
  container.append(videoWrap, bottomBar);

  attachTooltip(playBtn, "Play / Pause");
  attachTooltip(soundBtn, "Volume");
  attachTooltip(captureBtn, "Save frame");
  attachTooltip(downloadBtn, "Download video");

  const volPopup = document.createElement("div");
  volPopup.style.cssText = `
    position:absolute;
    bottom:40px;
    left:40px;
    display:none;
    background:#0e1a2e;
    padding:6px;
    border-radius:6px;
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

  // 🔥 INITIAL SYNC
  video.volume = volSlider.value / 100;
  soundBtn.textContent = "🔊";

  playBtn.onclick = () => {
    if (!video.src) return;
    video.paused ? video.play() : video.pause();
  };

  video.addEventListener("play", () => playBtn.textContent = "⏸");
  video.addEventListener("pause", () => playBtn.textContent = "▶");

  soundBtn.onclick = (e) => {
    e.stopPropagation();
    volPopup.style.display = volPopup.style.display === "flex" ? "none" : "flex";
  };

  document.addEventListener("click", () => volPopup.style.display = "none");

  // 🔥 VOLUME + ICON FIX
  volSlider.oninput = () => {
    const v = volSlider.value / 100;
    video.volume = v;

    if (v === 0) {
      soundBtn.textContent = "🔇";
    } else if (v < 0.5) {
      soundBtn.textContent = "🔉";
    } else {
      soundBtn.textContent = "🔊";
    }
  };

  function fmt(s) {
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  }

  video.ontimeupdate = () => {
    if (!video.duration) return;
    seekBar.value = (video.currentTime / video.duration) * 1000;
    timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  };

  seekBar.oninput = () => {
    video.currentTime = (seekBar.value / 1000) * video.duration;
  };

  captureBtn.onclick = () => {
    if (!video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "frame.png";
      a.click();
    });
  };

  downloadBtn.onclick = () => {
    if (!currentVideoURL) return;
    const a = document.createElement("a");
    a.href = currentVideoURL;
    a.download = "video.mp4";
    a.click();
  };

  function loadVideo(gif, autoplay = true) {
    const url = buildPreviewUrl(gif);

    currentVideoURL = url;
    localStorage.setItem(getStorageKey(node), JSON.stringify(gif));

    video.src = url;

    placeholder.style.display = "none";
    video.style.display = "block";

    video.onloadedmetadata = () => {
      autoplay ? video.play().catch(()=>{}) : video.pause();
    };
  }

  setTimeout(() => {
    if (video.src) return;

    const saved = localStorage.getItem(getStorageKey(node));
    if (saved) {
      try {
        loadVideo(JSON.parse(saved), false);
      } catch {}
    }
  }, 100);

  return { container, loadVideo, video };
}

app.registerExtension({
  name: "VideoCombinePlus",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "VideoCombinePlus") return;

    nodeType.prototype.onNodeCreated = function () {
      const { container, loadVideo, video } = createPreviewWidget(this);
      this.addDOMWidget("video_preview", "PREVIEW", container);
      this._loadVideo = loadVideo;
      this._videoEl = video;
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
