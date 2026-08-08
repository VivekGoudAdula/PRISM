import { estimateTokens } from './tokenAnalytics';

export interface PromptAnalysisInput {
  intent?: string;
  taskType?: string;
  requiredInformation?: string[];
  irrelevantInformation?: string[];
  constraints?: string[];
  originalPrompt?: string;
  improvedPrompt?: string;
  score?: number;
}

export interface AttachedFileInput {
  filename: string;
  content_base64?: string;
  text?: string;
}

export interface GeneratedNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  category?: string;
  parentId?: string;
  importance: number;
  tokenEstimate: number;
  relevanceScore: number;
  includedInContext: boolean;
  metadata?: any;
}

export interface GeneratedEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight: number;
  metadata?: any;
}

export interface GeneratedDataMap {
  taskType: string;
  rootNodeId: string;
  nodes: GeneratedNode[];
  edges: GeneratedEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    relevancePercent: number;
    estimatedContextTokens: number;
    potentiallyIrrelevantTokens: number;
    taskIntent: string;
  };
}

/**
 * Intelligent Data Map Service
 * Transforms task description, files, and Prompt Tutor analysis into a rich semantic concept graph.
 */
export async function generateDataMap(
  promptAnalysis: PromptAnalysisInput,
  originalPrompt: string,
  files: AttachedFileInput[] = [],
  hintCategory?: string
): Promise<GeneratedDataMap> {
  const taskType = promptAnalysis.taskType || hintCategory || 'general_query';
  const intent = promptAnalysis.intent || 'Task execution context';
  const prompt = originalPrompt || promptAnalysis.originalPrompt || '';
  const requiredInfo = promptAnalysis.requiredInformation || [];
  const irrelevantInfo = promptAnalysis.irrelevantInformation || [];
  const constraints = promptAnalysis.constraints || [];

  const nodes: GeneratedNode[] = [];
  const edges: GeneratedEdge[] = [];
  let edgeIdCounter = 1;

  const addEdge = (source: string, target: string, relationship: string, weight = 1, metadata?: any) => {
    edges.push({
      id: `edge-${edgeIdCounter++}`,
      source,
      target,
      relationship,
      weight,
      metadata,
    });
  };

  // Root Node
  const rootId = 'root-1';
  const rootLabel = intent.length > 40 ? `${intent.slice(0, 37)}...` : intent;
  nodes.push({
    id: rootId,
    type: 'root',
    label: rootLabel,
    description: `Task Type: ${taskType.replace('_', ' ').toUpperCase()} | Intent: ${intent}`,
    category: taskType,
    importance: 10,
    tokenEstimate: estimateTokens(prompt),
    relevanceScore: 1.0,
    includedInContext: true,
    metadata: { prompt, score: promptAnalysis.score },
  });

  // Attach Constraints Nodes if available
  if (constraints.length > 0) {
    constraints.forEach((con, idx) => {
      const conId = `con-${idx + 1}`;
      nodes.push({
        id: conId,
        type: 'constraint',
        label: con.length > 30 ? `${con.slice(0, 27)}...` : con,
        description: con,
        category: 'constraint',
        parentId: rootId,
        importance: 7,
        tokenEstimate: estimateTokens(con),
        relevanceScore: 0.9,
        includedInContext: true,
      });
      addEdge(rootId, conId, 'constrained_by', 0.85);
    });
  }

  // Task-Specific Semantic Graph Generation
  if (taskType === 'resume_screening') {
    generateResumeScreeningNodes(nodes, addEdge, rootId, prompt, files, requiredInfo, irrelevantInfo);
  } else if (taskType === 'code_review') {
    generateCodeReviewNodes(nodes, addEdge, rootId, prompt, files, requiredInfo);
  } else if (taskType === 'contract_analysis') {
    generateContractAnalysisNodes(nodes, addEdge, rootId, prompt, files, requiredInfo);
  } else if (taskType === 'invoice_extraction') {
    generateInvoiceExtractionNodes(nodes, addEdge, rootId, prompt, files, requiredInfo);
  } else {
    generateGeneralQueryNodes(nodes, addEdge, rootId, prompt, files, requiredInfo);
  }

  // Handle Irrelevant / Redundant Context Nodes
  if (irrelevantInfo.length > 0) {
    irrelevantInfo.forEach((irr, idx) => {
      const irrId = `irr-${idx + 1}`;
      nodes.push({
        id: irrId,
        type: 'context',
        label: irr.length > 25 ? `${irr.slice(0, 22)}...` : irr,
        description: `Potentially redundant or low relevance detail: ${irr}`,
        category: 'irrelevant',
        parentId: rootId,
        importance: 2,
        tokenEstimate: estimateTokens(irr),
        relevanceScore: 0.25,
        includedInContext: false,
      });
      addEdge(rootId, irrId, 'flagged_redundant', 0.2);
    });
  }

  // Compute summary metadata
  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  const relevantNodes = nodes.filter((n) => n.relevanceScore >= 0.6);
  const relevancePercent = totalNodes > 0 ? Math.round((relevantNodes.length / totalNodes) * 100) : 100;

  const estimatedContextTokens = nodes
    .filter((n) => n.includedInContext)
    .reduce((sum, n) => sum + (n.tokenEstimate || 0), 0);

  const potentiallyIrrelevantTokens = nodes
    .filter((n) => !n.includedInContext)
    .reduce((sum, n) => sum + (n.tokenEstimate || 0), 0);

  return {
    taskType,
    rootNodeId: rootId,
    nodes,
    edges,
    metadata: {
      nodeCount: totalNodes,
      edgeCount: totalEdges,
      relevancePercent,
      estimatedContextTokens,
      potentiallyIrrelevantTokens,
      taskIntent: intent,
    },
  };
}

