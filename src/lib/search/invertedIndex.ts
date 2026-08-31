import { analyze } from "./tokenizer";

export interface Posting {
  docId: string;
  termFrequency: number;
  positions: number[];
}

export interface IndexedDocument {
  id: string;
  title: string;
  source: string;
  body: string;
  tokenCount: number;
}

export interface SerializedIndex {
  postings: Record<string, Posting[]>;
  documents: IndexedDocument[];
  totalDocs: number;
  avgDocLength: number;
}

export class InvertedIndex {
  private postings = new Map<string, Posting[]>();
  private documents = new Map<string, IndexedDocument>();
  private totalTokens = 0;

  addDocument(doc: { id: string; title: string; body: string; source: string }): void {
    if (this.documents.has(doc.id)) throw new Error(`Duplicate document id: ${doc.id}`);

    const tokens = analyze(`${doc.title} ${doc.body}`);
    this.documents.set(doc.id, { id: doc.id, title: doc.title, source: doc.source, body: doc.body, tokenCount: tokens.length });
    this.totalTokens += tokens.length;

    const positionsByTerm = new Map<string, number[]>();
    tokens.forEach((term, position) => {
      const list = positionsByTerm.get(term) ?? [];
      list.push(position);
      positionsByTerm.set(term, list);
    });

    for (const [term, positions] of positionsByTerm) {
      const list = this.postings.get(term) ?? [];
      list.push({ docId: doc.id, termFrequency: positions.length, positions });
      this.postings.set(term, list);
    }
  }

  getPostings(term: string): Posting[] {
    return this.postings.get(term) ?? [];
  }

  getDocument(docId: string): IndexedDocument | undefined {
    return this.documents.get(docId);
  }

  listDocuments(): IndexedDocument[] {
    return Array.from(this.documents.values());
  }

  get totalDocs(): number {
    return this.documents.size;
  }

  get avgDocLength(): number {
    return this.documents.size === 0 ? 0 : this.totalTokens / this.documents.size;
  }

  get vocabularySize(): number {
    return this.postings.size;
  }

  vocabulary(): string[] {
    return Array.from(this.postings.keys());
  }

  toJSON(): SerializedIndex {
    return {
      postings: Object.fromEntries(this.postings),
      documents: Array.from(this.documents.values()),
      totalDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
    };
  }

  static fromJSON(data: SerializedIndex): InvertedIndex {
    const index = new InvertedIndex();
    for (const [term, postings] of Object.entries(data.postings)) index.postings.set(term, postings);
    for (const doc of data.documents) index.documents.set(doc.id, doc);
    index.totalTokens = data.avgDocLength * data.documents.length;
    return index;
  }
}
