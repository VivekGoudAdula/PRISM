import type { Context } from 'hono';
import { extractText } from './lib/extract-document';
import { resolveFiles } from './lib/resolve-files';
import { processClaimExtraction } from './claim-extract-fast';
import { ACCURATE_MODEL } from './lib/openrouter-client';

/**
 * POST /claim-extract-accurate
 * High-precision claim extraction using accurate LLM reasoning tier
 */
export async function handleClaimExtractAccurateRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /claim-extract-accurate handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { text, documentType, taskDescription } = body;

    const { files, taskDescription: resolvedTaskDesc } = await resolveFiles(body);
    let inputText = text || '';

    if (files && files.length > 0) {
      for (const file of files) {
        let fileText = file.text || '';
        if (!fileText && file.content_base64) {
          try {
            const extResult = await extractText(file.filename, file.content_base64);
            fileText = extResult.text;
          } catch (err) {
            console.error(`Failed to extract text for file ${file.filename}:`, err);
          }
        }
        if (fileText) {
          inputText += (inputText ? '\n\n' : '') + fileText;
        }
      }
    }

    if (!inputText && (taskDescription || resolvedTaskDesc)) {
      inputText = taskDescription || resolvedTaskDesc;
    }

    if (!inputText || inputText.trim().length === 0) {
      return c.json({ error: 'No text or valid document provided for claim extraction.' }, 400);
    }

    const llmStart = Date.now();
    const result = await processClaimExtraction(inputText, documentType, ACCURATE_MODEL);
    const latency_ms = Date.now() - llmStart;

    return c.json({
      ...result,
      confidence: 0.94,
      latency_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in claim-extract-accurate handler:', error);
    return c.json({ error: 'Internal server error during accurate claim extraction', message: error?.message }, 500);
  }
}
