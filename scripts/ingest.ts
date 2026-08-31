import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { InvertedIndex } from "../src/lib/search/invertedIndex";

interface BookSource {
  id: string;
  title: string;
  gutenbergId: number;
}

const BOOKS: BookSource[] = [
  { id: "alice", title: "Alice's Adventures in Wonderland", gutenbergId: 11 },
  { id: "pride", title: "Pride and Prejudice", gutenbergId: 1342 },
  { id: "holmes", title: "The Adventures of Sherlock Holmes", gutenbergId: 1661 },
  { id: "timemachine", title: "The Time Machine", gutenbergId: 35 },
  { id: "christmascarol", title: "A Christmas Carol", gutenbergId: 46 },
];

async function fetchBookText(gutenbergId: number): Promise<string> {
  const urls = [`https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`, `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`];
  for (const url of urls) {
    const res = await fetch(url);
    if (res.ok) return res.text();
  }
  throw new Error(`Could not fetch Gutenberg book ${gutenbergId} from any known URL.`);
}

/** Project Gutenberg wraps every text with a standard license header and
 * footer - strip both so the index only contains the book's own words,
 * not boilerplate that would otherwise dominate every document. */
function stripGutenbergBoilerplate(text: string): string {
  const startMarker = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
  const endMarker = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;

  const startMatch = text.match(startMarker);
  const endMatch = text.match(endMarker);

  const start = startMatch ? startMatch.index! + startMatch[0].length : 0;
  const end = endMatch ? endMatch.index! : text.length;

  return text.slice(start, end).trim();
}

/** Splits a book into paragraph-level documents: split on blank lines,
 * join wrapped lines within a paragraph, drop anything too short to be
 * a meaningful searchable unit (chapter numbers, stray whitespace). */
function splitIntoParagraphs(text: string, minLength: number = 200): string[] {
  const rawParagraphs = text.split(/\n\s*\n/);
  return rawParagraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= minLength);
}

async function main() {
  const index = new InvertedIndex();
  let totalParagraphs = 0;

  for (const book of BOOKS) {
    console.log(`Fetching "${book.title}" (Gutenberg #${book.gutenbergId})...`);
    const raw = await fetchBookText(book.gutenbergId);
    const body = stripGutenbergBoilerplate(raw);
    const paragraphs = splitIntoParagraphs(body);

    console.log(`  -> ${paragraphs.length} paragraphs`);
    paragraphs.forEach((paragraph, i) => {
      index.addDocument({
        id: `${book.id}-${i}`,
        title: book.title,
        body: paragraph,
        source: book.title,
      });
    });
    totalParagraphs += paragraphs.length;
  }

  console.log(`\nIndexed ${totalParagraphs} paragraphs across ${BOOKS.length} books.`);
  console.log(`Vocabulary size: ${index.vocabularySize} unique stems.`);

  const outDir = path.join(__dirname, "..", "src", "data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "index.json");
  await writeFile(outPath, JSON.stringify(index.toJSON()));
  console.log(`Wrote index to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
