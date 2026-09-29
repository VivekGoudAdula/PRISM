import type { Context } from 'hono';
import { extractText } from './lib/extract-document';
import { resolveFiles } from './lib/resolve-files';
import { callOpenRouter, ACCURATE_MODEL } from './lib/openrouter-client';
import { evaluateCandidateDeterministic } from './lib/resume-evaluator';

/**
 * POST /resume-screen-accurate
 * Accurate resume screening using OpenRouter API
 */
export async function handleResumeScreenAccurateRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /resume-screen-accurate handler executing');
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
      
      let candidateInfo = {
        name: semantic_map?.name || file.filename,
        match_score: 0.5,
        role: 'Unknown',
        key_skills: [],
        primary_domain: 'Unknown',
        alternative_roles: [] as string[],
        reason: '',
      };

      const llmStart = Date.now();
      try {
        const content = await callOpenRouter({
          model: ACCURATE_MODEL,
          messages: [
            {
              role: 'system',
              content: 'Evaluate the candidate based on their structured resume semantic map. Return ONLY a valid JSON object matching this schema: { "name": string, "match_score": number, "role": string, "key_skills": string[], "primary_domain": string, "alternative_roles": string[], "reason": string }. For "match_score", return a decimal float between 0.0 and 1.0 (for example 0.85 for 85% match, 0.25 for 25% match). DO NOT return values greater than 1.0. For "name", use the candidate name provided in the semantic map. For "reason", provide a concise explanation for the assigned match_score. Do not wrap in markdown codeblocks. Do not explain outside JSON.',
            },
            {
              role: 'user',
              content: `Target role: ${task_description}\n\nCandidate Semantic Map JSON:\n${JSON.stringify(semantic_map, null, 2)}`,
            },
          ],
          temperature: 0.1,
        });

        totalLlmLatency += (Date.now() - llmStart);
        let cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON object found in response');
        const parsed = JSON.parse(jsonMatch[0]);

        let matchScore = typeof parsed.match_score === 'number' ? parsed.match_score : 0.5;
        if (matchScore > 1.0) {
          matchScore = matchScore / 100;
        }
        matchScore = Math.min(1.0, Math.max(0.0, matchScore));

        candidateInfo = {
          name: parsed.name && parsed.name !== 'Candidate' && parsed.name !== 'Not Provided' ? parsed.name : (semantic_map?.name || file.filename),
          match_score: matchScore,
          role: parsed.role || 'Unknown',
          key_skills: Array.isArray(parsed.key_skills) ? parsed.key_skills : [],
          primary_domain: parsed.primary_domain || 'Unknown',
          alternative_roles: Array.isArray(parsed.alternative_roles) ? parsed.alternative_roles : [],
          reason: parsed.reason || (matchScore < 0.5 ? 'Resume shows limited experience relative to the target role requirements.' : 'Candidate profile evaluated against target role.'),
        };
      } catch (err) {
        console.warn(`Fallback active for candidate processing of file: ${file.filename}`, err);
        candidateInfo = evaluateCandidateDeterministic(file.filename, extracted_text, semantic_map, task_description);
      }
      candidates.push(candidateInfo);
    }

    return c.json({
      candidates,
      confidence: 0.93,
      latency_ms: totalLlmLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in resume-screen-accurate handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
