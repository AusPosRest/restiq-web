// Serves the guide's demo video with byte-range support (issue #419). Cloudflare
// static assets answer Range requests with a full 200, and iOS Safari won't play
// a <video> without 206 responses, so this fetches the static file and slices it.
const VIDEO_PATH = "/guides/making-demo-videos/restiq-demo.mp4";

/** Parses a single "bytes=a-b" / "bytes=a-" / "bytes=-n" range; null = unsatisfiable or malformed. */
export function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number;
  let end: number;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}

export async function GET(request: Request): Promise<Response> {
  const upstream = await fetch(new URL(VIDEO_PATH, request.url));
  if (!upstream.ok) return new Response("Video unavailable", { status: 502 });
  const bytes = await upstream.arrayBuffer();
  const size = bytes.byteLength;
  const headers = {
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=3600",
  };

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    return new Response(bytes, { status: 200, headers: { ...headers, "content-length": String(size) } });
  }
  const range = parseRange(rangeHeader, size);
  if (!range) {
    return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
  }
  return new Response(bytes.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      ...headers,
      "content-range": `bytes ${range.start}-${range.end}/${size}`,
      "content-length": String(range.end - range.start + 1),
    },
  });
}