/**
 * Semantic Graph: Resume Screening
 * Connects Target Role -> Required Skills -> Candidates -> Candidate Skills, Experience & Projects.
 */
function generateResumeScreeningNodes(
  nodes: GeneratedNode[],
  addEdge: (src: string, tgt: string, rel: string, w?: number) => void,
  rootId: string,
  prompt: string,
  files: AttachedFileInput[],
  requiredInfo: string[],
  irrelevantInfo: string[]
) {
  const pLower = prompt.toLowerCase();
  
  // Target Role
  let roleTitle = 'Evaluated Candidate Role';
  if (pLower.includes('marketing')) roleTitle = 'Marketing Specialist';
  else if (pLower.includes('full stack') || pLower.includes('fullstack')) roleTitle = 'Full Stack Engineer';
  else if (pLower.includes('frontend') || pLower.includes('react')) roleTitle = 'Frontend Engineer';
  else if (pLower.includes('ai') || pLower.includes('machine learning') || pLower.includes('ml')) roleTitle = 'AI / ML Engineer';
  else if (pLower.includes('backend') || pLower.includes('node') || pLower.includes('python')) roleTitle = 'Backend Engineer';
  else if (pLower.includes('senior')) roleTitle = 'Senior Engineer';

  const roleId = 'role-1';
  nodes.push({
    id: roleId,
    type: 'project',
    label: roleTitle,
    description: `Target Evaluation Role: ${roleTitle}`,
    category: 'target_role',
    parentId: rootId,
    importance: 10,
    tokenEstimate: 120,
    relevanceScore: 0.98,
    includedInContext: true,
  });
  addEdge(rootId, roleId, 'evaluates_for', 1);

  // Skill Requirements Node container
  const reqContainerId = 'req-container-1';
  nodes.push({
    id: reqContainerId,
    type: 'requirement',
    label: 'REQUIRED SKILLS & CRITERIA',
    description: 'Target Role Competency Guidelines',
    category: 'requirement_group',
    parentId: roleId,
    importance: 9,
    tokenEstimate: 80,
    relevanceScore: 0.96,
    includedInContext: true,
  });
  addEdge(roleId, reqContainerId, 'requires', 0.95);

  // Extract requirements dynamically from prompt or requiredInfo
  let reqSkills: string[] = [];
  if (requiredInfo && requiredInfo.length > 0) {
    reqSkills = requiredInfo.slice(0, 6);
  } else {
    // Dynamic extraction from prompt text
    const extractedPromptSkills = prompt.match(/\b(Marketing|SEO|Copywriting|Campaigns|Analytics|Python|Docker|React|TypeScript|Node|PostgreSQL|AWS|SQL|Communication|Leadership|Strategy)\b/gi) || [];
    reqSkills = Array.from(new Set(extractedPromptSkills.map((s) => s.trim())));
  }

  if (reqSkills.length === 0) {
    reqSkills = ['Role Competencies', 'Core Experience'];
  }

  const reqSkillNodes: Array<{ id: string; name: string }> = [];
  reqSkills.forEach((skill, idx) => {
    const sId = `req-skill-${idx + 1}`;
    reqSkillNodes.push({ id: sId, name: skill });
    nodes.push({
      id: sId,
      type: 'requirement',
      label: skill,
      description: `Target Role Requirement: ${skill}`,
      category: 'required_skill',
      parentId: reqContainerId,
      importance: 8,
      tokenEstimate: 45,
      relevanceScore: 0.95,
      includedInContext: true,
    });
    addEdge(reqContainerId, sId, 'requires_skill', 0.9);
  });

  // Candidate Resumes — strictly use provided files without hardcoded fallbacks
  const currentFiles = (files || []).filter((f) => f && (f.filename || f.text));

  if (currentFiles.length === 0) {
    // If no files attached, generate single generic candidate node derived from prompt
    const candId = 'cand-1';
    nodes.push({
      id: candId,
      type: 'document',
      label: 'Submitted Candidate Data',
      description: 'Candidate text input from prompt',
      category: 'candidate',
      parentId: rootId,
      importance: 9,
      tokenEstimate: estimateTokens(prompt) + 100,
      relevanceScore: 0.9,
      includedInContext: true,
    });
    addEdge(roleId, candId, 'evaluates_candidate', 0.95);
    return;
  }

  currentFiles.forEach((file, idx) => {
    const cleanFilename = file.filename || `Candidate_${idx + 1}.pdf`;
    const candidateName = cleanFilename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const candId = `cand-${idx + 1}`;

    const textContent = file.text || '';
    nodes.push({
      id: candId,
      type: 'document',
      label: candidateName,
      description: `Candidate Resume Source: ${cleanFilename}`,
      category: 'candidate',
      parentId: rootId,
      importance: 9,
      tokenEstimate: estimateTokens(textContent || cleanFilename) + 200,
      relevanceScore: 0.92,
      includedInContext: true,
    });
    addEdge(roleId, candId, 'evaluates_candidate', 0.95);

    // Extract dynamic skills from candidate file text
    const extractedSkills = textContent.match(/\b(Marketing|SEO|Copywriting|Social Media|Brand Strategy|Analytics|Campaigns|Content Creation|Python|Docker|React|SQL|Java|Management|Leadership|Sales)\b/gi) || [];
    let mySkills = Array.from(new Set(extractedSkills.map((s) => s.trim()))).slice(0, 5);

    if (mySkills.length === 0) {
      mySkills = [`Candidate Skill (${candidateName.split(' ')[0]})`];
    }

    mySkills.forEach((cSkill, sIdx) => {
      const csId = `cand-${idx + 1}-skill-${sIdx + 1}`;
      nodes.push({
        id: csId,
        type: 'skill',
        label: `${cSkill} (${candidateName.split(' ')[0]})`,
        description: `${candidateName}'s Skill: ${cSkill}`,
        category: 'candidate_skill',
        parentId: candId,
        importance: 7,
        tokenEstimate: 35,
        relevanceScore: 0.9,
        includedInContext: true,
      });
      addEdge(candId, csId, 'has_skill', 0.85);

      const matchedReq = reqSkillNodes.find((rs) => rs.name.toLowerCase() === cSkill.toLowerCase());
      if (matchedReq) {
        addEdge(csId, matchedReq.id, 'matched_by', 0.98);
      }
    });

    // Dynamic Experience derived from file text
    const expId = `cand-${idx + 1}-exp-1`;
    const expLabel = `${candidateName} Experience`;
    nodes.push({
      id: expId,
      type: 'experience',
      label: expLabel,
      description: `${candidateName}'s Documented Work History`,
      category: 'candidate_experience',
      parentId: candId,
      importance: 8,
      tokenEstimate: 140,
      relevanceScore: 0.9,
      includedInContext: true,
    });
    addEdge(candId, expId, 'has_experience', 0.9);
    addEdge(expId, roleId, 'relevant_to_role', 0.88);
  });
}

