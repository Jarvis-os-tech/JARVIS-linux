import { researchCache } from '../src/research/cache';
import { contentExtractor } from '../src/research/extractor';
import { factTriangulator } from '../src/research/triangulator';
import { fanOutCoordinator } from '../src/research/fanout';
import { researchEngine } from '../src/research/engine';
import { ExtractedPassage, ScrapedDocument } from '../src/research/types';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('🧪 Starting J.A.R.V.I.S. Deterministic Research Engine Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // =========================================================================
  // 1. Research Cache Unit Tests
  // =========================================================================
  console.log('📦 [1/5] Testing SQLite WAL Research Cache & Hash Deduplication');
  {
    const query = 'Linux Kernel 6.13 key features';
    const hash1 = researchCache.generateHash(query, 'deep', 'general');
    const hash2 = researchCache.generateHash(query, 'deep', 'general');
    assert(hash1 === hash2 && hash1.length === 64, 'SHA-256 Hash is deterministic and 64-char hex');

    // Test setting & getting cache
    const mockReport: any = {
      query,
      mode: 'deep',
      summary: 'Linux 6.13 released with major updates.',
      keyFindings: ['Feature A', 'Feature B'],
      facts: [],
      sources: [{ title: 'Kernel.org', url: 'https://kernel.org', domain: 'kernel.org', sourceName: 'Kernel.org', passagesCount: 2 }],
      citationMap: {},
      fullMarkdownReport: '# Linux 6.13',
      overallGroundingScore: 95,
      cached: false,
      executionTimeMs: 450,
      timestamp: Date.now(),
    };

    researchCache.set(query, 'deep', 'general', mockReport, 3600);
    const cachedHit = researchCache.get(query, 'deep', 'general');
    assert(cachedHit !== null && cachedHit.cached === true && cachedHit.overallGroundingScore === 95, 'Cache write & read hits successfully');

    // Test expired TTL
    researchCache.set('temporary-query', 'fast', 'news', mockReport, -10); // already expired
    const expiredHit = researchCache.get('temporary-query', 'fast', 'news');
    assert(expiredHit === null, 'Expired TTL entries are purged on access');

    const stats = researchCache.getStats();
    assert(stats.totalEntries >= 1, `Cache stats reported total: ${stats.totalEntries}`);
  }

  // =========================================================================
  // 2. Content Extractor, Micro-Chunker & BM25 / RRF Tests
  // =========================================================================
  console.log('\n🧹 [2/5] Testing AST Noise Stripping, Micro-Chunking, BM25 & RRF Ranking');
  {
    const dirtyHtml = `
      <html>
        <head><title>Test Page</title><script>var ad=1;</script><style>.ad{color:red;}</style></head>
        <body>
          <nav>Home | About | Contact</nav>
          <div class="content">
            <h1>Linux Kernel 6.13 Release Notes</h1>
            <p>The Linux kernel 6.13 was released with enhanced RISC-V support, bcachefs improvements, and memory tiering.</p>
            <p>Accept all cookies and terms of service. Privacy policy.</p>
          </div>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `;

    const cleaned = contentExtractor.cleanText(dirtyHtml);
    assert(!cleaned.includes('<script>') && !cleaned.includes('var ad=1'), 'Cleaned text strips scripts');
    assert(!cleaned.includes('<style>') && !cleaned.includes('<nav>'), 'Cleaned text strips styles and navbars');
    assert(!cleaned.includes('cookie') && !cleaned.includes('privacy policy'), 'Cleaned text strips cookie boilerplate');
    assert(cleaned.includes('Linux kernel 6.13 was released with enhanced RISC-V support'), 'Preserves substantive content');

    // Micro-chunking test
    const mockDoc: ScrapedDocument = {
      id: 'doc-1',
      url: 'https://kernel.org/v6.13',
      domain: 'kernel.org',
      title: 'Linux 6.13 Release',
      content: 'Sentence 1. ' + 'Sentence 2 with details on RISC-V architecture. '.repeat(20),
      sourceName: 'Kernel.org',
      fetchDurationMs: 100,
      success: true,
    };

    const passages = contentExtractor.microChunk(mockDoc, 300, 50);
    assert(passages.length >= 2, `Micro-chunker generated ${passages.length} overlapping passages`);
    assert(passages[0].url === 'https://kernel.org/v6.13', 'Passages maintain document origin URL & metadata');

    // BM25 & RRF Reranking test
    const scoredBM25 = contentExtractor.scoreBM25(passages, 'RISC-V architecture');
    assert((scoredBM25[0].bm25Score || 0) > 0, 'Okapi BM25 scores positive relevance for query tokens');

    const reranked = contentExtractor.rerankRRF(passages, 'RISC-V architecture', 5);
    assert(reranked.length > 0 && (reranked[0].rrfScore || 0) > 0, 'Reciprocal Rank Fusion (RRF) successfully ranks passages');
  }

  // =========================================================================
  // 3. Fact Triangulator & Rule of N >= 2 Verification Tests
  // =========================================================================
  console.log('\n🛡️ [3/5] Testing Rule of N >= 2 Fact Triangulation & Grounding Validator');
  {
    // Domain normalizer
    assert(factTriangulator.normalizeDomain('https://api.github.com/repos/torvalds/linux') === 'github.com', 'Normalizes subdomains to root domain');
    assert(factTriangulator.normalizeDomain('https://www.kernel.org/doc/html') === 'kernel.org', 'Strips www and paths');

    // Candidate passages from 3 independent domains
    const testPassages: ExtractedPassage[] = [
      {
        id: 'p1',
        docId: 'd1',
        url: 'https://kernel.org/news/6.13',
        domain: 'kernel.org',
        title: 'Kernel.org Official News',
        text: 'Linux 6.13 includes official support for real-time PREEMPT_RT patchset and bcachefs optimizations.',
        tokenCount: 15,
        charOffsetStart: 0,
        charOffsetEnd: 100,
      },
      {
        id: 'p2',
        docId: 'd2',
        url: 'https://lwn.net/Articles/613000/',
        domain: 'lwn.net',
        title: 'LWN Linux 6.13 Overview',
        text: 'The 6.13 kernel features PREEMPT_RT real-time patches along with bcachefs optimizations.',
        tokenCount: 14,
        charOffsetStart: 0,
        charOffsetEnd: 95,
      },
      {
        id: 'p3',
        docId: 'd3',
        url: 'https://phoronix.com/news/linux-6.13-benchmarks',
        domain: 'phoronix.com',
        title: 'Phoronix 6.13 Benchmarks',
        text: 'Benchmarking the new PREEMPT_RT patches in Linux 6.13 shows reduced latency on server workloads.',
        tokenCount: 16,
        charOffsetStart: 0,
        charOffsetEnd: 105,
      },
    ];

    const claims = factTriangulator.extractCandidateClaims(testPassages, 'Linux 6.13 PREEMPT_RT');
    assert(claims.length >= 1, `Extracted ${claims.length} atomic candidate claims`);

    const triangulated = factTriangulator.triangulateFacts(
      ['Linux 6.13 includes official support for real-time PREEMPT_RT patchset and bcachefs optimizations.'],
      testPassages,
      2
    );

    assert(triangulated.length === 1, 'Triangulated 1 claim');
    assert(triangulated[0].status === 'VERIFIED', `Claim status is VERIFIED (${triangulated[0].status})`);
    assert(triangulated[0].agreeingDomains.length >= 2, `Rule of N>=2 passed with domains: ${triangulated[0].agreeingDomains.join(', ')}`);
    assert(triangulated[0].confidenceScore >= 85, `High confidence score: ${triangulated[0].confidenceScore}%`);

    const { citationMap, sourcesList } = factTriangulator.buildCitationMap(triangulated);
    assert(Object.keys(citationMap).length >= 2, `Built citation map with ${Object.keys(citationMap).length} references`);
    assert(sourcesList.length >= 2, `Built sources breakdown with ${sourcesList.length} independent domains`);
  }

  // =========================================================================
  // 4. Async Fan-Out Coordinator & Circuit Breaker Tests
  // =========================================================================
  console.log('\n⚡ [4/5] Testing Fan-Out Coordinator, Circuit Breakers & Fallback Chains');
  {
    const circuitAvail = (fanOutCoordinator as any).isCircuitAvailable('exa');
    assert(circuitAvail === true, 'Circuit breaker initially CLOSED and available');

    // Simulate failures
    (fanOutCoordinator as any).recordFailure('test_source', new Error('HTTP 429 Rate Limit'));
    (fanOutCoordinator as any).recordFailure('test_source', new Error('HTTP 429 Rate Limit'));
    (fanOutCoordinator as any).recordFailure('test_source', new Error('HTTP 429 Rate Limit'));

    const isTestAvail = (fanOutCoordinator as any).isCircuitAvailable('test_source');
    assert(isTestAvail === false, 'Circuit breaker opens after 3 consecutive failures');

    (fanOutCoordinator as any).recordSuccess('test_source');
    assert((fanOutCoordinator as any).isCircuitAvailable('test_source') === true, 'Circuit breaker resets to CLOSED on success');
  }

  // =========================================================================
  // 5. End-to-End Grounded Research Engine Tests
  // =========================================================================
  console.log('\n🌍 [5/5] Testing End-to-End Grounded Research Engine & Claim Verification');
  {
    // Fast fact check test
    const fastCheck = await researchEngine.fastFactCheck('Linux kernel creator Linus Torvalds');
    assert(fastCheck.query.length > 0, 'Fast fact check returns valid result');
    assert(fastCheck.latencyMs >= 0, `Fast fact check completed in ${fastCheck.latencyMs}ms`);

    // Verify claim test
    const verification = await researchEngine.verifyClaim(
      'Linux is an open-source Unix-like operating system kernel created by Linus Torvalds'
    );
    assert(verification.verdict === 'VERIFIED_TRUE', `Claim verdict is ${verification.verdict}`);
    assert(verification.confidenceScore >= 60, `Claim confidence score is ${verification.confidenceScore}%`);

    // Obsidian Note Generation test
    const testReport: any = {
      query: 'Automated Test Verification Matrix',
      mode: 'deep',
      summary: 'Automated test summary for verification.',
      keyFindings: ['Key finding 1', 'Key finding 2'],
      facts: [
        {
          claim: 'J.A.R.V.I.S. integrates zero-hallucination research.',
          status: 'VERIFIED',
          confidenceScore: 98,
          agreeingDomains: ['github.com', 'local.ai'],
          disputingDomains: [],
          supportingPassages: [
            { quote: 'J.A.R.V.I.S. integrates zero-hallucination research.', url: 'https://github.com', domain: 'github.com', title: 'GitHub', charSimilarity: 1.0 }
          ],
          verbatimGroundingRatio: 1.0,
        }
      ],
      sources: [{ title: 'GitHub', url: 'https://github.com', domain: 'github.com', sourceName: 'GitHub', passagesCount: 1 }],
      citationMap: { 1: { id: 1, title: 'GitHub', url: 'https://github.com', domain: 'github.com', excerpt: 'J.A.R.V.I.S.' } },
      fullMarkdownReport: '## Test Markdown Report\n\nVerified findings.',
      overallGroundingScore: 98,
      cached: false,
      executionTimeMs: 320,
      timestamp: Date.now(),
    };

    const savedPath = await researchEngine.saveToObsidian(testReport);
    assert(fs.existsSync(savedPath), `Obsidian research report saved to disk: ${savedPath}`);
    const fileContent = fs.readFileSync(savedPath, 'utf8');
    assert(fileContent.includes('grounding_score: 98%'), 'Obsidian note includes YAML frontmatter grounding metadata');

    // Clean up test note
    try { fs.unlinkSync(savedPath); } catch {}
  }

  console.log(`\n======================================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
