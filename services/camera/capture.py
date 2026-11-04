"""Camera alert service (Phase 11).

A separate process that watches a camera, records a short clip when it sees
motion, and posts the clip's metadata to the shop app over local HTTP.

The service holds no business data of its own: it reads the camera, writes
clip files into media/camera/, and calls one app endpoint. Alerts are flagged
for human review only — the service never judges what motion means.

Usage:
    python capture.py            # watch the camera configured in the env
    CAMERA_DEVICE=selftest python capture.py
                                 # synthetic moving shape, no camera needed

Configuration comes from environment variables (see README.md).
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

import cv2

SERVICE_DIR = Path(__file__).resolve().parent
REPO_ROOT = SERVICE_DIR.parent.parent

# --- Configuration -----------------------------------------------------------

CAMERA_DEVICE = os.environ.get("CAMERA_DEVICE", "0")
APP_URL = os.environ.get("CAMERA_APP_URL", "http://127.0.0.1:3000").rstrip("/")
ALERT_TOKEN = os.environ.get("CAMERA_ALERT_TOKEN", "")
MEDIA_DIR = Path(
    os.environ.get("CAMERA_MEDIA_DIR", REPO_ROOT / "media" / "camera")
)
MOTION_THRESHOLD = float(os.environ.get("CAMERA_MOTION_THRESHOLD", "8"))
CLIP_SECONDS = float(os.environ.get("CAMERA_CLIP_SECONDS", "10"))
COOLDOWN_SECONDS = float(os.environ.get("CAMERA_COOLDOWN_SECONDS", "60"))
FPS = int(os.environ.get("CAMERA_FPS", "15"))
FRAME_WIDTH = int(os.environ.get("CAMERA_FRAME_WIDTH", "640"))

# Frames are scaled down before the motion check: cheaper and less noisy.
MOTION_WIDTH = 320


def log(message: str) -> None:
    print(f"[{datetime.now().astimezone().isoformat(timespec='seconds')}] {message}", flush=True)


def open_capture(device: str) -> cv2.VideoCapture:
    """Open a camera by index or path. `selftest` returns None (synthetic)."""
    if device == "selftest":
        return None

    index: int | str

    if device.isdigit():
        index = int(device)
    else:
        index = device

    capture = cv2.VideoCapture(index)

    if not capture.isOpened():
        raise RuntimeError(f"Cannot open camera {device!r}")

    capture.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    capture.set(cv2.CAP_PROP_FPS, FPS)

    return capture


def read_frame(capture: cv2.VideoCapture | None, step: int):
    """One frame from the camera, or a synthetic frame for the self test."""
    if capture is None:
        frame = _selftest_frame(step)
    else:
        ok, frame = capture.read()

        if not ok:
            return None

    return frame


_SELFTEST_SIZE = (320, 240)


def _selftest_frame(step: int):
    """A dark room with a bright rectangle that moves every other second."""
    import numpy as np

    frame = np.zeros((_SELFTEST_SIZE[1], _SELFTEST_SIZE[0], 3), dtype=np.uint8)
    frame[:] = (20, 20, 20)

    x = 20 + (step % 8) * 30
    cv2.rectangle(frame, (x, 80), (x + 60, 160), (240, 240, 240), -1)

    return frame


def prepare(frame):
    """Grayscale, blurred, downscaled copy used for the motion check."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (21, 21), 0)

    scale = MOTION_WIDTH / gray.shape[1]

    if scale < 1:
        gray = cv2.resize(
            gray,
            (MOTION_WIDTH, max(1, int(gray.shape[0] * scale))),
        )

    return gray


def motion_level(previous, current) -> float:
    """Mean absolute pixel difference, 0 (identical) to 255 (all changed)."""
    import numpy as np

    diff = cv2.absdiff(previous, current)
    return float(np.mean(diff))


