"""Face recognition research spike (Phase 12).

A local, fully offline pipeline: detect a face with OpenCV's YuNet model,
compute a 128-dimension embedding with SFace, and match probe photos against
enrolled faces by cosine similarity.

This is a research tool, not a product feature. It enrolls only consenting
people (the owner and any consenting staff), stores a numeric embedding plus
the reference photo on this laptop, and deletes both on request. A match is
a hint for human review — the spike never accuses anyone of anything.

Usage:
    python spike.py capture NAME      # take a photo from the webcam
    python spike.py enroll NAME PHOTO # enroll a face from a photo file
    python spike.py match PHOTO       # rank enrolled faces against a probe
    python spike.py list              # show enrolled faces
    python spike.py delete NAME       # remove an enrollment (embedding + photo)
    python spike.py evaluate          # self-check: everyone vs everyone

Configuration comes from environment variables (see README.md).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

SERVICE_DIR = Path(__file__).resolve().parent

MODELS_DIR = Path(os.environ.get("FACE_MODELS_DIR", SERVICE_DIR / "models"))
DATA_DIR = Path(os.environ.get("FACE_DATA_DIR", SERVICE_DIR / "data"))
PHOTOS_DIR = DATA_DIR / "photos"
EMBEDDINGS_PATH = DATA_DIR / "embeddings.json"

DETECTOR_MODEL = MODELS_DIR / "face_detection_yunet_2023mar.onnx"
RECOGNIZER_MODEL = MODELS_DIR / "face_recognition_sface_2021dec.onnx"

CAMERA_DEVICE = int(os.environ.get("FACE_CAMERA_DEVICE", "0"))
CAPTURE_WIDTH = int(os.environ.get("FACE_CAPTURE_WIDTH", "1280"))

# SFace cosine similarity: 1 is a perfect match, negative is unrelated.
# OpenCV's own examples treat 0.363 as the match/no-match boundary.
MATCH_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.363"))


def log(message: str) -> None:
    print(message, flush=True)


def load_models():
    if not DETECTOR_MODEL.exists() or not RECOGNIZER_MODEL.exists():
        log(
            "ERROR: models missing. Download them once (see README.md) into "
            f"{MODELS_DIR}"
        )
        sys.exit(1)

    detector = cv2.FaceDetectorYN.create(str(DETECTOR_MODEL), "", (320, 320), 0.6)
    recognizer = cv2.FaceRecognizerSF.create(str(RECOGNIZER_MODEL), "")
    return detector, recognizer


def load_enrollments() -> dict:
    if not EMBEDDINGS_PATH.exists():
        return {}
    return json.loads(EMBEDDINGS_PATH.read_text())


def save_enrollments(enrollments: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    EMBEDDINGS_PATH.write_text(json.dumps(enrollments, indent=2))


def detect_largest_face(detector, recognizer, image_bgr):
    """Return the aligned 112x112 face crop, or None when no face is found."""
    height, width = image_bgr.shape[:2]
    detector.setInputSize((width, height))
    _count, faces = detector.detect(image_bgr)

    if faces is None or len(faces) == 0:
        return None

    # When several faces appear, use the largest one: the spike enrolls one
    # consenting person at a time.
    largest = max(faces, key=lambda face: face[2] * face[3])
    aligned = recognizer.alignCrop(image_bgr, largest)
    return aligned


def embedding_for(recognizer, aligned_face) -> list[float]:
    feature = recognizer.feature(aligned_face)
    return feature.flatten().astype(float).tolist()


def capture_photo(name: str) -> Path:
    """Grab a single frame from the webcam and save it for enrollment."""
    capture = cv2.VideoCapture(CAMERA_DEVICE)

    if not capture.isOpened():
        log(f"ERROR: cannot open camera {CAMERA_DEVICE}")
        sys.exit(1)

    capture.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    path = PHOTOS_DIR / f"{name}.jpg"

    # Webcams deliver black frames until auto-exposure settles; grab a
    # warm-up burst and keep the brightest frame of a short run.
    best_frame = None
    best_brightness = -1.0

    for _ in range(45):
        ok, frame = capture.read()

        if not ok:
            continue

        brightness = float(cv2.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))[0])

        if brightness > best_brightness:
            best_brightness = brightness
            best_frame = frame

    capture.release()

    if best_frame is None:
        log("ERROR: no frame from the camera")
        sys.exit(1)

    if best_brightness < 25:
        log(
            f"WARNING: the frame is very dark (brightness {best_brightness:.0f}/255); "
            "turn a light towards your face"
        )

    cv2.imwrite(str(path), best_frame)
    log(f"saved {path} (brightness {best_brightness:.0f}/255)")
    return path


def enroll(name: str, photo_path: Path) -> None:
    detector, recognizer = load_models()
    image = cv2.imread(str(photo_path))

    if image is None:
        log(f"ERROR: cannot read {photo_path}")
        sys.exit(1)

    aligned = detect_largest_face(detector, recognizer, image)

    if aligned is None:
        log("ERROR: no face found in the photo; try better light and look straight")
        sys.exit(1)

    enrollments = load_enrollments()

    if name in enrollments:
        log(f"ERROR: {name} is already enrolled; delete first to re-enroll")
        sys.exit(1)

    stored_photo = PHOTOS_DIR / f"{name}.jpg"
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(stored_photo), image)

    enrollments[name] = {
        "embedding": embedding_for(recognizer, aligned),
        "photo": str(stored_photo.relative_to(SERVICE_DIR)),
        "enrolledAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "consent": "given",
    }
    save_enrollments(enrollments)
    log(f"enrolled {name} ({len(enrollments[name]['embedding'])} dims)")


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=float)
    vb = np.asarray(b, dtype=float)
    denominator = np.linalg.norm(va) * np.linalg.norm(vb)

    if denominator == 0:
        return 0.0

    return float(np.dot(va, vb) / denominator)


def match(photo_path: Path) -> None:
    detector, recognizer = load_models()
    image = cv2.imread(str(photo_path))

    if image is None:
        log(f"ERROR: cannot read {photo_path}")
        sys.exit(1)

    aligned = detect_largest_face(detector, recognizer, image)

    if aligned is None:
        log("ERROR: no face found in the probe photo")
        sys.exit(1)

    probe = embedding_for(recognizer, aligned)
    enrollments = load_enrollments()

    if not enrollments:
        log("No one is enrolled yet.")
        return

    scored = sorted(
        (
            (cosine_similarity(probe, entry["embedding"]), name)
            for name, entry in enrollments.items()
        ),
        reverse=True,
    )

    log(f"probe: {photo_path} (match threshold {MATCH_THRESHOLD})")

    for score, name in scored:
        verdict = "MATCH" if score >= MATCH_THRESHOLD else "no match"
        log(f"  {score:.3f}  {verdict:9}  {name}")


def delete(name: str) -> None:
    enrollments = load_enrollments()

    if name not in enrollments:
        log(f"ERROR: {name} is not enrolled")
        sys.exit(1)

    photo = SERVICE_DIR / enrollments[name]["photo"]
    del enrollments[name]
    save_enrollments(enrollments)

    if photo.exists():
        photo.unlink()

    log(f"deleted {name}: embedding and reference photo removed")


def list_enrolled() -> None:
    enrollments = load_enrollments()

    if not enrollments:
        log("No one is enrolled yet.")
        return

    for name, entry in sorted(enrollments.items()):
        log(f"{name}  enrolled {entry['enrolledAt']}  photo {entry['photo']}")


def evaluate() -> None:
    """Self-check: every enrolled face against every other, and against itself."""
    detector, recognizer = load_models()
    enrollments = load_enrollments()

    if len(enrollments) < 2:
        log("Enroll at least two people to evaluate separation.")
        return

    names = sorted(enrollments)
    log(f"self-similarity and cross-similarity (threshold {MATCH_THRESHOLD})")
    log(f"{'':12}" + "".join(f"{name[:10]:>12}" for name in names))

    for row_name in names:
        row_embedding = enrollments[row_name]["embedding"]
        cells = []

        for column_name in names:
            score = cosine_similarity(row_embedding, enrollments[column_name]["embedding"])
            cells.append(f"{score:.3f}")

        log(f"{row_name[:12]:12}" + "".join(f"{cell:>12}" for cell in cells))

    self_scores = [
        cosine_similarity(enrollments[name]["embedding"], enrollments[name]["embedding"])
        for name in names
    ]
    log("self-similarity is 1.000 by definition; the useful number is the gap")
    log("between the diagonal and the off-diagonal scores.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Face recognition research spike")
    sub = parser.add_subparsers(dest="command", required=True)

    capture_parser = sub.add_parser("capture", help="take an enrollment photo from the webcam")
    capture_parser.add_argument("name")

    enroll_parser = sub.add_parser("enroll", help="enroll a face from a photo file")
    enroll_parser.add_argument("name")
    enroll_parser.add_argument("photo", type=Path)

    match_parser = sub.add_parser("match", help="rank enrolled faces against a probe photo")
    match_parser.add_argument("photo", type=Path)

    sub.add_parser("list", help="show enrolled faces")

    delete_parser = sub.add_parser("delete", help="remove an enrollment and its photo")
    delete_parser.add_argument("name")

    sub.add_parser("evaluate", help="self-check similarity table")

    args = parser.parse_args()

    if args.command == "capture":
        capture_photo(args.name)
    elif args.command == "enroll":
        enroll(args.name, args.photo)
    elif args.command == "match":
        match(args.photo)
    elif args.command == "list":
        list_enrolled()
    elif args.command == "delete":
        delete(args.name)
    elif args.command == "evaluate":
        evaluate()

    return 0


if __name__ == "__main__":
    sys.exit(main())
