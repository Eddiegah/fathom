import { readFile } from "node:fs/promises";
import path from "node:path";
import { InvertedIndex, type SerializedIndex } from "./invertedIndex";

// Loaded once per server process and cached - the index is ~8MB of
// JSON; re-parsing it on every request would be wasteful and slow.
const globalForIndex = globalThis as unknown as { fathomIndex?: Promise<InvertedIndex> };

async function loadFromDisk(): Promise<InvertedIndex> {
  const filePath = path.join(process.cwd(), "src", "data", "index.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as SerializedIndex;
  return InvertedIndex.fromJSON(data);
}

export function getIndex(): Promise<InvertedIndex> {
  if (!globalForIndex.fathomIndex) globalForIndex.fathomIndex = loadFromDisk();
  return globalForIndex.fathomIndex;
}
