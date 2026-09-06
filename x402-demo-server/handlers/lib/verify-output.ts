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

      // Log server warning for any candidates with empty key_skills
      candidates.forEach((c: any) => {
        const skills = Array.isArray(c.key_skills) ? c.key_skills : [];
        if (skills.length === 0) {
          console.warn(`⚠️ [verifyOutput Warning] Candidate '${c.name || 'Unknown'}' returned with an empty key_skills array.`);
        }
      });

      // Check for valid candidates: non-empty name, non-zero match score, and fail if key_skills is empty AND match_score < 0.3
      const validCandidates = candidates.filter((c: any) => {
        const name = (c.name || '').trim();
        const score = typeof c.match_score === 'number' ? c.match_score : 0;
        const skills = Array.isArray(c.key_skills) ? c.key_skills : [];

        // Fail if candidate has empty key_skills AND match_score < 0.3 (indicates failed extraction)
        if (skills.length === 0 && score < 0.3) {
          return false;
        }

        return name.length > 0 && name.toLowerCase() !== 'unknown' && score > 0;
      });

      if (validCandidates.length === 0) {
        return {
          passed: false,
          reason: 'Every candidate is missing a valid name, has a match_score of 0, or returned empty key_skills with a low match score (< 0.3)'
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

    case 'code_review': {
      const files = result.files ?? (result.file_path ? [result] : []);
      if (!Array.isArray(files) || files.length === 0) {
        return { passed: false, reason: 'Missing or empty code review files array' };
      }

      const validFiles = files.filter((f: any) => {
        const hasValidPath = typeof f.file_path === 'string' && f.file_path.trim().length > 0;
        const hasIssuesArray = Array.isArray(f.issues);
        const hasValidScore = typeof f.overall_quality_score === 'number' || typeof result.averageQualityScore === 'number';
        return hasValidPath && hasIssuesArray && hasValidScore;
      });

      if (validFiles.length === 0) {
        return {
          passed: false,
          reason: 'Missing or malformed code review issues array or quality score'
        };
      }

      return { passed: true, reason: 'Valid code review report generated with verified file issues and quality scores' };
    }

    case 'seo_audit': {
      const pages = result.pages ?? (result.page_url ? [result] : []);
      if (!Array.isArray(pages) || pages.length === 0) {
        return { passed: false, reason: 'Missing or empty SEO audit pages array' };
      }

      const validPages = pages.filter((p: any) => {
        const hasUrl = typeof p.page_url === 'string' && p.page_url.trim().length > 0;
        const hasIssuesArray = Array.isArray(p.issues);
        const hasScore = typeof p.seo_score === 'number' || typeof result.overallSiteScore === 'number';
        return hasUrl && hasIssuesArray && hasScore;
      });

      if (validPages.length === 0) {
        return {
          passed: false,
          reason: 'Missing or malformed SEO audit issues array or seo_score'
        };
      }

      return { passed: true, reason: 'Valid SEO audit report generated with verified page issues and scores' };
    }

    case 'claim_extraction': {
      const claims = result.claims ?? result.documents?.flatMap((d: any) => d.claims ?? []) ?? [];
      if (!Array.isArray(claims)) {
        return { passed: false, reason: 'Claims field is missing or not an array' };
      }
      if (claims.length === 0 && !result.success) {
        return { passed: false, reason: 'Claim extraction failed to return result claims' };
      }
      return { passed: true, reason: 'Valid atomic claim extraction output verified' };
    }

    case 'claim_verification': {
      const verification = result.verification || result;
      const status = verification?.status || result?.status;
      const validStatuses = [
        'SUPPORTED_BY_PROVIDED_EVIDENCE',
        'CONTRADICTED_BY_PROVIDED_EVIDENCE',
        'PARTIALLY_SUPPORTED',
        'INSUFFICIENT_EVIDENCE',
        'REQUIRES_VERIFICATION'
      ];
      if (!status || !validStatuses.includes(status)) {
        return { passed: false, reason: `Invalid or missing claim verification status: ${status}` };
      }
      if (typeof result.success === 'boolean' && !result.success) {
        return { passed: false, reason: 'Claim verification reported success = false' };
      }
      return { passed: true, reason: 'Valid claim verification output verified' };
    }

    case 'news_research': {
      if (typeof result.success === 'boolean' && !result.success) {
        return { passed: false, reason: 'News research orchestrator reported failure' };
      }
      if (!result.researchBrief && !result.executiveSummary) {
        return { passed: false, reason: 'Missing researchBrief or executiveSummary in news_research output' };
      }
      if (!Array.isArray(result.claims) || !Array.isArray(result.agreements) || !Array.isArray(result.conflicts)) {
        return { passed: false, reason: 'Malformed claims, agreements, or conflicts arrays in news_research output' };
      }
      return { passed: true, reason: 'Valid news research workspace & brief output verified' };
    }

    case 'source_comparison': {
      if (typeof result.success === 'boolean' && !result.success) {
        return { passed: false, reason: 'Source comparison failed to return valid output' };
      }
      const claims = result.claims || [];
      const summary = result.summary || {};
      if (!Array.isArray(claims)) {
        return { passed: false, reason: 'Source comparison claims is not an array' };
      }
      return { passed: true, reason: 'Valid source comparison output verified' };
    }

    default:
      return { passed: false, reason: `Unknown task category: ${category}` };
  }
}
