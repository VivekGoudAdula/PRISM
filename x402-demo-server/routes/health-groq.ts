import type { Context } from 'hono';
import { groqManager } from '../handlers/lib/groq-manager';
import { fetchRepoFiles } from '../handlers/lib/fetch-repo';

/**
 * GET /api/health/groq
 * Health check endpoint to verify Groq connectivity, key rotation status, and GitHub connectivity.
 */
export async function handleGroqHealthCheck(c: Context) {
  const startTime = Date.now();
  groqManager.reloadKeys();

  let groqStatus = 'UNKNOWN';
  let groqMessage = '';
  let testResponse = '';
  let durationMs = 0;

  // 1. Test Groq Connectivity with minimal test prompt
  try {
    const testStart = Date.now();
    const result = await groqManager.chatCompletion<{ reply?: string }>({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'user', content: 'Reply with exactly: GROQ_WORKING' },
      ],
      temperature: 0.0,
      responseFormatJson: false,
    });

    durationMs = Date.now() - testStart;
    testResponse = result.rawContent.trim();

    if (testResponse.includes('GROQ_WORKING')) {
      groqStatus = 'OK';
      groqMessage = 'Groq API is fully operational and authenticated.';
    } else {
      groqStatus = 'WARNING';
      groqMessage = `Groq responded, but text was: "${testResponse.slice(0, 50)}"`;
    }
  } catch (err: any) {
    groqStatus = 'ERROR';
    groqMessage = err.message || 'Groq connection failed.';
  }

  // 2. Test GitHub Connectivity with a simple public repo
  let githubStatus = 'UNKNOWN';
  let githubDetails: any = null;
  try {
    const ghRes = await fetchRepoFiles('https://github.com/octocat/Hello-World');
    githubStatus = 'OK';
    githubDetails = {
      owner: ghRes.owner,
      repo: ghRes.repo,
      branch: ghRes.branch,
      filesDiscovered: ghRes.files_discovered,
      filesEligible: ghRes.files_eligible,
    };
  } catch (ghErr: any) {
    githubStatus = 'ERROR';
    githubDetails = { error: ghErr.message };
  }

  const overallHealthy = groqStatus === 'OK' && githubStatus === 'OK';
  const totalDuration = Date.now() - startTime;

  return c.json({
    status: overallHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalDurationMs: totalDuration,
    services: {
      groq: {
        status: groqStatus,
        message: groqMessage,
        testPromptResult: testResponse,
        latencyMs: durationMs,
        metrics: groqManager.getMetrics(),
        keys: groqManager.getKeyStatuses(),
      },
      github: {
        status: githubStatus,
        details: githubDetails,
      },
    },
  }, overallHealthy ? 200 : 503);
}
