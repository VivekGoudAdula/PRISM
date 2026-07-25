/**
 * Verifies the output schema and quality based on the task category.
 * Prevents low-quality, empty, or placeholder-filled results from passing verification.
 */
export function verifyOutput(category: string, result: any): { passed: boolean; reason: string } {
  if (!result) {
    return { passed: false, reason: 'Result is empty or null' };
  }

  switch (category) {
    case 'invoice_extraction': {
      // Extract vendor name & total amount from direct result or documents list
      const vendorName = (
        result.vendor_name ||
        result.documents?.find((d: any) => d.vendor_name && d.vendor_name !== 'Unknown' && d.vendor_name !== 'N/A')?.vendor_name ||
        'Unknown'
      ).trim();

      const totalAmount = typeof result.total_amount === 'number' && result.total_amount > 0
        ? result.total_amount
        : (result.documents?.reduce((sum: number, d: any) => sum + (d.total_amount ?? 0), 0) || 0);

      const lineItems = result.line_items ?? result.documents?.flatMap((d: any) => d.line_items ?? []) ?? [];

      const invalidVendors = ['unknown', 'n/a', 'none', '', 'null', 'undefined'];
      const isVendorValid = vendorName && !invalidVendors.includes(vendorName.toLowerCase());

      if (!isVendorValid) {
        return {
          passed: false,
          reason: 'No valid vendor name found — vendor is missing, Unknown, or N/A'
        };
      }

      if (!totalAmount || totalAmount <= 0) {
        // Check if there are non-zero line items
        const hasNonZeroLineItems = lineItems.some((item: any) => {
          const amt = Number(item.amount ?? item.total ?? 0);
          return amt > 0;
        });

        if (!hasNonZeroLineItems) {
          return {
            passed: false,
            reason: 'no valid vendor or total amount found — this may not be an invoice'
          };
        }
      }

      // Check if line items exist but every line item is $0.00
      if (lineItems.length > 0) {
        const allZero = lineItems.every((item: any) => {
          const amt = Number(item.amount ?? item.total ?? 0);
          return amt === 0;
        });

        if (allZero && totalAmount <= 0) {
          return {
            passed: false,
            reason: 'Every line item has a $0.00 amount and total amount is 0'
          };
        }
      }

      return { passed: true, reason: 'Valid invoice data extracted with vendor name and non-zero amount' };
    }

    case 'resume_screening': {
      const candidates = result.candidates ?? result.documents?.flatMap((d: any) => d.candidates ?? []) ?? [];

      if (!Array.isArray(candidates) || candidates.length === 0) {
        return { passed: false, reason: 'Missing or empty candidates array' };
      }

      // Check if every candidate has a missing name or match_score of 0
      const validCandidates = candidates.filter((c: any) => {
        const name = (c.name || '').trim();
        const score = typeof c.match_score === 'number' ? c.match_score : 0;
        return name.length > 0 && name.toLowerCase() !== 'unknown' && score > 0;
      });

      if (validCandidates.length === 0) {
        return {
          passed: false,
          reason: 'Every candidate is missing a valid name or has a match_score of 0'
        };
      }

      return { passed: true, reason: 'Valid candidates array with non-zero match scores' };
    }

    case 'contract_analysis': {
      const clauses = result.clauses_flagged ?? result.clauses ?? result.flags ?? result.documents?.flatMap((d: any) => d.clauses ?? []) ?? [];
      const overallRiskScore = typeof result.overall_risk_score === 'number' ? result.overall_risk_score : 0;

      const validClauses = clauses.filter((c: any) => {
        const text = (c.clause_summary || c.clause_text || c.description || '').trim();
        return text.length > 0 && !text.includes('Could not perform real LLM analysis');
      });

      if (validClauses.length === 0 && (!overallRiskScore || overallRiskScore === 0)) {
        return {
          passed: false,
          reason: 'No risk clauses flagged and overall_risk_score is 0 or missing'
        };
      }

      return { passed: true, reason: 'Valid risk clauses or non-zero overall risk score received' };
    }

    default:
      return { passed: false, reason: `Unknown task category: ${category}` };
  }
}
