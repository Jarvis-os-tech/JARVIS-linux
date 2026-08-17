import { ExtractedPassage, ScrapedDocument } from './types';

// Standard English stopwords to filter out for cleaner BM25 ranking
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
  'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
  'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
  'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
  'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
  'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while',
  'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll',
  'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

export class ContentExtractor {
  private static instance: ContentExtractor;

  public static getInstance(): ContentExtractor {
    if (!ContentExtractor.instance) {
      ContentExtractor.instance = new ContentExtractor();
    }
    return ContentExtractor.instance;
  }

  /**
   * High-speed AST & Regex boilerplate stripper
   * Cleans scripts, styles, iframes, cookies, ads, navbars, footers, tracking links
   */
  public cleanText(rawContent: string): string {
    if (!rawContent) return '';

    let text = rawContent;

    // 1. Remove dangerous or non-content tags & blocks
    text = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ');

    // 2. Strip tracking cookies / ad boilerplate text patterns
    text = text
      .replace(/cookie\s+policy|accept\s+all\s+cookies|we\s+use\s+cookies|privacy\s+policy|terms\s+of\s+service/gi, '')
      .replace(/advertisement|sponsored\s+content|subscribe\s+to\s+newsletter/gi, '')
      .replace(/https?:\/\/[^\s\)]+(?:\?utm_[^\s\)]+)/gi, (m) => m.split('?')[0]); // Strip UTM tracking params

    // 3. Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // 4. Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');

    // 5. Normalize whitespace and markdown newlines
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return text;
  }

  /**
   * Tokenize text into words, lowercase, stopword filtered
   */
  public tokenize(text: string, filterStopwords: boolean = true): string[] {
    const rawTokens = text
      .toLowerCase()
      .replace(/[^a-z0-9_\-\.]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);

    if (!filterStopwords) return rawTokens;
    return rawTokens.filter((t) => !STOP_WORDS.has(t));
  }

  /**
   * Micro-chunk document text into overlapping semantic passages (~300 tokens / 1200 chars)
   */
  public microChunk(doc: ScrapedDocument, maxChunkChars: number = 1200, overlapChars: number = 200): ExtractedPassage[] {
    const cleaned = this.cleanText(doc.content || doc.snippet || '');
    if (!cleaned) return [];

    const passages: ExtractedPassage[] = [];
    let start = 0;
    let index = 0;

    // If document is smaller than maxChunkChars, keep it as single passage
    if (cleaned.length <= maxChunkChars) {
      const tokens = this.tokenize(cleaned, false);
      passages.push({
        id: `${doc.id}-p0`,
        docId: doc.id,
        url: doc.url,
        domain: doc.domain,
        title: doc.title,
        text: cleaned,
        tokenCount: tokens.length,
        charOffsetStart: 0,
        charOffsetEnd: cleaned.length,
      });
      return passages;
    }

    while (start < cleaned.length) {
      let end = Math.min(start + maxChunkChars, cleaned.length);

      // Try to break at a clean sentence boundary (. or \n) if not at the very end
      if (end < cleaned.length) {
        const slice = cleaned.slice(start, end);
        const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('\n\n'));
        if (lastPeriod > maxChunkChars * 0.6) {
          end = start + lastPeriod + 1;
        }
      }

      const chunkText = cleaned.slice(start, end).trim();
      if (chunkText.length > 50) {
        const tokens = this.tokenize(chunkText, false);
        passages.push({
          id: `${doc.id}-p${index++}`,
          docId: doc.id,
          url: doc.url,
          domain: doc.domain,
          title: doc.title,
          text: chunkText,
          tokenCount: tokens.length,
          charOffsetStart: start,
          charOffsetEnd: end,
        });
      }

      if (end >= cleaned.length) break;
      start = end - overlapChars;
    }

    return passages;
  }

  /**
   * Okapi BM25 Ranking Algorithm
   * Computes relevance scores of extracted passages against a query
   */
  public scoreBM25(passages: ExtractedPassage[], query: string, k1: number = 1.5, b: number = 0.75): ExtractedPassage[] {
    if (passages.length === 0) return [];

    const queryTokens = this.tokenize(query, true);
    if (queryTokens.length === 0) return passages;

    const N = passages.length;
    let totalLen = 0;
    const passageTokensList: string[][] = [];
    const docFreq: Map<string, number> = new Map();

    // 1. Calculate document frequencies for query tokens and average length
    for (const p of passages) {
      const tokens = this.tokenize(p.text, true);
      passageTokensList.push(tokens);
      totalLen += tokens.length;

      const uniqueInP = new Set(tokens);
      for (const qt of queryTokens) {
        if (uniqueInP.has(qt)) {
          docFreq.set(qt, (docFreq.get(qt) || 0) + 1);
        }
      }
    }

    const avgdl = totalLen / (N || 1);

    // 2. Score each passage
    for (let i = 0; i < N; i++) {
      const tokens = passageTokensList[i];
      const docLen = tokens.length;

      // Calculate term frequencies in current passage
      const tfMap: Map<string, number> = new Map();
      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      let score = 0;
      for (const qt of queryTokens) {
        const n_qt = docFreq.get(qt) || 0;
        if (n_qt === 0) continue;

        // Okapi BM25 IDF formulation
        const idf = Math.log((N - n_qt + 0.5) / (n_qt + 0.5) + 1);

        const tf = tfMap.get(qt) || 0;
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLen / (avgdl || 1)));

        score += idf * (numerator / (denominator || 1));
      }

      passages[i].bm25Score = score;
    }

    return passages;
  }

  /**
   * Approximate semantic & lexical overlap score
   */
  public scoreSemanticOverlap(passages: ExtractedPassage[], query: string): ExtractedPassage[] {
    const queryTokens = this.tokenize(query, false);
    const queryBigrams = this.getNgrams(queryTokens, 2);

    for (const p of passages) {
      const pTokens = this.tokenize(p.text, false);
      const pBigrams = this.getNgrams(pTokens, 2);

      let unigramHits = 0;
      for (const qt of queryTokens) {
        if (pTokens.includes(qt)) unigramHits++;
      }

      let bigramHits = 0;
      for (const qb of queryBigrams) {
        if (pBigrams.has(qb)) bigramHits++;
      }

      const unigramRatio = queryTokens.length > 0 ? unigramHits / queryTokens.length : 0;
      const bigramRatio = queryBigrams.size > 0 ? bigramHits / queryBigrams.size : 0;

      // Semantic score combining exact keyword matches and phrase/bigram co-occurrence
      p.semanticScore = unigramRatio * 0.6 + bigramRatio * 0.4;
    }

    return passages;
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * Combines BM25 and Semantic/Overlap rankings
   */
  public rerankRRF(passages: ExtractedPassage[], query: string, topK: number = 10, kRRF: number = 60): ExtractedPassage[] {
    if (passages.length === 0) return [];

    // 1. Calculate individual scores
    this.scoreBM25(passages, query);
    this.scoreSemanticOverlap(passages, query);

    // 2. Rank by BM25
    const bm25Ranked = [...passages].sort((a, b) => (b.bm25Score || 0) - (a.bm25Score || 0));
    const bm25Ranks = new Map<string, number>();
    bm25Ranked.forEach((p, rank) => bm25Ranks.set(p.id, rank + 1));

    // 3. Rank by Semantic Overlap
    const semRanked = [...passages].sort((a, b) => (b.semanticScore || 0) - (a.semanticScore || 0));
    const semRanks = new Map<string, number>();
    semRanked.forEach((p, rank) => semRanks.set(p.id, rank + 1));

    // 4. Compute RRF score
    for (const p of passages) {
      const rBM25 = bm25Ranks.get(p.id) || passages.length;
      const rSem = semRanks.get(p.id) || passages.length;
      p.rrfScore = 1.0 / (kRRF + rBM25) + 1.0 / (kRRF + rSem);
    }

    // 5. Sort by RRF score descending
    passages.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));

    return passages.slice(0, topK);
  }

  private getNgrams(tokens: string[], n: number): Set<string> {
    const ngrams = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.add(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }
}

export const contentExtractor = ContentExtractor.getInstance();
