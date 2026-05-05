import json
import os
import struct
import subprocess
import tempfile
import shutil
import numpy as np
import folder_paths

try:
    from PIL import Image
    from PIL.PngImagePlugin import PngInfo
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

SUPPORTED_FORMATS = ["mp4", "webm", "mov", "avi", "gif"]


def write_wav(path, waveform, sample_rate):
    """
    Write a WAV file from a waveform tensor.

    waveform: torch.Tensor or np.ndarray, shape (channels, samples) or (samples,)
              Values expected in [-1.0, 1.0] float range.
    sample_rate: int
    """
    if hasattr(waveform, "cpu"):
        waveform = waveform.cpu().numpy()
    else:
        waveform = np.asarray(waveform, dtype=np.float32)

    if waveform.ndim == 1:
        waveform = waveform[np.newaxis, :]

    num_channels = waveform.shape[0]

    interleaved = waveform.T.astype(np.float32)
    pcm_int16   = (interleaved * 32767).clip(-32768, 32767).astype(np.int16)
    raw_bytes   = pcm_int16.tobytes()

    bits_per_sample = 16
    byte_rate       = sample_rate * num_channels * bits_per_sample // 8
    block_align     = num_channels * bits_per_sample // 8
    data_size       = len(raw_bytes)
    riff_size       = 36 + data_size

    with open(path, "wb") as f:
        f.write(b"RIFF")
        f.write(struct.pack("<I", riff_size))
        f.write(b"WAVE")
        f.write(b"fmt ")
        f.write(struct.pack("<I", 16))
        f.write(struct.pack("<H", 1))
        f.write(struct.pack("<H", num_channels))
        f.write(struct.pack("<I", sample_rate))
        f.write(struct.pack("<I", byte_rate))
        f.write(struct.pack("<H", block_align))
        f.write(struct.pack("<H", bits_per_sample))
        f.write(b"data")
        f.write(struct.pack("<I", data_size))
        f.write(raw_bytes)


def extract_audio_to_wav(audio, tmp_dir):
    if audio is None:
        return None

    if isinstance(audio, (str, bytes, os.PathLike)):
        p = str(audio)
        if os.path.isfile(p):
            return p
        return None

    if isinstance(audio, dict):
        if "path" in audio and isinstance(audio["path"], str):
            p = audio["path"]
            if os.path.isfile(p):
                return p

        if "waveform" in audio and "sample_rate" in audio:
            waveform    = audio["waveform"]
            sample_rate = int(audio["sample_rate"])

            if hasattr(waveform, "ndim"):
                if waveform.ndim == 3:
                    waveform = waveform[0]
            elif hasattr(waveform, "cpu"):
                waveform = waveform.cpu()
                if waveform.ndim == 3:
                    waveform = waveform[0]

            wav_path = os.path.join(tmp_dir, "audio_input.wav")
            write_wav(wav_path, waveform, sample_rate)
            return wav_path

    return None


