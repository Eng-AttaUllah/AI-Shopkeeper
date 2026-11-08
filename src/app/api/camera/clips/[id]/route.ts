import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { requireShopkeeper } from "@/lib/require-user";
import { getCameraAlert } from "@/modules/camera/queries";
import { cameraClipPath } from "@/modules/camera/service";

/**
 * Stream an alert clip to the shopkeeper.
 *
 * Clips are never under `public/`, so this authenticated route is the only way
 * to watch one. A `CUSTOMER` session gets 403; an anonymous request gets 401.
 * Range requests are honoured so the browser can seek within the clip.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { shop } = await requireShopkeeper();

  const { id } = await params;
  const alert = await getCameraAlert(shop.id, id);

  if (!alert) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }

  // Defense in depth: the stored name was validated on intake, but never
  // trust a database value when building a filesystem path.
  if (!/^[A-Za-z0-9._-]+$/.test(alert.clipPath) || alert.clipPath.startsWith(".")) {
    return NextResponse.json({ error: "Invalid clip name." }, { status: 400 });
  }

  const filePath = cameraClipPath(alert.clipPath);

  let size: number;

  try {
    const stat = await fs.stat(filePath);
    size = stat.size;
  } catch {
    // Retention may have deleted the file; the alert row survives.
    return NextResponse.json(
      { error: "The clip file is no longer available." },
      { status: 404 },
    );
  }

  const rangeHeader = _request.headers.get("range");

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());

    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

      if (Number.isFinite(start) && start <= end && start < size) {
        const stream = Readable.toWeb(
          createReadStream(filePath, { start, end }),
        ) as ReadableStream;

        return new Response(stream, {
          status: 206,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
          },
        });
      }
    }
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
    },
  });
}