def record_clip(capture: cv2.VideoCapture | None, first_frame) -> tuple[Path, int] | None:
    """Record CLIP_SECONDS of video, transcode to H.264 MP4, return the path."""
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now().astimezone()
    raw_path = MEDIA_DIR / f"raw-{stamp.strftime('%Y%m%d-%H%M%S')}.avi"
    clip_path = MEDIA_DIR / f"clip-{stamp.strftime('%Y%m%d-%H%M%S')}.mp4"

    height, width = first_frame.shape[:2]
    writer = cv2.VideoWriter(
        str(raw_path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (width, height)
    )

    if not writer.isOpened():
        log("ERROR: cannot open video writer")
        return None

    frames_written = 0
    deadline = time.monotonic() + CLIP_SECONDS
    frame_interval = 1.0 / FPS

    writer.write(first_frame)
    frames_written += 1

    while time.monotonic() < deadline:
        frame = read_frame(capture, frames_written)

        if frame is None:
            break

        writer.write(frame)
        frames_written += 1
        time.sleep(frame_interval)

    writer.release()

    if frames_written < 2:
        raw_path.unlink(missing_ok=True)
        return None

    # Browsers cannot play OpenCV's mp4v output; transcode to H.264 with the
    # ffmpeg already on the laptop.
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel", "error",
            "-i", str(raw_path),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(clip_path),
        ],
        capture_output=True,
    )

    raw_path.unlink(missing_ok=True)

    if result.returncode != 0:
        log(f"ERROR: ffmpeg failed: {result.stderr.decode(errors='replace')[:400]}")
        return None

    duration_ms = int(frames_written / FPS * 1000)

    return clip_path, duration_ms


def post_alert(clip_path: Path, captured_at: datetime, duration_ms: int) -> bool:
    """Post clip metadata to the app. Returns True when the app accepted it."""
    payload = json.dumps(
        {
            "clipPath": clip_path.name,
            "capturedAt": captured_at.isoformat(timespec="seconds"),
            "durationMs": duration_ms,
        }
    ).encode()

    request = urllib.request.Request(
        f"{APP_URL}/api/camera/alerts",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-camera-token": ALERT_TOKEN,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode(errors="replace")

        log(f"alert accepted: {clip_path.name} -> {body}")
        return True
    except urllib.error.HTTPError as error:
        log(
            f"ERROR: app rejected alert {clip_path.name}: "
            f"{error.code} {error.read().decode(errors='replace')[:300]}"
        )
        return False
    except urllib.error.URLError as error:
        log(f"ERROR: cannot reach the app: {error.reason}")
        return False


def main() -> int:
    if not ALERT_TOKEN:
        log("ERROR: CAMERA_ALERT_TOKEN is not set. Add it to .env first.")
        return 1

    log(f"starting; device={CAMERA_DEVICE!r} app={APP_URL} media={MEDIA_DIR}")

    capture = open_capture(CAMERA_DEVICE)
    previous = None
    last_alert = 0.0
    step = 0
    running = True

    def stop(_signum, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    while running:
        frame = read_frame(capture, step)
        step += 1

        if frame is None:
            log("WARN: no frame; retrying in 2s")
            time.sleep(2)
            continue

        current = prepare(frame)

        if previous is not None:
            level = motion_level(previous, current)

            if (
                level > MOTION_THRESHOLD
                and time.monotonic() - last_alert > COOLDOWN_SECONDS
            ):
                log(f"motion {level:.1f} > {MOTION_THRESHOLD}; recording clip")
                started = datetime.now().astimezone()
                clip = record_clip(capture, frame)

                if clip is not None:
                    clip_path, duration_ms = clip
                    post_alert(clip_path, started, duration_ms)

                last_alert = time.monotonic()
                previous = None
                continue

        previous = current
        time.sleep(1.0 / FPS)

    if capture is not None:
        capture.release()

    log("stopped")

    return 0


if __name__ == "__main__":
    sys.exit(main())
