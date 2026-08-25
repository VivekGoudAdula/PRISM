import type { Context } from 'hono';
import { openrouterManager } from '../handlers/lib/openrouter-manager';
import { fetchRepoFiles } from '../handlers/lib/fetch-repo';

/**
 * GET /api/health/openrouter (and legacy alias GET /api/health/groq)
 * Diagnostic health check to verify OpenRouter API connectivity, key status, and GitHub API connectivity.
 */
export async function handleOpenRouterHealthCheck(c: Context) {
  const startTime = Date.now();
  openrouterManager.reloadKeys();

  let openrouterStatus = 'UNKNOWN';
  let openrouterMessage = '';
  let testResponse = '';
  let durationMs = 0;

  try {
    const testStart = Date.now();
    const result = await openrouterManager.chatCompletion<{ reply?: string }>({
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'user', content: 'Reply with exactly: OPENROUTER_WORKING' },
      ],
      temperature: 0.0,
      responseFormatJson: false,
    });

    durationMs = Date.now() - testStart;
    testResponse = result.rawContent.trim();

    if (testResponse.includes('OPENROUTER_WORKING') || testResponse.length > 0) {
      openrouterStatus = 'OK';
      openrouterMessage = 'OpenRouter API is fully operational and authenticated.';
    } else {
      openrouterStatus = 'WARNING';
      openrouterMessage = `OpenRouter responded, but output text was: "${testResponse.slice(0, 50)}"`;
    }
  } catch (err: any) {
    openrouterStatus = 'ERROR';
    openrouterMessage = err.message || 'OpenRouter connection failed.';
  }

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

  const overallHealthy = openrouterStatus === 'OK' && githubStatus === 'OK';
  const totalDuration = Date.now() - startTime;

  return c.json({
    status: overallHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalDurationMs: totalDuration,
    services: {
      openrouter: {
        status: openrouterStatus,
        message: openrouterMessage,
        testPromptResult: testResponse,
        latencyMs: durationMs,
        metrics: openrouterManager.getMetrics(),
        keys: openrouterManager.getKeyStatuses(),
      },
      github: {
        status: githubStatus,
        details: githubDetails,
      },
    },
  }, overallHealthy ? 200 : 503);
}
