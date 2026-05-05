import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function buildPreviewUrl(gif) {
    const { filename, subfolder, type } = gif;
    const params = new URLSearchParams({ filename, subfolder: subfolder || "", type: type || "output" });
    return `${api.api_base}/view?${params.toString()}`;
}

function getStorageKey(node) {
    return "VCP_LastVideo_" + node.id;
}

function createPreviewWidget(node) {
    const container = document.createElement("div");
    container.style.cssText = `display:flex;flex-direction:column;height:100%;background:#0a0e1b;border-radius:10px;overflow:hidden;position:relative;border:1px solid #1e293b;box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);`;

    const iconSet = {
        play: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.14v14c0 .86.84 1.4 1.58.97l11-7a1.12 1.12 0 0 0 0-1.94l-11-7a1.13 1.13 0 0 0-1.58 1z"/></svg>`,
        pause: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        loop: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
        capture: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
        download: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        volHigh: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
        volLow: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 9v6h4l5 5V4L11 9H7zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`,
        volMute: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`
    };

    const videoWrap = document.createElement("div");
    videoWrap.style.cssText = `flex:1;background:#000;position:relative;display:flex;align-items:center;justify-content:center;box-shadow: inset 0 0 40px rgba(0,0,0,0.8);`;

    const video = document.createElement("video");
    video.playsInline = true; video.crossOrigin = "anonymous";
    video.style.cssText = `max-width:100%;max-height:100%;object-fit:contain;display:none;`;

    const img = document.createElement("img");
    img.style.cssText = `max-width:100%;max-height:100%;object-fit:contain;display:none;`;

    const placeholder = document.createElement("div");
    placeholder.innerHTML = `<div style="font-size:24px;margin-bottom:8px;">🎥</div>PRO PREVIEW`;
    placeholder.style.cssText = `color:#1e293b;font-weight:900;letter-spacing:4px;text-align:center;padding:40px;font-family:system-ui;text-shadow:0 1px 0 rgba(255,255,255,0.1);`;

    videoWrap.append(placeholder, video, img);

    const bottomBar = document.createElement("div");
    bottomBar.style.cssText = `display:flex;align-items:center;gap:8px;background:linear-gradient(to bottom, #111827, #030712);padding:10px 14px;border-top:1px solid #1e293b;`;

    const btnStyle = `background:#1e293b;border:1px solid #334155;border-radius:6px;color:#cbd5e1;width:32px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);outline:none;`;
    const btnHover = `this.style.background='#334155';this.style.color='#fff';this.style.borderColor='#475569';`;
    const btnOut = `this.style.background='#1e293b';this.style.color='#cbd5e1';this.style.borderColor='#334155';`;

    const playBtn = document.createElement("button"); 
    playBtn.innerHTML = iconSet.play; 
    playBtn.style.cssText = btnStyle;
    playBtn.onmouseover = function(){ eval(btnHover); }; playBtn.onmouseout = function(){ eval(btnOut); };

    const soundBtn = document.createElement("button"); 
    soundBtn.innerHTML = iconSet.volHigh; 
    soundBtn.style.cssText = `background:none;border:none;cursor:pointer;color:#64748b;margin:0 4px;padding:4px;transition:color 0.2s;`;
    soundBtn.onmouseover = () => soundBtn.style.color = "#fff";
    soundBtn.onmouseout = () => soundBtn.style.color = "#64748b";

    const loopBtn = document.createElement("button"); loopBtn.innerHTML = iconSet.loop; loopBtn.style.cssText = btnStyle;
    loopBtn.onmouseover = function(){ if(!this._active) eval(btnHover); }; loopBtn.onmouseout = function(){ if(!this._active) eval(btnOut); };

    const captureBtn = document.createElement("button"); captureBtn.innerHTML = iconSet.capture; captureBtn.style.cssText = btnStyle;
    captureBtn.onmouseover = function(){ eval(btnHover); }; captureBtn.onmouseout = function(){ eval(btnOut); };

    const downloadBtn = document.createElement("button"); downloadBtn.innerHTML = iconSet.download; downloadBtn.style.cssText = btnStyle;
    downloadBtn.onmouseover = function(){ eval(btnHover); }; downloadBtn.onmouseout = function(){ eval(btnOut); };
    
    const speedSelect = document.createElement("select");
    speedSelect.style.cssText = `background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:6px;font-size:11px;height:28px;padding:0 4px;outline:none;cursor:pointer;font-family:monospace;`;
    [0.5, 0.75, 1, 1.25, 1.5, 2].forEach(v => {
        const opt = document.createElement("option"); opt.value = v; opt.textContent = v+"x";
        if(v===1) opt.selected = true; speedSelect.appendChild(opt);
    });

    const seekBar = document.createElement("input");
    seekBar.type = "range"; seekBar.min = "0"; seekBar.max = "1000"; seekBar.value = "0";
    seekBar.style.cssText = `flex:1;accent-color:#3b82f6;cursor:pointer;height:4px;background:#334155;border-radius:2px;`;

    const timeLabel = document.createElement("div");
    timeLabel.style.cssText = `font-size:11px;color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;min-width:75px;text-align:right;font-variant-numeric: tabular-nums;`;
    timeLabel.textContent = "0:00 / 0:00";

    const volPopup = document.createElement("div");
    volPopup.style.cssText = `position:absolute;bottom:50px;left:45px;display:none;background:#1e293b;padding:12px 8px;border-radius:10px;border:1px solid #334155;z-index:99;box-shadow:0 10px 15px -3px rgba(0,0,0,0.5);backdrop-filter:blur(10px);`;
    const volSlider = document.createElement("input");
    volSlider.type = "range"; volSlider.min = "0"; volSlider.max = "100"; volSlider.value = "80";
    volSlider.style.cssText = `writing-mode: vertical-lr;direction: rtl;height:100px;accent-color:#3b82f6;cursor:pointer;`;
    volPopup.appendChild(volSlider);
    videoWrap.appendChild(volPopup);

    video.volume = 0.8; 

    bottomBar.append(playBtn, soundBtn, loopBtn, speedSelect, captureBtn, downloadBtn, seekBar, timeLabel);
    container.append(videoWrap, bottomBar);

    function showPreview(ext, format) {
        placeholder.style.display = "none";
        if (ext === "gif") {
            video.style.display = "none";
            img.style.display = "block";
            bottomBar.style.opacity = "0.4";
            bottomBar.style.pointerEvents = "none";
            downloadBtn.style.pointerEvents = "auto";
            downloadBtn.parentElement.style.pointerEvents = "auto";
        } else if (format === "prores") {
            video.style.display = "none";
            img.style.display = "none";
            placeholder.style.display = "block";
            placeholder.innerHTML = `<div style="font-size:24px;margin-bottom:8px;">📦</div>PRORES EXPORT<br><span style="font-size:10px;font-weight:normal;letter-spacing:1px;opacity:0.6;">NO PREVIEW SUPPORT</span>`;
            bottomBar.style.opacity = "1";
            bottomBar.style.pointerEvents = "auto";
        } else {
            img.style.display = "none";
            video.style.display = "block";
            bottomBar.style.opacity = "1";
            bottomBar.style.pointerEvents = "auto";
        }
    }

    playBtn.onclick = (e) => { e.stopPropagation(); video.paused ? video.play() : video.pause(); };
    video.onplay = () => playBtn.innerHTML = iconSet.pause;
    video.onpause = () => playBtn.innerHTML = iconSet.play;
    
    loopBtn.onclick = (e) => { 
        e.stopPropagation(); 
        video.loop = !video.loop; 
        loopBtn._active = video.loop;
        loopBtn.style.background = video.loop ? "#3b82f6" : "#1e293b"; 
        loopBtn.style.color = video.loop ? "#fff" : "#cbd5e1";
        loopBtn.style.borderColor = video.loop ? "#60a5fa" : "#334155";
    };
    speedSelect.onchange = () => video.playbackRate = parseFloat(speedSelect.value);
    
    soundBtn.onclick = (e) => { e.stopPropagation(); volPopup.style.display = volPopup.style.display === "block" ? "none" : "block"; };
    
    soundBtn.ondblclick = (e) => {
        e.stopPropagation();
        if (video.volume > 0) {
            video._lastVol = video.volume;
            video.volume = 0;
            volSlider.value = 0;
            soundBtn.innerHTML = iconSet.volMute;
        } else {
            const res = video._lastVol || 0.8;
            video.volume = res;
            volSlider.value = res * 100;
            soundBtn.innerHTML = res < 0.5 ? iconSet.volLow : iconSet.volHigh;
        }
    };

    volSlider.oninput = () => {
        const v = volSlider.value / 100;
        video.volume = v;
        soundBtn.innerHTML = v === 0 ? iconSet.volMute : (v < 0.5 ? iconSet.volLow : iconSet.volHigh);
    };

    const fmtT = s => ~~(s/60) + ":" + (~~(s%60)).toString().padStart(2,"0");
    video.ontimeupdate = () => {
        if(video.duration) {
            seekBar.value = (video.currentTime / video.duration) * 1000;
            timeLabel.textContent = `${fmtT(video.currentTime)} / ${fmtT(video.duration)}`;
        }
    };
    seekBar.oninput = () => { video.currentTime = (seekBar.value / 1000) * video.duration; };

    captureBtn.onclick = (e) => {
        e.stopPropagation();
        if (!video.videoWidth) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = "frame_" + Date.now() + ".png"; a.click();
    };

    downloadBtn.onclick = async (e) => {
        e.stopPropagation();
        const gif = node._lastVideo; if(!gif) return;
        const name = prompt("Download as", gif.filename); if(!name) return;
        const res = await fetch(buildPreviewUrl(gif));
        const blob = await res.blob();
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    };

    return { container, video, img, placeholder, showPreview };
}

