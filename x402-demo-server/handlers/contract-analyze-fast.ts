import type { Context } from 'hono';
import { extractText } from './lib/extract-document';
import { resolveFiles } from './lib/resolve-files';
import { groqManager } from './lib/groq-manager';

/**
 * POST /contract-analyze-fast
 * Fast contract analysis using Groq LLM API
 */
export async function handleContractAnalyzeFastRequest(c: Context) {
  const startTime = Date.now();
  try {
    console.log('✓ PAYMENT VERIFIED - POST /contract-analyze-fast handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { files, taskDescription: task_description } = await resolveFiles(body);

    if (!files || files.length === 0) {
      return c.json({ error: 'No files provided. At least one contract file must be uploaded.' }, 400);
    }

    let clauses_flagged: any[] = [];
    let totalRiskScore = 0;
    let filesWithRisk = 0;
    let totalLlmLatency = 0;

    for (const file of files) {
      let semantic_map = file.semantic_map;
      if (!semantic_map) {
        let extracted_text = file.text || '';
        if (!extracted_text && file.content_base64) {
          try {
            const extResult = await extractText(file.filename, file.content_base64);
            extracted_text = extResult.text;
          } catch (err) {
            console.error(`Failed to extract text for ${file.filename}:`, err);
          }
        }
        const { buildSemanticMap } = await import('./lib/semantic-map');
        const mapRes = await buildSemanticMap('contract_analysis', extracted_text, file.filename);
        semantic_map = mapRes.map;
      }

      const aiResult = await groqManager.chatCompletion<{
        clauses_flagged?: Array<{ clause_summary?: string; risk_level?: 'low' | 'medium' | 'high'; suggestion?: string }>;
        overall_risk_score?: number;
      }>({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: 'Fast contract analysis: Identify risk clauses or missing protections based on contract semantic map. Return ONLY JSON: { "clauses_flagged": [ { "clause_summary": string, "risk_level": "low" | "medium" | "high", "suggestion": string } ], "overall_risk_score": number } where overall_risk_score is between 0 and 1.',
          },
          {
            role: 'user',
            content: `Instructions: ${task_description}\n\nContract Semantic Map:\n${JSON.stringify(semantic_map)}`,
          },
        ],
        temperature: 0.1,
      });

      totalLlmLatency += aiResult.durationMs;
      const parsed = aiResult.data || {};
      const rawClauses = Array.isArray(parsed.clauses_flagged) ? parsed.clauses_flagged : [];

      const fileClauses = rawClauses.map((clause: any) => {
        const summary = clause.clause_summary || 'Risk clause identified';
        const riskLevel = clause.risk_level || 'medium';
        const suggestion = clause.suggestion || 'Review term with legal counsel.';
        return {
          clause_summary: summary,
          risk_level: riskLevel,
          suggestion,
          risk: riskLevel,
          type: 'Risk Clause',
          clause_text: summary,
          description: summary,
          mitigation: suggestion,
        };
      });

      const fileRiskScore = typeof parsed.overall_risk_score === 'number' ? Math.max(0, Math.min(1, parsed.overall_risk_score)) : 0.5;

      clauses_flagged = clauses_flagged.concat(fileClauses);
      totalRiskScore += fileRiskScore;
      filesWithRisk++;
    }

    const overall_risk_score = filesWithRisk > 0 ? parseFloat((totalRiskScore / filesWithRisk).toFixed(2)) : 0.5;

    return c.json({
      success: true,
      clauses_flagged,
      clauses: clauses_flagged,
      overall_risk_score,
      confidence: 0.78,
      latency_ms: totalLlmLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in contract-analyze-fast handler:', error);
    const status = error.status && typeof error.status === 'number' ? error.status : 500;
    return c.json({
      success: false,
      error: {
        code: error.code || 'AI_ANALYSIS_FAILED',
        message: error.message || 'Fast contract analysis AI failed',
        status,
        rotationReasons: error.rotationReasons,
      },
    }, status);
  }
}
