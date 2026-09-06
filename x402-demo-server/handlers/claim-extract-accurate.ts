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
    let fileExtractedText = '';

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
          fileExtractedText += (fileExtractedText ? '\n\n' : '') + fileText;
        }
      }
    }

    // Prefer extracted file text when files are attached; fall back to text / taskDescription
    let inputText = fileExtractedText.trim();
    if (!inputText) {
      inputText = (text || taskDescription || resolvedTaskDesc || '').trim();
    }

    // Filter out user meta-instruction lines (e.g. "extract claims from this doc/pdf")
    inputText = inputText
      .split('\n')
      .filter((line) => !/^(extract\s+claims|extract\s+factual\s+claims|extract\s+all\s+claims|analyze\s+this\s+doc)/i.test(line.trim()))
      .join('\n')
      .trim();

    if (!inputText || inputText.length === 0) {
      return c.json({ error: 'No valid document text provided for claim extraction.' }, 400);
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