app.registerExtension({
    name: "VideoCombinePlus",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "VideoCombinePlus") return;
        nodeType.prototype.onNodeCreated = function() {
            const { container, video, img, placeholder, showPreview } = createPreviewWidget(this);
            this.addDOMWidget("video_preview", "PREVIEW", container);
            this._videoEl = video; this._imgEl = img; this._placeholderEl = placeholder;
            this._showPreview = showPreview;
            this.setSize([350, 480]);

            setTimeout(() => {
                const saved = localStorage.getItem(getStorageKey(this));
                if (saved) {
                    try {
                        const gif = JSON.parse(saved);
                        this._lastVideo = gif;
                        const url = buildPreviewUrl(gif);
                        const ext = gif.extension || gif.filename.split('.').pop().toLowerCase();
                        this._showPreview(ext, gif.format);
                        if (ext === "gif") this._imgEl.src = url;
                        else this._videoEl.src = url;
                    } catch(e) {}
                }
            }, 100);
        };
        nodeType.prototype.onExecuted = function(msg) {
            if (msg?.gifs?.length) {
                const gif = msg.gifs[msg.gifs.length - 1]; 
                this._lastVideo = gif;
                localStorage.setItem(getStorageKey(this), JSON.stringify(gif));
                const url = buildPreviewUrl(gif);
                const ext = gif.extension || gif.filename.split('.').pop().toLowerCase();
                this._showPreview(ext, gif.format);
                
                if (ext === "gif") {
                    this._imgEl.src = url;
                } else if (gif.format !== "prores") {
                    this._videoEl.src = url;
                    this._videoEl.play().catch(()=>{});
                }
            }
        };
    }
});
