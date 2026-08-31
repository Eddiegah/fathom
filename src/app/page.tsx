import { getIndex } from "@/lib/search/loadIndex";
import { SearchInterface } from "./SearchInterface";

export default async function HomePage() {
  const index = await getIndex();
  const sources = Array.from(new Set(index.listDocuments().map((d) => d.source))).sort();

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">Fathom</h1>
          <p className="mt-2 text-sm text-muted">
            A real full-text search engine - inverted index, BM25 ranking, phrase and boolean queries, typo tolerance -
            over {index.totalDocs.toLocaleString()} paragraphs from five public-domain books.
          </p>
          <p className="mt-3 text-xs text-muted">{sources.join(" · ")}</p>
        </div>

        <SearchInterface totalDocs={index.totalDocs} vocabularySize={index.vocabularySize} />
      </div>
    </div>
  );
}
