# Camera alert service

A separate process that watches a camera, records a short clip when it sees
motion, and posts the clip's metadata to the shop app. The app stores the
metadata in SQLite and the shopkeeper reviews clips on `/alerts`.

The service holds no business data of its own. Alerts are flagged for human
review only — the service never judges what motion means.

## Setup (one time)

The service uses the same Python as the laptop (3.14 works; OpenCV ships
cp314 wheels). Create a virtual environment inside this folder:

```bash
cd services/camera
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

`ffmpeg` must be on the PATH (it already is on the shop laptop) because
browsers cannot play OpenCV's raw output; the service transcodes every clip
to H.264 MP4.

## Configuration

Settings come from environment variables. `CAMERA_ALERT_TOKEN` must match the
value in the app's `.env`:

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `CAMERA_ALERT_TOKEN` | (required) | Shared secret sent as `x-camera-token` |
| `CAMERA_APP_URL` | `http://127.0.0.1:3000` | Where the app runs |
| `CAMERA_DEVICE` | `0` | Camera index or device path, or `selftest` |
| `CAMERA_MEDIA_DIR` | `<repo>/media/camera` | Where clips are written |
| `CAMERA_MOTION_THRESHOLD` | `8` | Mean pixel difference that counts as motion (0–255) |
| `CAMERA_CLIP_SECONDS` | `10` | Length of one clip |
| `CAMERA_COOLDOWN_SECONDS` | `60` | Minimum seconds between clips |
| `CAMERA_FPS` | `15` | Capture frames per second |
| `CAMERA_FRAME_WIDTH` | `640` | Capture width |

## Run

With the app running (`npm run build && npm run start` or `npm run dev`):

```bash
cd services/camera
set -a; . ../../.env; set +a          # load CAMERA_ALERT_TOKEN from .env
.venv/bin/python capture.py
```

`CAMERA_DEVICE=selftest` replaces the camera with a synthetic moving shape so
the whole pipeline (motion → clip → transcode → post) can be tested without a
camera or a person in the room.

Stop with Ctrl+C. The app prunes old clip files (keeps the newest 200);
review state and audit rows survive clip deletion.

## Notes

- The shopkeeper starts the service when the shop should be watched (for
  example after day-close) and stops it otherwise. Scheduling is a later
  decision.
- Only motion triggers clips. No face detection, no person/zone detection, no
  automatic accusation — clips exist so the shopkeeper can look and decide.