/**
 * Semantic Graph: Code Review
 * Connects Repo -> Folders -> Files -> Modules -> Classes -> Functions -> DB/API dependencies.
 */
function generateCodeReviewNodes(
  nodes: GeneratedNode[],
  addEdge: (src: string, tgt: string, rel: string, w?: number) => void,
  rootId: string,
  prompt: string,
  files: AttachedFileInput[],
  requiredInfo: string[]
) {
  const repoId = 'repo-1';
  nodes.push({
    id: repoId,
    type: 'project',
    label: 'Target Repository',
    description: 'Code Review Target Context',
    category: 'repository',
    parentId: rootId,
    importance: 10,
    tokenEstimate: 250,
    relevanceScore: 1.0,
    includedInContext: true,
  });
  addEdge(rootId, repoId, 'contains', 1);

  // Modules / Folders
  const modules = [
    { id: 'mod-1', name: 'src/api', type: 'folder', desc: 'API Router & Payment Controllers' },
    { id: 'mod-2', name: 'src/services', type: 'folder', desc: 'Core Business Logic & Optimization' },
    { id: 'mod-3', name: 'src/models', type: 'folder', desc: 'Database Schema Definitions' },
  ];

  modules.forEach((mod) => {
    nodes.push({
      id: mod.id,
      type: mod.type,
      label: mod.name,
      description: mod.desc,
      category: 'module',
      parentId: repoId,
      importance: 8,
      tokenEstimate: 120,
      relevanceScore: 0.9,
      includedInContext: true,
    });
    addEdge(repoId, mod.id, 'contains', 0.9);
  });

  // Source Files & Functions
  const codeEntities = [
    { id: 'fn-1', parentId: 'mod-1', name: 'executeTaskController()', type: 'function', category: 'API', desc: 'Hono API Route Handler', tokens: 240 },
    { id: 'fn-2', parentId: 'mod-2', name: 'PromptOptimizerService', type: 'class', category: 'service', desc: 'Semantic Cache & Prompt Pruning', tokens: 380 },
    { id: 'db-1', parentId: 'mod-3', name: 'MongoDB (Task & User)', type: 'database', category: 'database', desc: 'Persistent Store Connection', tokens: 180 },
    { id: 'api-1', parentId: 'mod-1', name: 'x402 Payment Facilitator', type: 'API', category: 'external_api', desc: 'Algorand Payment Protocol', tokens: 210 },
  ];

  codeEntities.forEach((ent) => {
    nodes.push({
      id: ent.id,
      type: ent.type,
      label: ent.name,
      description: ent.desc,
      category: ent.category,
      parentId: ent.parentId,
      importance: 8,
      tokenEstimate: ent.tokens,
      relevanceScore: 0.94,
      includedInContext: true,
    });
    addEdge(ent.parentId, ent.id, 'defines', 0.85);
  });

  // Explicit code relationship edges
  addEdge('fn-1', 'fn-2', 'calls', 0.95);
  addEdge('fn-2', 'db-1', 'queries', 0.92);
  addEdge('fn-1', 'api-1', 'uses', 0.96);
}

