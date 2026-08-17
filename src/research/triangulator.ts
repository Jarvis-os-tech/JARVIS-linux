import { ExtractedPassage, TriangulatedFact, SupportingQuote, FactStatus, CitationItem } from './types';
import { contentExtractor } from './extractor';

export class FactTriangulator {
  private static instance: FactTriangulator;

  public static getInstance(): FactTriangulator {
    if (!FactTriangulator.instance) {
      FactTriangulator.instance = new FactTriangulator();
    }
    return FactTriangulator.instance;
  }

  /**
   * Normalize domain names to their root canonical form
   * e.g. "api.github.com" -> "github.com", "m.reddit.com" -> "reddit.com"
   */
  public normalizeDomain(urlOrDomain: string): string {
    if (!urlOrDomain) return 'unknown';

    let domain = urlOrDomain;
    try {
      if (urlOrDomain.startsWith('http://') || urlOrDomain.startsWith('https://')) {
        const u = new URL(urlOrDomain);
        domain = u.hostname;
      }
    } catch {
      // Fallback regex
      const match = urlOrDomain.match(/(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
      if (match) domain = match[1];
    }

    domain = domain.toLowerCase().replace(/^www\./, '');

    // Extract root domain for known multi-tier subdomains
    const parts = domain.split('.');
    if (parts.length >= 3) {
      const secondLevelTlds = ['co.uk', 'gov.in', 'ac.uk', 'com.au', 'co.jp', 'org.uk'];
      const lastTwo = parts.slice(-2).join('.');
      if (secondLevelTlds.includes(lastTwo) && parts.length >= 3) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }

    return domain;
  }

  /**
   * Extract atomic declarative sentence claims from top passages
   */
  public extractCandidateClaims(passages: ExtractedPassage[], query: string): string[] {
    const rawSentences: string[] = [];
    const queryTokens = new Set(contentExtractor.tokenize(query, true));

    for (const p of passages) {
      // Split into sentences
      const sentences = p.text
        .split(/(?<=[.!?])\s+(?=[A-Z0-9#\-])/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 25 && s.length <= 350);

      for (const s of sentences) {
        // Must contain at least one query keyword or entity
        const sTokens = contentExtractor.tokenize(s, true);
        const hasKeyword = sTokens.some((t) => queryTokens.has(t));
        if (hasKeyword && !rawSentences.includes(s)) {
          rawSentences.push(s);
        }
      }
    }

    // Deduplicate and select most informative claims
    return this.clusterAndDeduplicateClaims(rawSentences).slice(0, 10);
  }

  /**
   * Cluster similar sentence claims and keep the most complete one
   */
  private clusterAndDeduplicateClaims(sentences: string[]): string[] {
    const unique: string[] = [];

    for (const s of sentences) {
      const sTokens = new Set(contentExtractor.tokenize(s, true));
      let isDuplicate = false;

      for (let i = 0; i < unique.length; i++) {
        const existingTokens = new Set(contentExtractor.tokenize(unique[i], true));
        let intersection = 0;
        for (const t of sTokens) {
          if (existingTokens.has(t)) intersection++;
        }
        const overlap = intersection / Math.min(sTokens.size, existingTokens.size);

        if (overlap > 0.75) {
          isDuplicate = true;
          // Keep longer, more informative sentence
          if (s.length > unique[i].length) {
            unique[i] = s;
          }
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(s);
      }
    }

    return unique;
  }

  /**
   * Triangulate claims across independent passages and domains
   * Enforces Rule of N >= 2
   */
  public triangulateFacts(
    claims: string[],
    passages: ExtractedPassage[],
    minSources: number = 2
  ): TriangulatedFact[] {
    const triangulated: TriangulatedFact[] = [];

    for (const claim of claims) {
      const claimTokens = contentExtractor.tokenize(claim, true);
      const agreeingPassages: ExtractedPassage[] = [];
      const agreeingDomainsSet = new Set<string>();
      const disputingPassages: ExtractedPassage[] = [];
      const disputingDomainsSet = new Set<string>();

      for (const p of passages) {
        const pClean = contentExtractor.cleanText(p.text);
        const pDomain = this.normalizeDomain(p.domain || p.url);
        const pTokens = contentExtractor.tokenize(p.text, true);

        // 1. Calculate semantic & content token match ratio
        let matchCount = 0;
        for (const ct of claimTokens) {
          if (pTokens.includes(ct) || pClean.toLowerCase().includes(ct)) {
            matchCount++;
          } else if (ct.length > 4) {
            const stem = ct.slice(0, Math.min(ct.length - 2, 5));
            if (pTokens.some((pt) => pt.startsWith(stem)) || pClean.toLowerCase().includes(stem)) {
              matchCount += 0.85;
            }
          }
        }

        const matchRatio = claimTokens.length > 0 ? matchCount / claimTokens.length : 0;

        // Check for contradiction signals (e.g. not, never, discontinued, false, deprecated)
        const hasNegation = /\b(not|never|deprecated|discontinued|fake|false|untrue|canceled|refuted)\b/i.test(pClean);
        const claimHasNegation = /\b(not|never|deprecated|discontinued|fake|false|untrue|canceled|refuted)\b/i.test(claim);

        if (matchRatio >= 0.45) {
          if (hasNegation !== claimHasNegation && matchRatio >= 0.75) {
            disputingPassages.push(p);
            disputingDomainsSet.add(pDomain);
          } else {
            agreeingPassages.push(p);
            agreeingDomainsSet.add(pDomain);
          }
        }
      }

      const agreeingDomains = Array.from(agreeingDomainsSet);
      const disputingDomains = Array.from(disputingDomainsSet);

      // Build supporting quote objects
      const supportingQuotes: SupportingQuote[] = agreeingPassages.map((p) => {
        const excerpt = this.findBestMatchingExcerpt(claim, p.text);
        return {
          quote: excerpt,
          url: p.url,
          domain: this.normalizeDomain(p.domain || p.url),
          title: p.title,
          charSimilarity: 0.9,
        };
      });

      // Calculate Grounding Ratio
      let maxVerbatimOverlap = 0;
      for (const sq of supportingQuotes) {
        const overlap = this.calculateVerbatimOverlap(claim, sq.quote);
        if (overlap > maxVerbatimOverlap) maxVerbatimOverlap = overlap;
      }

      // Determine Status & Confidence Score
      let status: FactStatus = 'UNVERIFIED';
      let confidence = 20;

      if (disputingDomains.length > 0 && agreeingDomains.length > 0) {
        status = 'DISPUTED';
        confidence = 45;
      } else if (agreeingDomains.length >= minSources && maxVerbatimOverlap >= 0.50) {
        // RULE OF N >= 2 SATISFIED!
        status = 'VERIFIED';
        confidence = Math.min(100, Math.round(75 + agreeingDomains.length * 7 + maxVerbatimOverlap * 15));
      } else if (agreeingDomains.length >= 1 && maxVerbatimOverlap >= 0.40) {
        status = 'PLAUSIBLE';
        confidence = Math.min(84, Math.round(55 + maxVerbatimOverlap * 25));
      }

      triangulated.push({
        claim,
        status,
        confidenceScore: confidence,
        agreeingDomains,
        disputingDomains,
        supportingPassages: supportingQuotes.slice(0, 4),
        verbatimGroundingRatio: Number(maxVerbatimOverlap.toFixed(2)),
        contradictionNotes: disputingDomains.length > 0
          ? `Conflicting evidence detected across: ${disputingDomains.join(', ')}`
          : undefined,
      });
    }

    // Sort by confidence score descending
    return triangulated.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Find most relevant 1-2 sentence excerpt from passage text
   */
  private findBestMatchingExcerpt(claim: string, passageText: string): string {
    const sentences = passageText.split(/(?<=[.!?])\s+/);
    if (sentences.length <= 1) return passageText.slice(0, 250);

    const claimTokens = new Set(contentExtractor.tokenize(claim, true));
    let bestSentence = sentences[0];
    let maxMatches = 0;

    for (const s of sentences) {
      const sTokens = contentExtractor.tokenize(s, true);
      let matches = 0;
      for (const t of sTokens) {
        if (claimTokens.has(t)) matches++;
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = s;
      }
    }

    return bestSentence.trim().slice(0, 300);
  }

  /**
   * Calculate character and word level verbatim overlap ratio
   */
  private calculateVerbatimOverlap(claim: string, excerpt: string): number {
    const claimTokens = contentExtractor.tokenize(claim, true);
    const excerptTokens = new Set(contentExtractor.tokenize(excerpt, true));
    if (claimTokens.length === 0) return 0;

    let matchedWords = 0;
    for (const t of claimTokens) {
      if (excerptTokens.has(t) || excerpt.toLowerCase().includes(t)) {
        matchedWords++;
      } else if (t.length > 4) {
        const stem = t.slice(0, Math.min(t.length - 2, 5));
        if (Array.from(excerptTokens).some((et) => et.startsWith(stem)) || excerpt.toLowerCase().includes(stem)) {
          matchedWords += 0.85;
        }
      }
    }

    return Math.min(1.0, matchedWords / claimTokens.length);
  }

  /**
   * Build structured citation map for report rendering
   */
  public buildCitationMap(facts: TriangulatedFact[]): {
    citationMap: Record<number, CitationItem>;
    sourcesList: { title: string; url: string; domain: string; sourceName: string; passagesCount: number }[];
  } {
    const citationMap: Record<number, CitationItem> = {};
    const urlToIdMap = new Map<string, number>();
    const domainCounts = new Map<string, { title: string; url: string; domain: string; count: number }>();
    let nextId = 1;

    for (const f of facts) {
      for (const sp of f.supportingPassages) {
        if (!sp.url) continue;

        if (!urlToIdMap.has(sp.url)) {
          urlToIdMap.set(sp.url, nextId);
          citationMap[nextId] = {
            id: nextId,
            title: sp.title || sp.domain || 'Source',
            url: sp.url,
            domain: sp.domain,
            excerpt: sp.quote,
          };
          nextId++;
        }

        const existing = domainCounts.get(sp.domain) || { title: sp.title, url: sp.url, domain: sp.domain, count: 0 };
        existing.count++;
        domainCounts.set(sp.domain, existing);
      }
    }

    const sourcesList = Array.from(domainCounts.values()).map((item) => ({
      title: item.title,
      url: item.url,
      domain: item.domain,
      sourceName: item.domain,
      passagesCount: item.count,
    }));

    return { citationMap, sourcesList };
  }
}

export const factTriangulator = FactTriangulator.getInstance();
