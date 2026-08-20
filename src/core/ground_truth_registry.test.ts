import {
  GroundTruthRegistry,
  groundTruthRegistry,
} from './ground_truth_registry';

function runTests() {
  console.log('🧪 Starting Ground Truth & Anti-Hallucination Registry Unit Tests...\n');
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

  // --- 1. Unified Function Declarations ---
  console.log('1️⃣ Testing Unified Tool Declarations...');
  const unifiedFns = groundTruthRegistry.getUnifiedFunctionDeclarations();
  assert(unifiedFns.length >= 60, `Unified function declarations contains ${unifiedFns.length} tools (>= 60)`);

  const hasSystemVolume = unifiedFns.some((f) => f.name === 'set_system_volume');
  assert(hasSystemVolume, 'Contains set_system_volume tool declaration');

  const hasEmail = unifiedFns.some((f) => f.name === 'send_email');
  assert(hasEmail, 'Contains send_email workspace tool declaration');

  const hasLinuxCommand = unifiedFns.some((f) => f.name === 'execute_linux_command');
  assert(hasLinuxCommand, 'Contains execute_linux_command tool declaration');

  const hasHarvestSkills = unifiedFns.some((f) => f.name === 'jarvis_harvest_skills');
  assert(hasHarvestSkills, 'Contains jarvis_harvest_skills tool declaration');

  // --- 2. OpenAI-Compatible Tools Schema ---
  console.log('\n2️⃣ Testing OpenAI-Compatible Tools for Groq & NVIDIA NIM...');
  const openAiTools = groundTruthRegistry.getOpenAiUnifiedTools();
  assert(openAiTools.length === unifiedFns.length, 'OpenAI tools count matches unified declarations');
  assert(openAiTools[0].type === 'function' && openAiTools[0].function.name, 'OpenAI tool schema formatted correctly');

  // --- 3. Capability Verification & Negative Boundaries ---
  console.log('\n3️⃣ Testing Capability Verification & Negative Boundaries...');
  
  // Direct supported tool
  const cap1 = groundTruthRegistry.verifyCapability('set_system_volume');
  assert(cap1.isSupported === true && cap1.toolName === 'set_system_volume', 'Direct tool verified as supported');

  // Direct supported workspace tool
  const cap2 = groundTruthRegistry.verifyCapability('create_calendar_event');
  assert(cap2.isSupported === true && cap2.toolName === 'create_calendar_event', 'Workspace tool verified as supported');

  // Generic terminal intent
  const cap3 = groundTruthRegistry.verifyCapability('run bash command to list processes');
  assert(cap3.isSupported === true && cap3.toolName === 'execute_linux_command', 'Terminal intent mapped to execute_linux_command');

  // Negative boundary: Physical / impossible action
  const cap4 = groundTruthRegistry.verifyCapability('hack satellite orbital parameters');
  assert(cap4.isSupported === false && cap4.category === 'unsupported', 'Impossible action strictly rejected with negative boundary');
  assert(Boolean(cap4.realAlternative) && cap4.realAlternative!.length > 0, 'Provides real alternative explanation');

  // Negative boundary: Non-existent hardware
  const cap5 = groundTruthRegistry.verifyCapability('turn on the microwave oven in kitchen');
  assert(cap5.isSupported === false && cap5.category === 'unsupported', 'Out-of-envelope hardware rejected');

  // --- 4. Tool Output Ground Truth Verification (Evidence-First) ---
  console.log('\n4️⃣ Testing Tool Output Verification...');
  
  // Successful tool output
  const vSuccess = groundTruthRegistry.verifyToolResult('get_system_telemetry', {
    success: true,
    result: { cpu: 24, ram: 48, thermals: '45C' }
  });
  assert(vSuccess.success === true && vSuccess.groundTruthVerified === true, 'Successful tool result verified');
  assert(vSuccess.evidence.includes('cpu'), 'Evidence contains actual telemetry data');

  // Failed tool output
  const vFail = groundTruthRegistry.verifyToolResult('execute_linux_command', {
    success: false,
    error: 'Command failed with exit code 127: command not found'
  });
  assert(vFail.success === false && vFail.groundTruthVerified === true, 'Failed tool output strictly marked as false');
  assert(vFail.errorMessage?.includes('127'), 'Error message preserved accurately');

  // Null tool output
  const vNull = groundTruthRegistry.verifyToolResult('search_emails', null);
  assert(vNull.success === false, 'Null output marked as failed');

  // --- 5. Canonical Capability Manifest ---
  console.log('\n5️⃣ Testing Canonical Capability Manifest Generation...');
  const manifest = groundTruthRegistry.getCanonicalCapabilityManifest();
  assert(manifest.includes('ZERO-HALLUCINATION TRUTH CONTRACT'), 'Manifest header present');
  assert(manifest.includes('IRON LAW'), 'Iron law present in manifest');
  assert(manifest.includes('NEGATIVE BOUNDARIES'), 'Negative boundaries present in manifest');

  console.log(`\n========================================`);
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
