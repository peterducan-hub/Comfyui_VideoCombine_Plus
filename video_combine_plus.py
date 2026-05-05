import os
import struct
import subprocess
import tempfile
import shutil
import json
import numpy as np
import folder_paths
from PIL import Image, PngImagePlugin

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
    if hasattr(waveform, "cpu"):
        waveform = waveform.cpu().numpy()
    else:
        waveform = np.asarray(waveform, dtype=np.float32)
    if waveform.ndim == 1:
        waveform = waveform[np.newaxis, :]
    num_channels = waveform.shape[0]
    num_samples  = waveform.shape[1]
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
    if audio is None: return None
    if isinstance(audio, (str, bytes, os.PathLike)):
        return str(audio) if os.path.isfile(str(audio)) else None
    if isinstance(audio, dict):
        if "path" in audio: return audio["path"]
        if "waveform" in audio and "sample_rate" in audio:
            wav_path = os.path.join(tmp_dir, "audio_input.wav")
            write_wav(wav_path, audio["waveform"], audio["sample_rate"])
            return wav_path
    return None

def frames_to_video(frames, fps, output_path, audio_path=None, fmt="mp4", quality="medium", pingpong=False, metadata=None):
    if not FFMPEG: raise RuntimeError("ffmpeg not found.")
    tmp_dir = tempfile.mkdtemp()
    try:
        saved = []
        for i, frame in enumerate(frames):
            arr = (np.array(frame) * 255).clip(0, 255).astype(np.uint8)
            img = Image.fromarray(arr)
            p = os.path.join(tmp_dir, f"f_{i:06d}.png")
            img.save(p)
            saved.append(p)
        if pingpong and len(saved) > 2:
            ping_frames = saved + list(reversed(saved[1:-1]))
            for ni, src in enumerate(ping_frames):
                shutil.copy(src, os.path.join(tmp_dir, f"s_{ni:06d}.png"))
            pattern = os.path.join(tmp_dir, "s_%06d.png")
        else:
            pattern = os.path.join(tmp_dir, "f_%06d.png")

        cmd = [FFMPEG, "-y", "-framerate", str(fps), "-i", pattern]
        if audio_path: cmd += ["-i", audio_path]

        crf = {"high": "18", "medium": "24", "low": "32"}.get(quality, "24")
        
        # Inject Metadata if provided (using a file to avoid WinError 206 command line limit)
        if metadata:
            meta_str = json.dumps(metadata)
            meta_file = os.path.join(tmp_dir, "metadata.txt")
            with open(meta_file, "w", encoding="utf-8") as f:
                f.write(";FFMETADATA1\n")
                e_meta = meta_str.replace('\\', '\\\\').replace('=', '\\=').replace(';', '\\;').replace('#', '\\#').replace('\n', '\\\n')
                f.write(f"comment={e_meta}\n")
                f.write(f"description={e_meta}\n")
            
            meta_idx = 1
            if audio_path: meta_idx += 1
            cmd += ["-i", meta_file, "-map_metadata", str(meta_idx)]

        if fmt == "gif":
            cmd += ["-vf", "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"]
        elif fmt == "webm":
            cmd += ["-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0", "-pix_fmt", "yuv420p", "-deadline", "realtime", "-cpu-used", "1"]
        elif fmt == "prores":
            cmd += ["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le"]
        elif fmt == "h265":
            cmd += ["-c:v", "libx265", "-crf", crf, "-pix_fmt", "yuv420p"]
        elif fmt == "mov":
            cmd += ["-c:v", "libx264", "-crf", crf, "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
        else:
            cmd += ["-c:v", "libx264", "-crf", crf, "-pix_fmt", "yuv420p", "-movflags", "+faststart"]

        if audio_path: 
            if fmt == "webm":
                cmd += ["-c:a", "libopus", "-b:a", "128k"]
            else:
                cmd += ["-c:a", "aac", "-b:a", "192k"]
            cmd += ["-shortest"]
        else: 
            cmd += ["-an"]
        
        cmd.append(output_path)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"FFMPEG Error: {result.stderr}")
            if "codec" in result.stderr.lower() and audio_path:
                 print("Retrying without audio...")
                 cmd_no_audio = [c for c in cmd if c not in ["-i", audio_path, "-c:a", "aac", "libopus", "-b:a", "128k", "192k", "-shortest"]]
                 cmd_no_audio[-1] = output_path.replace(".webm", "_silent.webm")
                 subprocess.run(cmd_no_audio + ["-an", output_path])
    finally: shutil.rmtree(tmp_dir, ignore_errors=True)

