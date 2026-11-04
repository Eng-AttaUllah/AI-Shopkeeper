import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { recordCameraAlert } from "@/modules/camera/service";

/**
 * Alert intake for the camera service (Phase 11).
 *
 * The camera process is a separate program on the same laptop; it
 * authenticates with a shared secret instead of a user session, so this route
 * is excluded from the proxy matcher and enforces its own checks:
 *
 * - `CAMERA_ALERT_TOKEN` must be set in `.env`; without it the endpoint is off.
 * - The token is compared in constant time.
 * - The payload is validated by the camera module, which also verifies the
 *   clip file exists on disk before recording the alert.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.CAMERA_ALERT_TOKEN;

  if (!expected) {
    return NextResponse.json(
      { error: "Camera alerts are not configured. Set CAMERA_ALERT_TOKEN." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-camera-token");

  if (
    !provided ||
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await recordCameraAlert(body);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: 400 },
    );
  }

  return NextResponse.json({ id: result.data.id }, { status: 201 });
}
