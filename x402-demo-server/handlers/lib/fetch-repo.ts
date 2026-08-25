import { config } from 'dotenv';
config();

export interface RepoFile {
  path: string;
  raw_url: string;
  size: number;
}

export interface FetchRepoFilesResult {
  files: RepoFile[];
  skipped: number;
  capped: boolean;
  total_files_found: number;
  files_discovered: number;
  files_eligible: number;
  files_fetched: number;
  files_failed: number;
  files_skipped: number;
  truncated: boolean;
  owner: string;
  repo: string;
  branch: string;
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

/** TTL for cached repo tree results: 10 minutes */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  result: FetchRepoFilesResult;
  expiresAt: number;
}

/**
 * Keyed by canonical "<owner>/<repo>@<branch>" or "<owner>/<repo>" when branch
 * is not yet known (resolved after the repo metadata fetch).
 */
const repoCache = new Map<string, CacheEntry>();

/** Return a cached result if it exists and hasn't expired; else null. */
function getCached(key: string): FetchRepoFilesResult | null {
  const entry = repoCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    repoCache.delete(key);
    return null;
  }
  console.log(`[fetch-repo] Cache HIT for "${key}" — skipping GitHub API calls`);
  return entry.result;
}

/** Store a result in cache with the TTL. */
function setCached(key: string, result: FetchRepoFilesResult): void {
  repoCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  console.log(`[fetch-repo] Cached "${key}" (expires in ${CACHE_TTL_MS / 1000}s)`);
}

// ─── File Filtering Config ───────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'vendor', '.git', '.next', 'out', 'coverage', '.cache', 'tmp', 'temp', '.venv', 'venv',
]);

const BINARY_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp', 'tiff', 'psd',
  // Fonts
  'ttf', 'woff', 'woff2', 'eot', 'otf',
  // Binaries & Executables
  'exe', 'dll', 'so', 'dylib', 'bin', 'pyc', 'class', 'wasm', 'o', 'a',
  // Archives
  'zip', 'tar', 'gz', '7z', 'rar', 'bz2', 'xz', 'iso',
  // Media
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'aac', 'ogg', 'webm',
  // Database / Documents
  'pdf', 'db', 'sqlite', 'sqlite3', 'pcap', 'ds_store',
]);

const HIGH_PRIORITY_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'rs', 'c', 'cpp', 'h', 'hpp',
  'cs', 'rb', 'php', 'swift', 'kt', 'scala', 'sql', 'sh', 'vue', 'svelte', 'sol', 'teal',
]);

const MEDIUM_PRIORITY_EXTS = new Set([
  'css', 'scss', 'less', 'html', 'xml', 'json', 'yaml', 'yml', 'toml', 'proto', 'graphql',
]);

