import { NextResponse } from "next/server";
import { search } from "@/lib/search/engine";
import { getIndex } from "@/lib/search/loadIndex";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.trim() === "") {
    return NextResponse.json({ results: [], corrections: {}, tookMs: 0 });
  }

  const index = await getIndex();
  const start = performance.now();
  const response = search(index, q, { limit: 20 });
  const tookMs = performance.now() - start;

  return NextResponse.json({ ...response, tookMs });
}
