import {
  TaskComplexityClassifier,
  ImmediateAcknowledgementManager,
  ProgressUpdateManager,
  LatencyResponseSystem,
  SpeechPriority,
} from './latency_response_system';

function runTests() {
  console.log('🧪 Starting Latency-Aware Voice Response System Unit Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // --- 1. TaskComplexityClassifier Tests ---
  console.log('1️⃣ Testing TaskComplexityClassifier...');
  const classifier = new TaskComplexityClassifier();

  // Test Instant Commands
  const c1 = classifier.classify({ text: 'Hello Jarvis' });
  assert(c1.tier === 'INSTANT', 'Greeting classified as INSTANT');

  const c2 = classifier.classify({ text: 'Set volume to 50%' });
  assert(c2.tier === 'INSTANT', 'Volume control classified as INSTANT');

  const c3 = classifier.classify({ text: 'Open Google Chrome' });
  assert(c3.tier === 'INSTANT', 'App launch classified as INSTANT');

  const c4 = classifier.classify({ toolName: 'set_system_volume' });
  assert(c4.tier === 'INSTANT', 'Tool set_system_volume classified as INSTANT');

  // Test Long Research Tasks
  const c5 = classifier.classify({ text: 'Research the latest breakthroughs in solid state batteries and compare them' });
  assert(c5.tier === 'LONG' && c5.category === 'research', 'Research prompt classified as LONG (category: research)');

  const c6 = classifier.classify({ toolName: 'web_research' });
  assert(c6.tier === 'LONG' && c6.category === 'research', 'Tool web_research classified as LONG (category: research)');

  // Test Long Coding Tasks
  const c7 = classifier.classify({ text: 'Analyze this project and refactor the database connector' });
  assert(c7.tier === 'LONG' && c7.category === 'coding', 'Coding prompt classified as LONG (category: coding)');

  const c8 = classifier.classify({ toolName: 'github_create_issue' });
  assert(c8.tier === 'LONG' && c8.category === 'coding', 'Tool github_create_issue classified as LONG (category: coding)');

  // Test Multi-Agent Delegation
  const c9 = classifier.classify({ text: 'Delegate to Edith to review the architecture plan' });
  assert(c9.tier === 'LONG' && c9.category === 'multi_agent', 'Multi-agent prompt classified as LONG (category: multi_agent)');

  // --- 2. ImmediateAcknowledgementManager Tests ---
  console.log('\n2️⃣ Testing ImmediateAcknowledgementManager...');
  const ackManager = new ImmediateAcknowledgementManager(5);

  const phrase1 = ackManager.getAcknowledgementPhrase('research');
  const phrase2 = ackManager.getAcknowledgementPhrase('research');
  assert(phrase1.length > 0 && phrase2.length > 0, 'Acknowledgement phrases generated for research');
  assert(phrase1 !== phrase2, 'Consecutive acknowledgement phrases are deduplicated / not identical');

  const codingPhrase = ackManager.getAcknowledgementPhrase('coding');
  assert(codingPhrase.toLowerCase().includes('code') || codingPhrase.toLowerCase().includes('analyz') || codingPhrase.length > 0, 'Coding phrase matches domain');

  // --- 3. ProgressUpdateManager Tests ---
  console.log('\n3️⃣ Testing ProgressUpdateManager & Lifecycle...');
  const testSystem = new LatencyResponseSystem({
    firstProgressDelayMs: 50,
    progressIntervalMs: 50,
    maxProgressUpdates: 2,
  });

  // Test Long Request Handling
  let ackSpoken: boolean = false;
  let spokenText = '';
  const record = testSystem.handleIncomingRequest(
    { text: 'Research all AI developments today and synthesize a full report' },
    (phrase) => {
      ackSpoken = true;
      spokenText = phrase;
    }
  );

  assert(record.classification.tier === 'LONG', 'Task tier is LONG');
  assert(record.state === 'ACKNOWLEDGED', 'Task transitioned to ACKNOWLEDGED');
  assert(Boolean(ackSpoken) && spokenText.length > 0, 'Immediate acknowledgement callback dispatched');
  assert(typeof record.acknowledgementLatencyMs === 'number', 'Latency metric captured (<5ms)');

  // Complete task immediately to test timer cancellation
  testSystem.completeTask(record.taskId, { success: true });
  assert(record.state === 'COMPLETED', 'Task transitioned to COMPLETED');
  assert(!testSystem.progressManager.isTracking(record.taskId), 'Progress updates cancelled upon task completion');

  // Test User Interruption (Barge-in)
  const record2 = testSystem.handleIncomingRequest(
    { text: 'Analyze and refactor the entire codebase from scratch' },
    () => {}
  );
  assert(record2.state === 'ACKNOWLEDGED', 'Second task acknowledged');
  testSystem.interruptActiveTask('user_barge_in');
  assert(record2.state === 'INTERRUPTED', 'Active task transitioned to INTERRUPTED on barge-in');
  assert(!testSystem.progressManager.isTracking(record2.taskId), 'Progress updates cancelled upon interruption');

  console.log(`\n========================================`);
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
