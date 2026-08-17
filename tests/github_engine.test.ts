/**
 * =============================================================================
 * J.A.R.V.I.S. GitHub Cloud & Developer Intelligence Test Suite
 * =============================================================================
 */

import { githubService } from '../src/services/github_service';
import { toolRegistry } from '../src/tools/tool_registry';
import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool } from '../src/utils/workspace_tools';

async function runGitHubTestSuite() {
  console.log('🧪 Starting J.A.R.V.I.S. GitHub Autonomous Connector & Intelligence Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. SQLite Authentication & Status Persistence
  console.log('🐙 [1/4] Testing SQLite Authentication & Status Persistence');
  const mockToken = 'gho_integration_test_secret_token_123';
  await githubService.saveAuth({
    accessToken: mockToken,
    login: 'linus-torvalds',
    name: 'Linus Torvalds',
    email: 'torvalds@linux-foundation.org',
    publicRepos: 42,
  });

  const status = githubService.getStatus();
  assert(status.connected === true, 'Status reports connected after saving OAuth token');
  assert(status.login === 'linus-torvalds', 'Persisted login matches linus-torvalds');
  assert(status.name === 'Linus Torvalds', 'Persisted name matches Linus Torvalds');
  assert(status.email === 'torvalds@linux-foundation.org', 'Persisted email matches torvalds@linux-foundation.org');
  assert(githubService.getAccessToken() === mockToken, 'Retrieved access token matches saved token');

  githubService.disconnect();
  const statusAfterDisconnect = githubService.getStatus();
  assert(statusAfterDisconnect.connected === false, 'Status reports disconnected after disconnect()');

  // Re-save for downstream tool tests
  await githubService.saveAuth({
    accessToken: mockToken,
    login: 'jarvis-user',
    name: 'J.A.R.V.I.S. Developer',
    email: 'dev@jarvis.ai',
    publicRepos: 10,
  });

  // 2. Central Tool Registry Verification
  console.log('\n🛠️  [2/4] Testing Central Tool Registry Registration');
  const allTools = toolRegistry.getAllTools();
  const registeredTools = allTools.map((t) => t.name);
  const requiredTools = [
    'github_get_my_profile',
    'github_list_my_repos',
    'github_create_issue',
    'github_create_gist',
    'github_get_repo_details',
  ];

  for (const t of requiredTools) {
    assert(registeredTools.includes(t), `${t} is registered in ToolRegistry`);
  }

  const issueTool = toolRegistry.getTool('github_create_issue');
  assert(!!issueTool, 'github_create_issue tool descriptor exists');
  assert(issueTool?.parameters?.required?.includes('title') === true, 'github_create_issue requires title parameter');

  // 3. Gemini Live Workspace Tool Declarations
  console.log('\n🎙️  [3/4] Testing Gemini Live Workspace Tool Declarations');
  const declarationNames = WORKSPACE_FUNCTION_DECLARATIONS.map((d) => d.name);
  for (const t of requiredTools) {
    assert(declarationNames.includes(t), `WORKSPACE_FUNCTION_DECLARATIONS contains ${t}`);
  }

  // 4. Live Tool Execution
  console.log('\n🌐 [4/4] Testing Live Tool Execution');
  try {
    const details = await executeWorkspaceTool('github_get_repo_details', {
      owner: 'octocat',
      repo: 'Hello-World',
    });
    assert(details.success === true, 'github_get_repo_details executed successfully');
    assert(details.result?.name === 'Hello-World', 'Retrieved repo name: Hello-World');
    assert(details.result?.owner?.login === 'octocat', 'Owner login matches octocat');
  } catch (err: any) {
    console.error(`Live repo details test failed: ${err.message}`);
    assert(false, `github_get_repo_details failed: ${err.message}`);
  }

  console.log('\n========================================================');
  console.log(`📊 GitHub Engine Verification Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runGitHubTestSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
