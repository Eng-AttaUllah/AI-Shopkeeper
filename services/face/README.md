# Face recognition research spike

Phase 12 is a research spike, not a product feature. This tool proves whether
local, offline face detection, embedding, and matching work well enough on the
shop laptop to justify building something real later. The deliverable is a
findings report with a go/no-go recommendation.

It uses OpenCV's YuNet face detector and SFace recognizer — fully offline after
a one-time model download. The Next.js app never runs models; this is a
separate process, like the camera service.

## Consent and data rules

- Only consenting people are enrolled (the owner and any consenting staff).
- Enrollment stores a numeric 128-dimension embedding plus the reference photo
  on this laptop. Embeddings are not reversible to a photo.
- `spike.py delete NAME` removes both the embedding and the reference photo.
- Photos and embeddings never leave the laptop. No cloud face APIs.
- A match is a hint for human review. The spike never accuses anyone.

## Setup (one time)

```bash
cd services/face
python3 -m venv .venv
.venv/bin/pip install -r ../camera/requirements.txt
```

Download the two models once (Apache-2.0, from OpenCV Zoo) into `models/`:

```bash
mkdir -p models
curl -L -o models/face_detection_yunet_2023mar.onnx \
  https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
curl -L -o models/face_recognition_sface_2021dec.onnx \
  https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx
```

## Run

```bash
cd services/face
.venv/bin/python spike.py capture attaullah   # photo from the webcam
.venv/bin/python spike.py enroll attaullah data/photos/attaullah.jpg
.venv/bin/python spike.py list
.venv/bin/python spike.py match data/photos/probe.jpg
.venv/bin/python spike.py evaluate            # similarity table, everyone vs everyone
.venv/bin/python spike.py delete attaullah    # removes embedding + photo
```

## Configuration

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `FACE_CAMERA_DEVICE` | `0` | Webcam index for `capture` |
| `FACE_CAPTURE_WIDTH` | `1280` | Capture width |
| `FACE_MATCH_THRESHOLD` | `0.363` | SFace cosine similarity match boundary |
| `FACE_MODELS_DIR` | `services/face/models` | Where the ONNX models live |
| `FACE_DATA_DIR` | `services/face/data` | Where embeddings and photos live |

## Notes

- `data/` and `models/` are git-ignored: biometric data and model binaries
  never belong in version control.
- SFace's published match boundary is 0.363 cosine similarity; the evaluation
  records the actual gap between same-person and different-person scores on
  this laptop before trusting any threshold.