const PRIORITY_FOLDERS = [
  'src/', 'lib/', 'app/', 'pkg/', 'internal/', 'core/', 'components/',
  'routes/', 'handlers/', 'services/', 'controllers/', 'models/', 'api/', 'views/',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute priority score for a file path based on extension and directory depth.
 */
export function getFilePriorityScore(filePath: string): number {
  let score = 0;
  const pathLower = filePath.toLowerCase();
  const ext = pathLower.includes('.') ? pathLower.split('.').pop()! : '';

  if (HIGH_PRIORITY_EXTS.has(ext)) {
    score += 100;
  } else if (MEDIUM_PRIORITY_EXTS.has(ext)) {
    score += 50;
  } else if (ext === 'md' || ext === 'txt') {
    score += 10;
  } else {
    score += 30;
  }

  const isInPriorityFolder = PRIORITY_FOLDERS.some(
    (folder) => pathLower.startsWith(folder) || pathLower.includes('/' + folder),
  );

  if (isInPriorityFolder) score += 50;

  return score;
}

/**
 * Extract GitHub URL from text string if embedded within a prompt.
 */
export function extractGitHubUrl(text: string): string | null {
  const match = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

/**
 * Parse owner, repo, and optional branch from a GitHub URL.
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string; branch?: string } {
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s#\?]+)(?:\/tree\/([^\/\s#\?]+))?/i,
  );
  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${url}`);
  }
  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);
  const branch = match[3];
  return { owner, repo, branch };
}

/**
 * Build HTTP headers for GitHub API requests.
 * Uses GITHUB_TOKEN or GH_TOKEN from env if available (raises rate limit to 5000/hr).
 */
function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'PRISM-CodeReview-App',
    'Accept': 'application/vnd.github.v3+json',
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Produce a human-readable rate-limit error with remaining time if available.
 */
function buildRateLimitError(headers: Headers): Error {
  const resetEpoch = headers.get('x-ratelimit-reset');
  const remaining  = headers.get('x-ratelimit-remaining');
  let hint = '';

  if (resetEpoch) {
    const resetAt = new Date(parseInt(resetEpoch, 10) * 1000);
    const minutesLeft = Math.ceil((resetAt.getTime() - Date.now()) / 60_000);
    hint = ` Rate limit resets in ~${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`;
  }
  if (remaining === '0') {
    hint += ' You have 0 requests remaining on this token.';
  }

  const tokenMsg = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    ? 'Your authenticated GitHub token has hit its rate limit.'
    : 'GitHub API rate limit exceeded (unauthenticated: 60 req/hr). Set a GITHUB_TOKEN in the server .env to get 5,000 req/hr.';

  return new Error(
    `GitHub rate limit exceeded — please wait a moment before reviewing the same repository again. ${tokenMsg}${hint}`,
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Fetches a GitHub repository's file tree, filters non-code/large files,
 * ranks by importance, and returns reviewable file metadata.
 *
 * Results are cached in memory for CACHE_TTL_MS (10 min) to avoid
 * hitting GitHub rate limits when the same repo is submitted multiple times.
 */
export async function fetchRepoFiles(repoUrl: string): Promise<FetchRepoFilesResult> {
  const { owner, repo, branch: specifiedBranch } = parseGitHubUrl(repoUrl);
  const headers = getGitHubHeaders();

  // ── Check cache before any network request ────────────────────────────────
  const partialKey = `${owner}/${repo}`;

  // Try branch-specific key first (if branch was specified in the URL)
  if (specifiedBranch) {
    const branchKey = `${partialKey}@${specifiedBranch}`;
    const cached = getCached(branchKey);
    if (cached) return cached;
  } else {
    // Try partial key (branch unknown yet) — this covers the most common case
    const cached = getCached(partialKey);
    if (cached) return cached;
  }

  let branch = specifiedBranch;

  // ── Step 1: Resolve default branch if not specified ───────────────────────
  if (!branch) {
    let repoInfoRes: Response | null = null;
    try {
      repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    } catch (fetchErr) {
      console.warn(`GitHub metadata fetch failed for ${owner}/${repo}, trying fallback branch main`);
    }

    if (!repoInfoRes || !repoInfoRes.ok) {
      if (repoInfoRes?.status === 403 || repoInfoRes?.status === 429) {
        throw buildRateLimitError(repoInfoRes.headers);
      }
      if (repoInfoRes?.status === 404) {
        throw new Error(`GitHub repository not found: ${owner}/${repo}`);
      }
      branch = 'main';
    } else {
      const repoInfo: any = await repoInfoRes.json().catch(() => ({}));
      branch = repoInfo.default_branch || 'main';
    }
  }

  const branchKey = `${partialKey}@${branch}`;
  const cachedWithBranch = getCached(branchKey);
  if (cachedWithBranch) return cachedWithBranch;

  // ── Step 2: Fetch the recursive file tree ────────────────────────────────
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  let treeRes: Response | null = null;
  try {
    treeRes = await fetch(treeUrl, { headers });
  } catch (err) {
    console.warn(`GitHub tree fetch network error for ${owner}/${repo}@${branch}:`, err);
    throw new Error(`Network error while fetching repository tree for ${owner}/${repo}@${branch}`);
  }

  if (!treeRes || !treeRes.ok) {
    const status = treeRes?.status || 500;
    if (status === 403 || status === 429) {
      throw buildRateLimitError(treeRes.headers);
    }
    if (status === 404) {
      throw new Error(`Repository or branch not found on GitHub: ${owner}/${repo}@${branch}`);
    }
    throw new Error(`GitHub API returned error (HTTP ${status}) while fetching repository tree for ${owner}/${repo}@${branch}`);
  }

  const treeData: any = await treeRes.json();
  const treeItems: any[] = Array.isArray(treeData.tree) ? treeData.tree : [];
  const truncated: boolean = Boolean(treeData.truncated);

  if (truncated) {
    console.warn(`⚠️ GitHub tree response for ${owner}/${repo}@${branch} was truncated by GitHub API (>100k entries or size limit).`);
  }

  // ── Step 3: Filter files ──────────────────────────────────────────────────
  const filtered: RepoFile[] = [];
  let filesDiscovered = 0;

  for (const item of treeItems) {
    // Only process blobs (files), skip directories ('tree')
    if (item.type !== 'blob') continue;
    filesDiscovered++;

    const filePath: string = item.path || '';

    // Exclude known non-code directories
    const pathSegments = filePath.split('/');
    const isExcludedDir = pathSegments.some((seg) => EXCLUDED_DIRS.has(seg.toLowerCase()));
    if (isExcludedDir) continue;

    // Exclude binary / non-text file types
    const ext = filePath.includes('.') ? filePath.split('.').pop()!.toLowerCase() : '';
    if (BINARY_EXTENSIONS.has(ext)) continue;

    // Exclude very large files (>100 KB for individual static analysis)
    const fileSize: number = item.size ?? 0;
    if (fileSize > 100 * 1024) continue;

    const raw_url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    filtered.push({ path: filePath, raw_url, size: fileSize });
  }

  // ── Step 4: Sort by priority score ────────────────────────────────────────
  filtered.sort((a, b) => {
    const scoreDiff = getFilePriorityScore(b.path) - getFilePriorityScore(a.path);
    if (scoreDiff !== 0) return scoreDiff;
    const depthDiff = a.path.split('/').length - b.path.split('/').length;
    if (depthDiff !== 0) return depthDiff;
    return a.path.localeCompare(b.path);
  });

  const files_eligible = filtered.length;
  // Cap at top 15 highest-priority architectural files to prevent redundant AI API cost overhead
  const MAX_FILES = 15;
  const files = filtered.slice(0, MAX_FILES);
  const files_fetched = files.length;
  const files_skipped = Math.max(0, files_eligible - MAX_FILES) + (filesDiscovered - files_eligible);
  const capped = files_eligible > MAX_FILES;

  const result: FetchRepoFilesResult = {
    files,
    skipped: files_skipped,
    capped,
    total_files_found: files_eligible,
    files_discovered: filesDiscovered,
    files_eligible,
    files_fetched,
    files_failed: 0,
    files_skipped,
    truncated,
    owner,
    repo,
    branch,
  };

  // ── Cache under both partial and full branch keys ─────────────────────────
  setCached(branchKey, result);
  setCached(partialKey, result);

  return result;
}
