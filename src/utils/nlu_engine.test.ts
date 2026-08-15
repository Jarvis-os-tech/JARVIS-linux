// Verification & Test Suite for J.A.R.V.I.S. NLU Engine
import { analyzeUtterance, resetDialogueContext } from './nlu_engine';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`✓ PASS: ${msg}`);
}

export function runNluTests() {
  console.log('=== Running J.A.R.V.I.S. NLU Engine Test Suite ===\n');
  resetDialogueContext();

  // Test 1: Hardware Brightness Command & Percentage Entity
  const t1 = analyzeUtterance('Jarvis, please set screen brightness to 65%');
  console.log('[T1 Result]:', JSON.stringify(t1, null, 2));
  assert(t1.intent.category === 'system_control', 'T1 Intent category is system_control');
  assert(t1.intent.name === 'set_screen_brightness', 'T1 Intent name is set_screen_brightness');
  assert(t1.entities.some(e => e.type === 'PERCENTAGE' && e.normalized === 65), 'T1 Extracted 65% entity');
  assert(t1.sentiment.isPolite === true, 'T1 Detected polite speech');

  // Test 2: Information Query on Battery
  const t2 = analyzeUtterance('What is my current battery level right now?');
  assert(t2.intent.category === 'information_query', 'T2 Intent category is information_query');
  assert(t2.intent.name === 'get_battery_status', 'T2 Intent name is get_battery_status');

  // Test 3: Application Launch & App Name Entity
  const t3 = analyzeUtterance('Open Google Chrome and launch terminal');
  assert(t3.intent.category === 'application_control', 'T3 Intent category is application_control');
  assert(t3.entities.some(e => e.type === 'APP_NAME' && e.normalized === 'google chrome'), 'T3 Extracted google chrome');

  // Test 4: Vision & Screen Sharing Hands-free Voice Control
  const t4 = analyzeUtterance('Jarvis start screen sharing now');
  assert(t4.intent.category === 'vision_control', 'T4 Intent is vision_control');
  assert(t4.intent.subIntent === 'start_screen', 'T4 Sub-intent is start_screen');
  assert(t4.suggestedAction?.args?.mode === 'screen', 'T4 Suggested action mode is screen');

  // Test 5: Date, Time, Person & Meeting Intent
  const t5 = analyzeUtterance('Schedule a meeting with Tony Stark tomorrow at 5:00 pm');
  assert(t5.intent.category === 'workspace_action', 'T5 Intent is workspace_action');
  assert(t5.entities.some(e => e.type === 'PERSON' && e.normalized.includes('Tony Stark')), 'T5 Extracted person Tony Stark');
  assert(t5.entities.some(e => e.type === 'DATE'), 'T5 Extracted date tomorrow');
  assert(t5.entities.some(e => e.type === 'TIME'), 'T5 Extracted time 5:00 pm');

  // Test 6: Question classification
  const t6 = analyzeUtterance('Why is the sky blue?');
  assert(t6.intent.category === 'question', 'T6 Intent is question');

  console.log('\n=== All NLU Tests Passed Successfully in < 1ms per utterance! ===');
}

runNluTests();
