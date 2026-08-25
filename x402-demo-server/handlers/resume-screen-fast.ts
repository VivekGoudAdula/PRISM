import type { Context } from 'hono';
import { extractText } from './lib/extract-document';
import { resolveFiles } from './lib/resolve-files';
import { groqManager } from './lib/groq-manager';

/**
 * POST /resume-screen-fast
 * Fast candidate resume screening using Groq LLM API
 */
export async function handleResumeScreenFastRequest(c: Context) {
  const startTime = Date.now();
  try {
    console.log('✓ PAYMENT VERIFIED - POST /resume-screen-fast handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { files, taskDescription: task_description } = await resolveFiles(body);

    if (!files || files.length === 0) {
      return c.json({ error: 'No files provided. At least one resume file must be uploaded.' }, 400);
    }

    const candidates: any[] = [];
    let totalLlmLatency = 0;

    for (const file of files) {
      let extracted_text = file.text || file.extracted_text || '';
      let semantic_map = file.semantic_map;
      if (!semantic_map) {
        if (!extracted_text && file.content_base64) {
          try {
            const extResult = await extractText(file.filename, file.content_base64);
            extracted_text = extResult.text;
          } catch (err) {
            console.error(`Failed to extract text for ${file.filename}:`, err);
          }
        }
        const { buildSemanticMap } = await import('./lib/semantic-map');
        const mapRes = await buildSemanticMap('resume_screening', extracted_text, file.filename);
        semantic_map = mapRes.map;
      }

      const aiResult = await groqManager.chatCompletion<{
        name?: string;
        match_score?: number;
        role?: string;
        key_skills?: string[];
        primary_domain?: string;
        alternative_roles?: string[];
        reason?: string;
      }>({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: 'Fast screen: Rate match score (0-1), extract name (use candidate name from semantic map), role, top key skills, primary_domain, alternative_roles, and reason (concise score rationale) based on structured resume semantic map. Return ONLY JSON: { "name": string, "match_score": number, "role": string, "key_skills": string[], "primary_domain": string, "alternative_roles": string[], "reason": string }',
          },
          {
            role: 'user',
            content: `Role: ${task_description}\nSemantic Map JSON: ${JSON.stringify(semantic_map)}`,
          },
        ],
        temperature: 0.1,
      });

      totalLlmLatency += aiResult.durationMs;
      const parsed = aiResult.data || {};

      const candidateName = parsed.name && parsed.name !== 'Candidate' && parsed.name !== 'Not Provided'
        ? parsed.name
        : (semantic_map?.name || file.filename.replace(/\.[^/.]+$/, ''));

      candidates.push({
        name: candidateName,
        match_score: typeof parsed.match_score === 'number' ? Math.max(0, Math.min(1, parsed.match_score)) : 0.5,
        role: parsed.role || 'Unknown',
        key_skills: Array.isArray(parsed.key_skills) ? parsed.key_skills : [],
        primary_domain: parsed.primary_domain || 'Software Development',
        alternative_roles: Array.isArray(parsed.alternative_roles) ? parsed.alternative_roles : [],
        reason: parsed.reason || 'Candidate evaluated against job criteria.',
      });
    }

    return c.json({
      success: true,
      candidates,
      confidence: 0.78,
      latency_ms: totalLlmLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in resume-screen-fast handler:', error);
    const status = error.status && typeof error.status === 'number' ? error.status : 500;
    return c.json({
      success: false,
      error: {
        code: error.code || 'AI_ANALYSIS_FAILED',
        message: error.message || 'Fast resume screening AI analysis failed',
        status,
        rotationReasons: error.rotationReasons,
      },
    }, status);
  }
}
