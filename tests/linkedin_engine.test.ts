import { linkedinService } from '../src/services/linkedin_service';
import { toolRegistry } from '../src/tools/tool_registry';
import { executeWorkspaceTool, WORKSPACE_FUNCTION_DECLARATIONS } from '../src/utils/workspace_tools';
import { configRepo } from '../src/db/db';

async function runTests() {
  console.log('🧪 Starting J.A.R.V.I.S. LinkedIn Autonomous Connector & Intelligence Suite...\n');
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

  const originalAuth = configRepo.get('linkedin_auth');

  try {
    // =========================================================================
    // 1. SQLite Authentication & Status Persistence
    // =========================================================================
    console.log('💼 [1/4] Testing SQLite Authentication & Status Persistence');
    {
      await linkedinService.saveAuth({
        accessToken: 'AQV_mock_test_token_12345',
        name: 'Tony Stark',
        email: 'tony@starkindustries.com',
        headline: 'Chief Architect @ Stark Industries',
        userUrn: 'urn:li:person:stark999',
      });

      const status = linkedinService.getStatus();
      assert(status.connected === true, 'Status reports connected after saving OAuth token');
      assert(status.hasAccessToken === true, 'Status reports hasAccessToken === true');
      assert(status.name === 'Tony Stark', 'Persisted name matches Tony Stark');
      assert(status.email === 'tony@starkindustries.com', 'Persisted email matches tony@starkindustries.com');

      const retrievedToken = linkedinService.getAccessToken();
      assert(retrievedToken === 'AQV_mock_test_token_12345', 'Retrieved access token matches saved token');

      // Test Disconnect
      linkedinService.disconnect();
      const discStatus = linkedinService.getStatus();
      assert(discStatus.connected === false, 'Status reports disconnected after disconnect()');
      assert(discStatus.hasAccessToken === false, 'hasAccessToken is false after disconnect()');
    }

    // =========================================================================
    // 2. Central Tool Registry Registration
    // =========================================================================
    console.log('\n🛠️  [2/4] Testing Central Tool Registry Registration');
    {
      const tools = toolRegistry.getAllTools();
      const linkedinToolNames = tools
        .map((t) => t.name)
        .filter((name) => name.startsWith('linkedin_'));

      assert(linkedinToolNames.includes('linkedin_get_my_profile'), 'linkedin_get_my_profile is registered');
      assert(linkedinToolNames.includes('linkedin_create_post'), 'linkedin_create_post is registered');
      assert(linkedinToolNames.includes('linkedin_fetch_person'), 'linkedin_fetch_person is registered');
      assert(linkedinToolNames.includes('linkedin_fetch_company'), 'linkedin_fetch_company is registered');
      assert(linkedinToolNames.includes('linkedin_search_people'), 'linkedin_search_people is registered');
      assert(linkedinToolNames.includes('linkedin_search_jobs'), 'linkedin_search_jobs is registered');
      assert(linkedinToolNames.includes('linkedin_send_message'), 'linkedin_send_message is registered');
      assert(linkedinToolNames.includes('linkedin_send_connection'), 'linkedin_send_connection is registered');

      const postTool = toolRegistry.getTool('linkedin_create_post');
      assert(!!postTool, 'linkedin_create_post tool descriptor exists');
      assert(postTool?.parameters.required?.includes('text') === true, 'linkedin_create_post requires text parameter');
    }

    // =========================================================================
    // 3. Gemini Live Workspace Tools Declarations
    // =========================================================================
    console.log('\n🎙️  [3/4] Testing Gemini Live Workspace Tool Declarations');
    {
      const names = WORKSPACE_FUNCTION_DECLARATIONS.map((d) => d.name);
      assert(names.includes('linkedin_get_my_profile'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_get_my_profile');
      assert(names.includes('linkedin_create_post'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_create_post');
      assert(names.includes('linkedin_fetch_person'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_fetch_person');
      assert(names.includes('linkedin_fetch_company'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_fetch_company');
      assert(names.includes('linkedin_search_people'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_search_people');
      assert(names.includes('linkedin_search_jobs'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_search_jobs');
      assert(names.includes('linkedin_send_message'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_send_message');
      assert(names.includes('linkedin_send_connection'), 'WORKSPACE_FUNCTION_DECLARATIONS contains linkedin_send_connection');
    }

    // =========================================================================
    // 4. Live Tool Execution & Fallback Intelligence
    // =========================================================================
    console.log('\n🌐 [4/4] Testing Live Tool Execution & Fallback Intelligence');
    {
      try {
        const companyRes = await executeWorkspaceTool('linkedin_fetch_company', {
          companyUrlOrName: 'microsoft',
        });
        assert(companyRes.success === true, 'linkedin_fetch_company executed successfully');
        assert(!!companyRes.result.name, `Retrieved company: ${companyRes.result.name}`);
      } catch (err: any) {
        console.warn(`Company fetch warning (non-fatal): ${err.message}`);
      }

      try {
        const jobRes = await executeWorkspaceTool('linkedin_search_jobs', {
          keywords: 'AI Engineer',
          location: 'Remote',
          limit: 3,
        });
        assert(jobRes.success === true, 'linkedin_search_jobs executed successfully');
        assert(Array.isArray(jobRes.result), `Search jobs returned array of items (found ${jobRes.result?.length || 0})`);
      } catch (err: any) {
        console.warn(`Job search warning (non-fatal): ${err.message}`);
      }

      try {
        const peopleRes = await executeWorkspaceTool('linkedin_search_people', {
          term: 'Satya Nadella',
          limit: 2,
        });
        assert(peopleRes.success === true, 'linkedin_search_people executed successfully');
      } catch (err: any) {
        console.warn(`People search warning (non-fatal): ${err.message}`);
      }
    }
  } finally {
    // Restore initial auth if any
    if (originalAuth) {
      configRepo.set('linkedin_auth', originalAuth);
    } else {
      configRepo.delete('linkedin_auth');
    }
  }

  console.log('\n========================================================');
  console.log(`📊 LinkedIn Engine Verification Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