def frames_to_video(frames, fps, output_path, audio_path=None, volume=1.0, fmt="mp4", pingpong=False):
    if not FFMPEG:
        raise RuntimeError("ffmpeg not found. Install ffmpeg and make sure it is on your PATH.")
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow is required. Run: pip install Pillow")

    tmp_dir = tempfile.mkdtemp()
    try:
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
        # GIF doesn't carry audio; pick the right audio codec per container
        audio_supported = fmt != "gif"
        if has_audio and audio_supported:
            cmd += ["-i", audio_path]

        if fmt == "gif":
            cmd += [
                "-vf",
                "fps=15,scale=480:-1:flags=lanczos,"
                "split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
            ]
        elif fmt == "webm":
            cmd += ["-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "0", "-pix_fmt", "yuv420p"]
        elif fmt == "mov":
            cmd += ["-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p"]
        elif fmt == "avi":
            cmd += ["-c:v", "mpeg4", "-q:v", "5", "-pix_fmt", "yuv420p"]
        else:  # mp4
            cmd += ["-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]

        # Audio codec must match the container format
        AUDIO_CODEC = {
            "mp4":  ("aac",        "192k"),
            "mov":  ("aac",        "192k"),
            "avi":  ("libmp3lame", "192k"),
            "webm": ("libopus",    "128k"),
        }

        if has_audio and audio_supported:
            a_codec, a_bitrate = AUDIO_CODEC.get(fmt, ("aac", "192k"))
            cmd += [
                "-filter_complex", f"[1:a]volume={volume:.4f}[aout]",
                "-map", "0:v",
                "-map", "[aout]",
                "-c:a", a_codec,
                "-b:a", a_bitrate,
                "-shortest",
            ]
        else:
            cmd += ["-an"]

        cmd.append(output_path)

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed (code {result.returncode}):\n{result.stderr}")

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def save_metadata_png(frames, out_folder, base_name, counter, prompt, extra_pnginfo):
    """
    Save the first frame as a PNG with the ComfyUI workflow + prompt embedded
    in its tEXt chunks — identical to how the built-in SaveImage node does it.
    Drag the PNG back into ComfyUI to restore the full workflow.

    Returns the saved filename (basename only) or None on failure.
    """
    if not PIL_AVAILABLE:
        print("[VideoCombinePlus] Warning: Pillow not available, cannot save metadata PNG.")
        return None

    try:
        png_meta = PngInfo()

        # extra_pnginfo contains the "workflow" key (the visual graph JSON)
        if extra_pnginfo is not None:
            for k, v in extra_pnginfo.items():
                png_meta.add_text(k, json.dumps(v) if not isinstance(v, str) else v)

        # prompt contains the node execution data (API format)
        if prompt is not None:
            png_meta.add_text("prompt", json.dumps(prompt))

        # Use the first frame as the thumbnail image
        first = np.array(frames[0])
        if first.dtype != np.uint8:
            first = (first * 255).clip(0, 255).astype(np.uint8)
        if first.ndim == 2:
            first = np.stack([first] * 3, axis=-1)

        meta_name = f"{base_name}_{counter:05d}.png"
        meta_path = os.path.join(out_folder, meta_name)
        Image.fromarray(first).save(meta_path, pnginfo=png_meta)
        print(f"[VideoCombinePlus] Metadata PNG saved: {meta_path}")
        return meta_name

    except Exception as e:
        print(f"[VideoCombinePlus] Warning: could not save metadata PNG: {e}")
        return None


class VideoCombinePlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("FLOAT", {
                    "default": 24.0, "min": 1.0, "max": 120.0, "step": 0.1,
                }),
                "format": (SUPPORTED_FORMATS, {"default": "mp4"}),
                "filename_prefix": ("STRING", {"default": "VideoCombinePlus"}),
            },
            "optional": {
                "audio": ("AUDIO",),
                "volume": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05,
                    "tooltip": "Audio volume multiplier (1.0 = original, 0.0 = mute, 2.0 = double)",
                }),
                "pingpong": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Append frames in reverse to create a boomerang loop",
                }),
                "save_metadata": ("BOOLEAN", {
                    "default": True,
                    "tooltip": (
                        "Save a companion PNG alongside the video with the full ComfyUI "
                        "workflow embedded as metadata. Drag the PNG back into ComfyUI "
                        "to restore the workflow."
                    ),
                }),
            },
            "hidden": {
                "vae": "VAE",
                "meta_batch": "VHS_BatchManager",
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
        format="mp4",
        filename_prefix="VideoCombinePlus",
        audio=None,
        volume=1.0,
        pingpong=False,
        save_metadata=True,
        vae=None,
        meta_batch=None,
        prompt=None,
        extra_pnginfo=None,
        unique_id=None,
    ):
        save_output = True

        # Sanitise format
        if format not in SUPPORTED_FORMATS:
            format = "mp4"

        output_dir = folder_paths.get_output_directory()

        (full_folder, filename, counter, subfolder, _) = folder_paths.get_save_image_path(
            filename_prefix, output_dir
        )

        out_name = f"{filename}_{counter:05d}.{format}"
        out_path = os.path.join(full_folder, out_name)

        frames = images.cpu().numpy() if hasattr(images, "cpu") else np.array(images)

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

        # ── Companion metadata PNG ────────────────────────────────────────────
        meta_png_name = None
        if save_metadata:
            meta_png_name = save_metadata_png(
                frames=frames,
                out_folder=full_folder,
                base_name=filename,
                counter=counter,
                prompt=prompt,
                extra_pnginfo=extra_pnginfo,
            )

        result_entry = {
            "filename": out_name,
            "subfolder": subfolder,
            "type": "output" if save_output else "temp",
            "format": format,
            "filename_prefix": filename_prefix,
            # Passed to the JS widget so it can show a metadata indicator
            "meta_png": meta_png_name,
        }

        filenames = (save_output, [out_path])

        return {"ui": {"gifs": [result_entry]}, "result": (filenames,)}


NODE_CLASS_MAPPINGS = {
    "VideoCombinePlus": VideoCombinePlus,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VideoCombinePlus": "Video Combine Plus 🎥🔊⏯️",
}
