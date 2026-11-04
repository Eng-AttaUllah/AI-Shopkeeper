# Face Recognition Research Findings — Phase 12

Date: 2026-11-04 · Laptop: shop laptop (Node 22 host, Python 3.14.4, cv2 5.0.0)

## What was tested

A local, fully offline pipeline in `services/face/` (separate process, same
boundary as the camera service):

- **Detection:** OpenCV YuNet (`face_detection_yunet_2023mar.onnx`, 232 KB)
- **Embedding:** OpenCV SFace (`face_recognition_sface_2021dec.onnx`, 37 MB),
  128-dimension vectors, cosine similarity matching
- Models downloaded once (Apache-2.0, OpenCV Zoo); everything afterwards runs
  with no network. The Next.js app never runs models.

## Results

| Check | Result |
| ----- | ------ |
| Probe match, seconds later, different light (78/255 brightness) | **0.894** — MATCH |
| Probe match, different pose and light (94/255) | **0.785** — MATCH |
| Probe match after delete + re-enroll cycle | **0.794** — MATCH |
| SFace published match boundary | 0.363 |
| Match run time (including model load) | ~1.2 s |
| Deletion of an enrollment | Verified: removes embedding **and** reference photo |

All measured same-person scores (0.785–0.894) sit far above the 0.363
boundary, in dim indoor light at about one metre from a laptop webcam — close
to counter-like conditions. The pipeline found faces reliably once two real
problems were fixed (below).

## Problems found and fixed during the spike

1. **Webcams deliver black frames until auto-exposure settles.** The first
   capture returned a fully black frame. Fixed by grabbing a 45-frame warm-up
   burst and keeping the brightest frame; a warning fires below 25/255
   brightness.
2. **Browsers can't play OpenCV's raw video** (camera phase) and OpenCV 5.0
   prints harmless `net_impl_backend` warnings on every model call.

## Limitations — read before trusting the numbers

- **Single subject.** Only the owner's face was enrolled (consent rules). The
  gap between same-person and different-person scores — the number that
  actually decides whether matching works — was **not measured**. OpenCV's
  published boundary suggests it is comfortable, but that is not evidence from
  this shop.
- **No liveness or anti-spoofing.** A printed photo or a phone screen held to
  the camera would likely match. Any product use must treat recognition as a
  hint, never as proof of identity.
- One lighting condition, one distance, one session. Shop conditions vary
  more than this.

## Go/no-go recommendation

**GO — for a hint-only feature, after a multi-subject evaluation.**

A scoped product feature worth building next: label Phase 11 alert clips with
matched known customers ("might be X, 0.82 — check the clip"), using the
shopkeeper-enrolls-with-consent flow on the customer detail page that the
owner already chose. Requirements before building it:

1. Enroll 5–10 consenting people and measure the same-person vs
   different-person score gap on this laptop.
2. Keep the Phase 11 invariant absolute: recognition never accuses, never
   names anyone automatically in a surface the customer can see, and never
   gates access to anything.
3. Deletion on request must work exactly as demonstrated here.

**NO-GO** for anything beyond hints: access control, attendance, or any
automatic judgement. SFace has no liveness checking, and the ethics of biometric
surveillance in a small shop outweigh the convenience.

## Data handling (as decided by the owner)

- Stored per enrollment: 128-float embedding + reference photo, on this laptop
  only, git-ignored.
- `spike.py delete NAME` removes both; verified during the spike.
- No cloud face APIs; models are local files.
