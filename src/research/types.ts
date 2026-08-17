export type ResearchMode = 'fast' | 'deep' | 'fact_check';

export type TTLCategory = 'news' | 'repos' | 'packages' | 'docs' | 'rfc' | 'general' | 'academic' | 'fact_check';

export type TargetPlatform = 'all' | 'web' | 'github' | 'arxiv' | 'social' | 'youtube' | 'v2ex' | 'community';

export interface ResearchOptions {
  query: string;
  mode?: ResearchMode;
  maxSources?: number;
  timeoutMs?: number;
  ttlCategory?: TTLCategory;
  targetPlatforms?: TargetPlatform[];
  forceRefresh?: boolean;
  minTriangulationSources?: number;
  saveToObsidian?: boolean;
}

export interface ScrapedDocument {
  id: string;
  url: string;
  domain: string;
  title: string;
  content: string;
  snippet?: string;
  sourceName: string;
  publishedDate?: string;
  author?: string;
  fetchDurationMs: number;
  success: boolean;
  error?: string;
}

export interface ExtractedPassage {
  id: string;
  docId: string;
  url: string;
  domain: string;
  title: string;
  text: string;
  tokenCount: number;
  bm25Score?: number;
  semanticScore?: number;
  rrfScore?: number;
  charOffsetStart: number;
  charOffsetEnd: number;
}

export type FactStatus = 'VERIFIED' | 'PLAUSIBLE' | 'DISPUTED' | 'UNVERIFIED';

export interface SupportingQuote {
  quote: string;
  url: string;
  domain: string;
  title: string;
  charSimilarity: number;
}

export interface TriangulatedFact {
  claim: string;
  status: FactStatus;
  confidenceScore: number; // 0 - 100
  agreeingDomains: string[];
  disputingDomains: string[];
  supportingPassages: SupportingQuote[];
  contradictionNotes?: string;
  verbatimGroundingRatio: number; // 0.0 - 1.0
}

export interface ResearchSourceItem {
  title: string;
  url: string;
  domain: string;
  sourceName: string;
  passagesCount: number;
  publishedDate?: string;
}

export interface CitationItem {
  id: number;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
}

export interface GroundedResearchReport {
  query: string;
  mode: ResearchMode;
  summary: string;
  keyFindings: string[];
  facts: TriangulatedFact[];
  sources: ResearchSourceItem[];
  citationMap: Record<number, CitationItem>;
  fullMarkdownReport: string;
  obsidianNotePath?: string;
  overallGroundingScore: number; // 0 - 100
  cached: boolean;
  executionTimeMs: number;
  timestamp: number;
}

export type ClaimVerdict = 'VERIFIED_TRUE' | 'VERIFIED_FALSE' | 'DISPUTED' | 'INSUFFICIENT_EVIDENCE';

export interface ClaimVerificationReport {
  claim: string;
  verdict: ClaimVerdict;
  isTrue: boolean | null;
  confidenceScore: number; // 0 - 100
  explanation: string;
  citations: SupportingQuote[];
  conflictingSources: SupportingQuote[];
  independentDomainsChecked: string[];
  executionTimeMs: number;
  timestamp: number;
}

export interface FastFactResult {
  query: string;
  answer: string;
  confidence: number;
  topSources: { title: string; url: string; domain: string }[];
  latencyMs: number;
  cached: boolean;
}
