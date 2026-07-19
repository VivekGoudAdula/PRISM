/**
 * Verifies the output schema and quality based on the category.
 */
export function verifyOutput(category: string, result: any): { passed: boolean; reason: string } {
  if (!result) {
    return { passed: false, reason: 'Result is empty or null' };
  }

  // Handle case where result might be wrapped in Hono response or returned directly as JSON object
  // Since we called the handler directly in-process returning c.json(data), the returned value is a Hono Response object!
  // Wait, let's look at how we called the handler in run-task.ts:
  // `handlerResult = await handleResumeScreenFastRequest(mockContextHandler);`
  // But wait, our mock Context is:
  // `json: (data: any) => data`
  // Ah! Since our mock Context's `json` method returns the raw JSON object directly,
  // handlerResult is indeed the raw JSON object! Let's verify this behavior.
  // Yes, `json: (data: any) => data` returns the object itself, not a Hono Response object.
  // So `result` is the raw JSON object.
  
  switch (category) {
    case 'resume_screening':
      if (result.candidates && Array.isArray(result.candidates) && result.candidates.length > 0) {
        return { passed: true, reason: 'Valid candidates array received' };
      }
      return { passed: false, reason: 'Missing or empty candidates array' };

    case 'invoice_extraction':
      if (result.line_items && Array.isArray(result.line_items) && result.line_items.length > 0) {
        return { passed: true, reason: 'Valid line_items array received' };
      }
      return { passed: false, reason: 'Missing or empty line_items array' };

    case 'contract_analysis':
      if (result.clauses || result.flags) {
        return { passed: true, reason: 'Valid clauses or flags field received' };
      }
      return { passed: false, reason: 'Missing clauses and flags fields' };

    default:
      return { passed: false, reason: `Unknown task category: ${category}` };
  }
}