class VideoCombinePlus:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("FLOAT", {"default": 24.0, "min": 1.0, "max": 120.0, "step": 0.1}),
                "format": (["mp4", "h265", "webm", "mov", "prores", "gif"], {"default": "mp4"}),
                "quality": (["high", "medium", "low"], {"default": "medium"}),
                "pingpong": ("BOOLEAN", {"default": False}),
                "filename_prefix": ("STRING", {"default": "VideoPlus"}),
            },
            "optional": {"audio": ("AUDIO",)},
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }

    RETURN_TYPES = ("VHS_FILENAMES",)
    RETURN_NAMES = ("Filenames",)
    OUTPUT_NODE = True
    CATEGORY = "Video Helper Suite 🎥🅥🅗🅢"
    FUNCTION = "combine_video"

    def combine_video(self, images, frame_rate, format, quality, pingpong, filename_prefix, audio=None, prompt=None, extra_pnginfo=None):
        output_dir = folder_paths.get_output_directory()
        (full_folder, filename, counter, subfolder, _) = folder_paths.get_save_image_path(filename_prefix, output_dir)
        
        ext_map = {"mp4": "mp4", "h265": "mp4", "webm": "webm", "mov": "mov", "prores": "mov", "gif": "gif"}
        ext = ext_map.get(format, "mp4")
        
        base_name = f"{filename}_{counter:05d}"
        out_name = f"{base_name}.{ext}"
        out_path = os.path.join(full_folder, out_name)
        
        metadata = {}
        if prompt is not None:
             metadata["prompt"] = prompt
        if extra_pnginfo is not None:
             metadata["extra_pnginfo"] = extra_pnginfo

        # --- SAVE METADATA PNG ---
        png_path = os.path.join(full_folder, f"{base_name}.png")
        try:
            first_frame = images[0].cpu().numpy() if hasattr(images, "cpu") else np.array(images[0])
            first_frame = (first_frame * 255).clip(0, 255).astype(np.uint8)
            img = Image.fromarray(first_frame)
            
            metadata_info = PngImagePlugin.PngInfo()
            if prompt is not None:
                metadata_info.add_text("prompt", json.dumps(prompt))
            if extra_pnginfo is not None:
                for k, v in extra_pnginfo.items():
                    metadata_info.add_text(k, json.dumps(v))
            
            img.save(png_path, pnginfo=metadata_info)
        except Exception as e:
            print(f"Error saving metadata PNG: {e}")

        # --- GENERATE VIDEO ---
        tmp_audio_dir = tempfile.mkdtemp()
        try:
            audio_path = extract_audio_to_wav(audio, tmp_audio_dir)
            frames_to_video(images, frame_rate, out_path, audio_path, format, quality, pingpong, metadata=metadata)
        finally: shutil.rmtree(tmp_audio_dir, ignore_errors=True)

        return {
            "ui": {"gifs": [{"filename": out_name, "subfolder": subfolder, "type": "output", "format": format, "extension": ext}]},
            "result": ((True, [out_path, png_path]),)
        }

NODE_CLASS_MAPPINGS = {"VideoCombinePlus": VideoCombinePlus}
NODE_DISPLAY_NAME_MAPPINGS = {"VideoCombinePlus": "Video Combine Plus 🎥🔊⏯️"}

