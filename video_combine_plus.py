"""
VideoCombinePlus — ComfyUI Custom Node
VideoHelperSuite-compatible Video Combine node with Volume + Play/Pause preview.
"""

import os
import struct
import subprocess
import tempfile
import shutil
import numpy as np
import folder_paths

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def get_ffmpeg():
    for cmd in ("ffmpeg", "ffmpeg.exe"):
        try:
            r = subprocess.run([cmd, "-version"], capture_output=True, timeout=5)
            if r.returncode == 0:
                return cmd
        except Exception:
            pass
    return None

FFMPEG = get_ffmpeg()


def write_wav(path, waveform, sample_rate):
    """
    Write a WAV file from a waveform tensor.

    waveform: torch.Tensor or np.ndarray, shape (channels, samples) or (samples,)
              Values expected in [-1.0, 1.0] float range.
    sample_rate: int
    """
    # Convert torch tensor → numpy if needed
    if hasattr(waveform, "cpu"):
        waveform = waveform.cpu().numpy()
    else:
        waveform = np.asarray(waveform, dtype=np.float32)

    # Ensure shape is (channels, samples)
    if waveform.ndim == 1:
        waveform = waveform[np.newaxis, :]   # mono → (1, N)

    num_channels = waveform.shape[0]
    num_samples  = waveform.shape[1]

    # Interleave channels: (channels, samples) → (samples, channels) → flatten
    interleaved = waveform.T.astype(np.float32)          # (N, C)
    pcm_int16   = (interleaved * 32767).clip(-32768, 32767).astype(np.int16)
    raw_bytes   = pcm_int16.tobytes()

    bits_per_sample = 16
    byte_rate       = sample_rate * num_channels * bits_per_sample // 8
    block_align     = num_channels * bits_per_sample // 8
    data_size       = len(raw_bytes)
    riff_size       = 36 + data_size

    with open(path, "wb") as f:
        # RIFF header
        f.write(b"RIFF")
        f.write(struct.pack("<I", riff_size))
        f.write(b"WAVE")
        # fmt chunk
        f.write(b"fmt ")
        f.write(struct.pack("<I", 16))                  # chunk size
        f.write(struct.pack("<H", 1))                   # PCM
        f.write(struct.pack("<H", num_channels))
        f.write(struct.pack("<I", sample_rate))
        f.write(struct.pack("<I", byte_rate))
        f.write(struct.pack("<H", block_align))
        f.write(struct.pack("<H", bits_per_sample))
        # data chunk
        f.write(b"data")
        f.write(struct.pack("<I", data_size))
        f.write(raw_bytes)


def extract_audio_to_wav(audio, tmp_dir):
    """
    Accept any of the common audio formats passed by ComfyUI nodes and
    return a path to a temp WAV file, or None if no usable audio.

    Supported formats:
      - ComfyUI AUDIO dict: {"waveform": tensor, "sample_rate": int}
      - VHS AUDIO dict:     {"path": str, ...}
      - Plain file path str / bytes
    """
    if audio is None:
        return None

    # ── Case 1: plain file path ────────────────────────────────────────────
    if isinstance(audio, (str, bytes, os.PathLike)):
        p = str(audio)
        if os.path.isfile(p):
            return p
        return None

    # ── Case 2: dict ──────────────────────────────────────────────────────
    if isinstance(audio, dict):
        # VHS stores a file path in "path"
        if "path" in audio and isinstance(audio["path"], str):
            p = audio["path"]
            if os.path.isfile(p):
                return p

        # ComfyUI native AUDIO type: waveform tensor + sample_rate
        if "waveform" in audio and "sample_rate" in audio:
            waveform    = audio["waveform"]
            sample_rate = int(audio["sample_rate"])

            # waveform may be (batch, channels, samples) — take first item
            if hasattr(waveform, "ndim"):
                if waveform.ndim == 3:
                    waveform = waveform[0]   # drop batch dim → (channels, samples)
            elif hasattr(waveform, "cpu"):
                waveform = waveform.cpu()
                if waveform.ndim == 3:
                    waveform = waveform[0]

            wav_path = os.path.join(tmp_dir, "audio_input.wav")
            write_wav(wav_path, waveform, sample_rate)
            return wav_path

    return None


