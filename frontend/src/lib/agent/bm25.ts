// Compact Okapi BM25 scorer — no external dependency.
//
// Used to retrieve the most relevant financing opportunity (or provider) from a
// free-text query such as "the SteelFab invoice" or "cheapest provider for
// 9 lakh". The agent should retrieve before it reasons, instead of dumping the
// entire book and letting the model pattern-match.

export interface Bm25Doc {
  id: string;
  /** Pre-tokenized lowercased terms of the searchable corpus for this doc. */
  terms: string[];
  /** Original text, kept for debugging / display. */
  text: string;
}

const K1 = 1.5;
const B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function buildCorpus(docs: Array<{ id: string; text: string }>): Bm25Doc[] {
  return docs.map((d) => ({ id: d.id, terms: tokenize(d.text), text: d.text }));
}

export function scoreCorpus(corpus: Bm25Doc[], query: string): Array<{ id: string; score: number }> {
  const qTerms = tokenize(query);
  if (qTerms.length === 0) return [];

  const n = corpus.length;
  const docLengths = corpus.map((d) => d.terms.length);
  const avgLen = docLengths.length ? docLengths.reduce((a, b) => a + b, 0) / docLengths.length : 0;

  // Term frequency per doc + document frequency across the corpus.
  const df = new Map<string, number>();
  const tf = corpus.map((d) => {
    const m = new Map<string, number>();
    for (const t of d.terms) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return m;
  });

  const results = corpus.map((doc, i) => {
    let score = 0;
    const docTf = tf[i];
    const docLen = docLengths[i];
    for (const q of qTerms) {
      const f = docTf.get(q);
      if (!f) continue;
      const idf = Math.log(1 + (n - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5));
      score +=
        idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (docLen / (avgLen || 1)))));
    }
    return { id: doc.id, score };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Top-k ids for a query, or [] when nothing matches. */
export function retrieve(corpus: Bm25Doc[], query: string, k = 5): string[] {
  return scoreCorpus(corpus, query)
    .slice(0, k)
    .map((r) => r.id);
}
