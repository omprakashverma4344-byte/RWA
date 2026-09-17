import { resolvePdf } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Streams a PDF from the upstream CDN through our backend.
 * The signed upstream URLs expire, so we decrypt fresh at request time.
 * Query: /api/pdf-proxy?courseId=735&contentId=735:12345
 *    or  /api/pdf-proxy?url=<encoded already-decrypted url>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  let target = url.searchParams.get("url") ?? "";

  if (!target) {
    const courseId = url.searchParams.get("courseId") ?? "";
    const contentId = url.searchParams.get("contentId") ?? "";
    if (!courseId || !contentId)
      return new Response("courseId & contentId (or url) required", {
        status: 400,
      });
    const resolved = await resolvePdf(contentId, courseId);
    if (!resolved) return new Response("PDF not found", { status: 404 });
    target = resolved;
  }

  try {
    const headers = {
      // some CDNs require a UA
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/pdf,*/*",
    };
    let upstream = await fetch(target, { headers, cache: "no-store" });
    if (!upstream.ok) {
      // The upstream CDN sometimes rejects direct fetches; the site's own
      // public PDF worker serves the same URL successfully — mirror it.
      const viaWorker = `https://sanjayxrwa2.sanjaykagra2003.workers.dev/pdf?url=${encodeURIComponent(target)}`;
      upstream = await fetch(viaWorker, {
        headers: { "User-Agent": headers["User-Agent"], Accept: "application/pdf,*/*" },
        cache: "no-store",
      });
    }
    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(
      e instanceof Error ? e.message : "pdf proxy failed",
      { status: 502 }
    );
  }
}
