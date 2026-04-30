/**
 * VideoCombinePlus — ComfyUI Frontend Extension (FINAL + DOWNLOAD + BLUE)
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function buildPreviewUrl(gif) {
  const { filename, subfolder, type } = gif;
  const params = new URLSearchParams({
    filename,
    subfolder: subfolder || "",
    type: type || "output",
    rand: Math.random(),
  });
  return `${api.api_base}/view?${params.toString()}`;
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
  `;

  // ── Video ─────────────────────────────────────────────
  const videoWrap = document.createElement("div");
  videoWrap.style.cssText = `
    flex:1;
    background:#000;
    position:relative;
  `;

  const video = document.createElement("video");
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.style.cssText = `
    width:100%;
    height:100%;
    object-fit:contain;
    display:none;
  `;

  const placeholder = document.createElement("div");
  placeholder.textContent = "🎬 Video preview will appear here";
  placeholder.style.cssText = `
    color:#3a4a6a;
    text-align:center;
    padding:28px;
  `;

  videoWrap.append(placeholder, video);

  // ── Bottom bar ─────────────────────────────────────────
  const bottomBar = document.createElement("div");
  bottomBar.style.cssText = `
    display:flex;
    align-items:center;
    gap:6px;
    background:#0e1a2e;
    padding:6px 8px;
    margin-top:auto;
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
      flex-shrink:0;
    `;
  }

  const playBtn = document.createElement("button");
  playBtn.textContent = "▶";
  playBtn.style.cssText = btnStyle();

  const soundBtn = document.createElement("button");
  soundBtn.textContent = "🔉";
  soundBtn.style.cssText = `
    background:none;
    border:none;
    font-size:16px;
    cursor:pointer;
    flex-shrink:0;
  `;

  const captureBtn = document.createElement("button");
  captureBtn.textContent = "📸";
  captureBtn.title = "Save frame";
  captureBtn.style.cssText = btnStyle();

  // ⬇ Download button
  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "⬇";
  downloadBtn.title = "Download video";
  downloadBtn.style.cssText = btnStyle();

  // 🔵 Seekbar
  const seekBar = document.createElement("input");
  seekBar.type = "range";
  seekBar.min = "0";
  seekBar.max = "1000";
  seekBar.style.cssText = `
    flex:1;
    min-width:0;
    cursor:pointer;
    accent-color:#2080e0;
  `;

  const timeLabel = document.createElement("span");
  timeLabel.textContent = "0:00";
  timeLabel.style.cssText = `
    font-size:10px;
    color:#2a6aaa;
    min-width:50px;
    text-align:right;
    flex-shrink:0;
  `;

  bottomBar.append(playBtn, soundBtn, captureBtn, downloadBtn, seekBar, timeLabel);
  container.append(videoWrap, bottomBar);

  // ── Volume popup ───────────────────────────────────────
  const volPopup = document.createElement("div");
  volPopup.style.cssText = `
    position:absolute;
    bottom:40px;
    left:40px;
    display:none;
    background:#0e1a2e;
    border:1px solid #1a3a6a;
    border-radius:6px;
    padding:6px;
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

  // ── Logic ──────────────────────────────────────────────
  function updatePlayIcon() {
    playBtn.textContent = video.paused ? "▶" : "⏸";
  }

  video.addEventListener("play", updatePlayIcon);
  video.addEventListener("pause", updatePlayIcon);

  playBtn.onclick = () => video.paused ? video.play() : video.pause();

  let volOpen = false;
  soundBtn.onclick = (e) => {
    e.stopPropagation();
    volOpen = !volOpen;
    volPopup.style.display = volOpen ? "flex" : "none";
  };

  document.addEventListener("click", () => {
    volPopup.style.display = "none";
    volOpen = false;
  });

  volSlider.oninput = () => {
    const v = volSlider.value;
    video.volume = v / 100;
    video.muted = v == 0;

    if (v == 0) soundBtn.textContent = "🔇";
    else if (v < 40) soundBtn.textContent = "🔈";
    else if (v < 80) soundBtn.textContent = "🔉";
    else soundBtn.textContent = "🔊";
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

  // 📸 Capture
  captureBtn.onclick = () => {
    if (!video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    const name = `frame_${video.currentTime.toFixed(2)}.png`;

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // ⬇ Download video
  downloadBtn.onclick = () => {
    if (!currentVideoURL) return;

    const a = document.createElement("a");
    a.href = currentVideoURL;
    a.download = "video_output.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  function loadVideo(gif) {
    const url = buildPreviewUrl(gif);

    currentVideoURL = url;

    placeholder.style.display = "none";
    video.style.display = "block";
    video.src = url;
    video.play();
  }

  return { container, loadVideo };
}

app.registerExtension({
  name: "VideoCombinePlus",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "VideoCombinePlus") return;

    nodeType.prototype.onNodeCreated = function () {
      const { container, loadVideo } = createPreviewWidget(this);
      this.addDOMWidget("video_preview", "PREVIEW", container);
      this._loadVideo = loadVideo;
    };

    nodeType.prototype.onExecuted = function (msg) {
      if (msg?.gifs?.length) {
        this._loadVideo(msg.gifs[msg.gifs.length - 1]);
      }
    };
  },
});