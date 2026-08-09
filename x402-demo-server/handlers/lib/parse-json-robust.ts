/**
 * Robust JSON extraction helper for LLM outputs.
 * Strips comments (`// ...`), trailing commas, Markdown code wrappers, and truncation trailing syntax.
 */
export function parseRobustJson<T = any>(content: string): T {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid content provided for JSON parsing');
  }

  // 1. Remove markdown code fences
  let cleaned = content.replace(/^```(?:json)?\s*/gi, '').replace(/```\s*$/gi, '').trim();

  // 2. Extract JSON object or array bounds
  const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!jsonMatch) {
    throw new Error('No JSON object or array found in text');
  }
  let str = jsonMatch[0];

  // 3. Remove inline comments (`// ...`) while preserving valid string URLs
  str = str.replace(/("(?:\\.|[^"\\])*")|(\/\/[^\r\n]*)/g, (match, stringLiteral, comment) => {
    if (stringLiteral) return stringLiteral;
    return '';
  });

  // 4. Remove block comments (`/* ... */`)
  str = str.replace(/\/\*[\s\S]*?\*\//g, '');

  // 5. Remove trailing commas before closing braces/brackets
  str = str.replace(/,\s*([\}\]])/g, '$1');

  // 6. Direct JSON parse attempt
  try {
    return JSON.parse(str);
  } catch (err1) {
    // 7. Fallback: fix missing closing brackets/quotes for truncated JSON
    let fixed = str;

    // Count open/close braces & quotes
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;

    // Trim trailing comma or incomplete key
    fixed = fixed.replace(/,\s*$/, '');
    fixed = fixed.replace(/,\s*"[^"]*"$/s, '');

    for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';

    try {
      return JSON.parse(fixed);
    } catch (err2) {
      throw new Error(`Failed to parse JSON even after robust cleanup: ${(err1 as Error).message}`);
    }
  }
}