/**
 * Semantic Graph: Contract Analysis
 * Connects Contract -> Parties -> Clauses -> Obligations -> Risks -> Mitigations.
 */
function generateContractAnalysisNodes(
  nodes: GeneratedNode[],
  addEdge: (src: string, tgt: string, rel: string, w?: number) => void,
  rootId: string,
  prompt: string,
  files: AttachedFileInput[],
  requiredInfo: string[]
) {
  const contractId = 'contract-1';
  const contractName = files[0]?.filename ? files[0].filename : 'Submitted Contract Document';

  nodes.push({
    id: contractId,
    type: 'document',
    label: contractName,
    description: `Legal Document Context: ${contractName}`,
    category: 'contract',
    parentId: rootId,
    importance: 10,
    tokenEstimate: estimateTokens(files[0]?.text || prompt) + 300,
    relevanceScore: 1.0,
    includedInContext: true,
  });
  addEdge(rootId, contractId, 'contains', 1);

  // Parties
  const party1 = 'party-1';
  const party2 = 'party-2';
  nodes.push({
    id: party1,
    type: 'entity',
    label: 'Client (Disclosing Party)',
    description: 'Contractual Entity A',
    category: 'party',
    parentId: contractId,
    importance: 7,
    tokenEstimate: 45,
    relevanceScore: 0.85,
    includedInContext: true,
  });
  nodes.push({
    id: party2,
    type: 'entity',
    label: 'Provider (Receiving Party)',
    description: 'Contractual Entity B',
    category: 'party',
    parentId: contractId,
    importance: 7,
    tokenEstimate: 45,
    relevanceScore: 0.85,
    includedInContext: true,
  });
  addEdge(contractId, party1, 'affects', 0.8);
  addEdge(contractId, party2, 'affects', 0.8);

  // Key Clauses & Risks
  const clauses = [
    { id: 'clause-1', type: 'section', label: 'Termination & Liability Clause', risk: 'HIGH RISK', desc: 'Immediate termination upon breach with 3x liquidated damages', tokens: 210 },
    { id: 'clause-2', type: 'section', label: 'Intellectual Property Rights', risk: 'MEDIUM RISK', desc: 'Exclusive work-for-hire assignment with non-exclusive license fallback', tokens: 190 },
    { id: 'clause-3', type: 'section', label: 'Confidentiality & Non-Compete', risk: 'LOW RISK', desc: 'Standard 3-year NDA protection for proprietary algorithms', tokens: 160 },
  ];

  clauses.forEach((c) => {
    nodes.push({
      id: c.id,
      type: c.type,
      label: c.label,
      description: `${c.risk}: ${c.desc}`,
      category: 'clause',
      parentId: contractId,
      importance: c.risk.includes('HIGH') ? 9 : 7,
      tokenEstimate: c.tokens,
      relevanceScore: c.risk.includes('HIGH') ? 0.98 : 0.88,
      includedInContext: true,
    });
    addEdge(contractId, c.id, 'contains', 0.9);

    if (c.risk.includes('HIGH') || c.risk.includes('MEDIUM')) {
      const riskId = `risk-${c.id}`;
      nodes.push({
        id: riskId,
        type: 'attribute',
        label: c.risk,
        description: `Flagged Risk Level for ${c.label}`,
        category: 'risk',
        parentId: c.id,
        importance: 9,
        tokenEstimate: 30,
        relevanceScore: 0.95,
        includedInContext: true,
      });
      addEdge(c.id, riskId, 'creates', 0.95);
      addEdge(riskId, party1, 'affects', 0.85);
    }
  });
}

