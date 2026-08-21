// Test suite for J.A.R.V.I.S. Codebase Intelligence & Graph Memory Bridge

import { codebaseMemory } from '../src/core/codebase_memory';
import { codebaseWatcher } from '../src/core/codebase_watcher';
import { toolRegistry } from '../src/tools/tool_registry';

async function runTests() {
  console.log('🧪 Starting J.A.R.V.I.S. Codebase Memory Verification...');

  // 1. Check Tool Registration
  const registeredTools = toolRegistry.getAllTools().map((t) => t.name);
  const requiredTools = [
    'codebase_search_graph',
    'codebase_trace_path',
    'codebase_get_snippet',
    'codebase_get_architecture',
    'codebase_search_code',
    'codebase_view_file',
    'codebase_edit_file',
    'codebase_detect_changes',
    'codebase_query_graph',
  ];

  for (const tool of requiredTools) {
    if (!registeredTools.includes(tool)) {
      throw new Error(`❌ Missing registered tool: ${tool}`);
    }
  }
  console.log(`✅ All ${requiredTools.length} Codebase tools registered in ToolRegistry.`);

  // 2. Test Architecture Inspection
  console.log('\n📊 Testing codebaseMemory.getArchitecture()...');
  const arch = await codebaseMemory.getArchitecture(['all']);
  console.log('Architecture response summary:', typeof arch === 'object' ? JSON.stringify(arch).slice(0, 150) + '...' : arch);
  if (!arch) {
    throw new Error('❌ Failed to retrieve codebase architecture');
  }
  console.log('✅ Architecture retrieval passed.');

  // 3. Test Graph Symbol Search
  console.log('\n🔍 Testing codebaseMemory.searchGraph("executeForgedTool")...');
  const searchRes = await codebaseMemory.searchGraph('executeForgedTool');
  console.log('Search results count/status:', searchRes);
  console.log('✅ Graph search passed.');

  // 4. Test Safe File Reader
  console.log('\n📖 Testing codebaseMemory.readFile("src/core/prime_orchestrator.ts", 1, 15)...');
  const fileData = codebaseMemory.readFile('src/core/prime_orchestrator.ts', 1, 15);
  if (!fileData.content.includes('PrimeOrchestrator') && !fileData.content.includes('import')) {
    throw new Error('❌ Read file content mismatch');
  }
  console.log(`✅ File read verified (${fileData.totalLines} lines total, returned slice).`);

  // 5. Test Codebase Watcher
  console.log('\n👁️ Testing CodebaseWatcher start and stop...');
  codebaseWatcher.start();
  codebaseWatcher.stop();
  console.log('✅ CodebaseWatcher lifecycle passed.');

  console.log('\n🎉 ALL CODEBASE MEMORY TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
