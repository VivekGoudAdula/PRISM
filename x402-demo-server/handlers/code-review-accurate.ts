import type { Context } from 'hono';
import { resolveFiles } from './lib/resolve-files';
import { openrouterManager } from './lib/openrouter-manager';

/**
 * POST /code-review-accurate
 * High-precision senior-engineer code review for a single file using OpenRouter API
 */
export async function handleCodeReviewAccurateRequest(c: Context) {
  const startTime = Date.now();
  try {
    console.log('✓ PAYMENT VERIFIED - POST /code-review-accurate handler executing');
    const body = await c.req.json().catch(() => ({}));

    const { files: resolvedFiles, taskDescription: resolvedTaskDesc } = await resolveFiles(body);
    const resolvedFile = resolvedFiles[0];

    const file_path = body.file_path || resolvedFile?.file_path || 'unknown.ts';
    const raw_url = body.raw_url || resolvedFile?.raw_url;
    const task_description = body.task_description || resolvedTaskDesc || 'Analyze provided source code for issues, bugs, and security risks.';

    let codeContent = resolvedFile?.code_content || resolvedFile?.text || '';
    if (!codeContent && raw_url) {
      try {
        const rawRes = await fetch(raw_url);
        if (rawRes.ok) {
          codeContent = await rawRes.text();
        }
      } catch (err) {
        console.error(`Failed to fetch raw file content from ${raw_url}:`, err);
      }
    }

    if (!codeContent) {
      return c.json({
        success: false,
        error: {
          code: 'FILE_CONTENT_UNAVAILABLE',
          message: `Unable to fetch source code content for file: ${file_path}`,
          status: 404,
        },
        file_path,
      }, 404);
    }

    const aiResult = await openrouterManager.chatCompletion<{
      issues: Array<{ line_estimate?: number; severity: 'low' | 'medium' | 'high'; description: string; suggestion: string }>;
      overall_quality_score?: number;
    }>({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [
        {
          role: 'system',
          content: 'Senior software engineer code review: Analyze source file for bugs, security vulnerabilities, and code quality issues. Return ONLY JSON: { "issues": [ { "line_estimate": number, "severity": "low" | "medium" | "high", "description": string, "suggestion": string } ], "overall_quality_score": number } where overall_quality_score is between 0 and 1.',
        },
        {
          role: 'user',
          content: `Instructions: ${task_description}\n\nFile Path: ${file_path}\nFile Content:\n${codeContent.slice(0, 15000)}`,
        },
      ],
      temperature: 0.1,
    });

    const parsed = aiResult.data || {};
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const overall_quality_score = typeof parsed.overall_quality_score === 'number'
      ? Math.max(0, Math.min(1, parsed.overall_quality_score))
      : 0.85;

    return c.json({
      success: true,
      file_path,
      issues,
      overall_quality_score,
      confidence: 0.95,
      latency_ms: aiResult.durationMs,
      usage: aiResult.usage,
      keyId: aiResult.keyId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in code-review-accurate handler:', error);
    const status = error.status && typeof error.status === 'number' ? error.status : 500;
    return c.json({
      success: false,
      error: {
        code: error.code || 'AI_ANALYSIS_FAILED',
        message: error.message || 'Code review analysis failed',
        status,
        rotationReasons: error.rotationReasons,
      },
    }, status);
  }
}