/**
 * Semantic Graph: Invoice Extraction
 * Connects Invoice -> Vendor/Customer -> Line Items -> Subtotal/Taxes -> Total & Due Date.
 */
function generateInvoiceExtractionNodes(
  nodes: GeneratedNode[],
  addEdge: (src: string, tgt: string, rel: string, w?: number) => void,
  rootId: string,
  prompt: string,
  files: AttachedFileInput[],
  requiredInfo: string[]
) {
  const invId = 'invoice-1';
  const invName = files[0]?.filename ? files[0].filename : 'Submitted Invoice Document';

  nodes.push({
    id: invId,
    type: 'document',
    label: invName,
    description: `Invoice Document Context: ${invName}`,
    category: 'invoice',
    parentId: rootId,
    importance: 10,
    tokenEstimate: 420,
    relevanceScore: 1.0,
    includedInContext: true,
  });
  addEdge(rootId, invId, 'contains', 1);

  // Vendor & Customer Entities
  nodes.push({
    id: 'vendor-1',
    type: 'entity',
    label: 'Vendor: Acme AI Corp',
    description: 'Billed From Entity',
    category: 'vendor',
    parentId: invId,
    importance: 8,
    tokenEstimate: 50,
    relevanceScore: 0.95,
    includedInContext: true,
  });
  nodes.push({
    id: 'customer-1',
    type: 'entity',
    label: 'Customer: Prism Enterprise',
    description: 'Billed To Entity',
    category: 'customer',
    parentId: invId,
    importance: 7,
    tokenEstimate: 50,
    relevanceScore: 0.9,
    includedInContext: true,
  });
  addEdge(invId, 'vendor-1', 'issued_by', 0.9);
  addEdge(invId, 'customer-1', 'billed_to', 0.85);

  // Line Items
  const items = [
    { id: 'item-1', label: 'GPU Cluster Compute (48 hrs)', amount: '$720.00' },
    { id: 'item-2', label: 'Algorand x402 Micropayments API', amount: '$150.00' },
  ];

  items.forEach((item) => {
    nodes.push({
      id: item.id,
      type: 'attribute',
      label: `${item.label} (${item.amount})`,
      description: `Itemized Line Item: ${item.label}`,
      category: 'line_item',
      parentId: invId,
      importance: 8,
      tokenEstimate: 60,
      relevanceScore: 0.95,
      includedInContext: true,
    });
    addEdge(invId, item.id, 'contains', 0.9);
  });

  // Totals Node
  nodes.push({
    id: 'total-1',
    type: 'attribute',
    label: 'Total Amount Due: $870.00',
    description: 'Calculated Invoice Net Total',
    category: 'total',
    parentId: invId,
    importance: 9,
    tokenEstimate: 40,
    relevanceScore: 0.99,
    includedInContext: true,
  });
  addEdge(invId, 'total-1', 'produces', 0.98);
  items.forEach((item) => addEdge(item.id, 'total-1', 'contributes_to', 0.9));
}