def frames_to_video(frames, fps, output_path, audio_path=None,
                    volume=1.0, fmt="mp4", pingpong=False):
    if not FFMPEG:
        raise RuntimeError(
            "ffmpeg not found. Install ffmpeg and make sure it is on your PATH."
        )
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow is required. Run: pip install Pillow")

    tmp_dir = tempfile.mkdtemp()
    try:
        # Save frames as PNG sequence
        saved = []
        for i, frame in enumerate(frames):
            arr = np.array(frame)
            if arr.dtype != np.uint8:
                arr = (arr * 255).clip(0, 255).astype(np.uint8)
            if arr.ndim == 2:
                arr = np.stack([arr] * 3, axis=-1)
            img = Image.fromarray(arr)
            p = os.path.join(tmp_dir, f"frame_{i:06d}.png")
            img.save(p)
            saved.append(p)

        if pingpong and len(saved) > 2:
            ping_frames = saved + list(reversed(saved[1:-1]))
            for new_i, src in enumerate(ping_frames):
                dst = os.path.join(tmp_dir, f"seq_{new_i:06d}.png")
                shutil.copy(src, dst)
            pattern = os.path.join(tmp_dir, "seq_%06d.png")
        else:
            pattern = os.path.join(tmp_dir, "frame_%06d.png")

        cmd = [FFMPEG, "-y", "-framerate", str(fps), "-i", pattern]

        has_audio = audio_path and os.path.isfile(audio_path)
        if has_audio:
            cmd += ["-i", audio_path]

        # Video codec
        if fmt == "gif":
            cmd += [
                "-vf",
                "fps=15,scale=480:-1:flags=lanczos,"
                "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
            ]
        elif fmt == "webm":
            cmd += ["-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "0",
                    "-pix_fmt", "yuv420p"]
        else:
            cmd += ["-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart"]

        # Audio handling
        if has_audio:
            cmd += [
                "-filter_complex", f"[1:a]volume={volume:.4f}[aout]",
                "-map", "0:v",
                "-map", "[aout]",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
            ]
        else:
            cmd += ["-an"]

        cmd.append(output_path)

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(
                f"ffmpeg failed (code {result.returncode}):\n{result.stderr}"
            )

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


class VideoCombinePlus:
    """
    Video Combine Plus 🎥🔊⏯️
    A VideoHelperSuite-compatible combine node with:
      - Volume control (applied via ffmpeg audio filter)
      - Play/Pause preview widget in the ComfyUI frontend
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("FLOAT", {
                    "default": 24.0, "min": 1.0, "max": 120.0, "step": 0.1
                }),
                "volume": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 2.0,
                    "step": 0.01, "display": "slider"
                }),
            },
            "optional": {
                "audio": ("AUDIO",),
                "meta_batch": ("VHS_BatchManager",),
                "vae": ("VAE",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("VHS_FILENAMES",)
    RETURN_NAMES = ("Filenames",)
    OUTPUT_NODE = True
    CATEGORY = "Video Helper Suite 🎥🅥🅗🅢"
    FUNCTION = "combine_video"

    def combine_video(
        self,
        images,
        frame_rate,
        volume,
        audio=None,
        meta_batch=None,
        vae=None,
        prompt=None,
        extra_pnginfo=None,
        unique_id=None,
    ):
        # Hardcoded defaults for removed options
        filename_prefix = "VideoCombinePlus"
        format = "mp4"
        pingpong = False
        save_output = True

        output_dir = folder_paths.get_output_directory()

        (full_folder, filename, counter, subfolder, _) = \
            folder_paths.get_save_image_path(filename_prefix, output_dir)

        out_name = f"{filename}_{counter:05d}.{format}"
        out_path = os.path.join(full_folder, out_name)

        # Convert image tensor → numpy (N, H, W, C)
        if hasattr(images, "cpu"):
            frames = images.cpu().numpy()
        else:
            frames = np.array(images)

        volume = float(np.clip(volume, 0.0, 2.0))

        # Extract audio to a temp WAV — handles all ComfyUI audio formats
        tmp_audio_dir = tempfile.mkdtemp()
        try:
            audio_path = extract_audio_to_wav(audio, tmp_audio_dir)

            frames_to_video(
                frames=frames,
                fps=frame_rate,
                output_path=out_path,
                audio_path=audio_path,
                volume=volume,
                fmt=format,
                pingpong=pingpong,
            )
        finally:
            shutil.rmtree(tmp_audio_dir, ignore_errors=True)

        result_entry = {
            "filename": out_name,
            "subfolder": subfolder,
            "type": "output" if save_output else "temp",
        }

        filenames = (save_output, [out_path])

        return {
            "ui":     {"gifs": [result_entry]},
            "result": (filenames,),
        }


NODE_CLASS_MAPPINGS = {
    "VideoCombinePlus": VideoCombinePlus,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VideoCombinePlus": "Video Combine Plus 🎥🔊⏯️",
}
