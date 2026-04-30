function loadVideo(gif, autoplay = true) {
  if (!gif) return;

  const url = buildPreviewUrl(gif);

  currentVideoURL = url;
  localStorage.setItem(getStorageKey(node), JSON.stringify(gif));

  // 🔥 FORCE RELOAD (important)
  video.pause();
  video.removeAttribute("src");
  video.load();

  // small cache-buster ONLY when reloading
  const reloadURL = url + "&t=" + Date.now();

  video.src = reloadURL;

  placeholder.style.display = "none";
  video.style.display = "block";

  video.onloadedmetadata = () => {
    if (autoplay) {
      video.play().catch(()=>{});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  };
}