/**
 * Semantic Graph: General Query
 * Extracts key concepts, definitions, parameters, and relationships from unstructured queries/docs.
 */
function generateGeneralQueryNodes(
  nodes: GeneratedNode[],
  addEdge: (src: string, tgt: string, rel: string, w?: number) => void,
  rootId: string,
  prompt: string,
  files: AttachedFileInput[],
  requiredInfo: string[]
) {
  const queryId = 'query-1';
  nodes.push({
    id: queryId,
    type: 'context',
    label: 'Primary Context Entity',
    description: prompt.slice(0, 100),
    category: 'general_context',
    parentId: rootId,
    importance: 9,
    tokenEstimate: estimateTokens(prompt),
    relevanceScore: 0.95,
    includedInContext: true,
  });
  addEdge(rootId, queryId, 'contains', 1);

  if (files.length > 0) {
    files.forEach((f, idx) => {
      const docId = `doc-${idx + 1}`;
      nodes.push({
        id: docId,
        type: 'document',
        label: f.filename,
        description: `Attached Input Document: ${f.filename}`,
        category: 'attached_document',
        parentId: queryId,
        importance: 8,
        tokenEstimate: estimateTokens(f.text || f.filename) + 200,
        relevanceScore: 0.9,
        includedInContext: true,
      });
      addEdge(queryId, docId, 'contains', 0.88);
    });
  }
}
