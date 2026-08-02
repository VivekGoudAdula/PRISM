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
  owner: string;
  repo: string;
  branch: string;
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'vendor',
  '.git',
  '.next',
  'out',
  'coverage',
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
  'cs', 'rb', 'php', 'swift', 'kt', 'scala', 'sql', 'sh', 'vue', 'svelte', 'sol', 'teal'
]);

const MEDIUM_PRIORITY_EXTS = new Set([
  'css', 'scss', 'less', 'html', 'xml', 'json', 'yaml', 'yml', 'toml', 'proto', 'graphql'
]);

const PRIORITY_FOLDERS = [
  'src/', 'lib/', 'app/', 'pkg/', 'internal/', 'core/', 'components/',
  'routes/', 'handlers/', 'services/', 'controllers/', 'models/', 'api/', 'views/'
];

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

  const isInPriorityFolder = PRIORITY_FOLDERS.some((folder) =>
    pathLower.startsWith(folder) || pathLower.includes('/' + folder)
  );

  if (isInPriorityFolder) {
    score += 50;
  }

  return score;
}

/**
 * Extract GitHub URL from text string if embedded within prompt.
 */
export function extractGitHubUrl(text: string): string | null {
  const match = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s"'>]+/i);
  return match ? match[0] : null;
}

/**
 * Parse owner, repo, and optional branch from a GitHub URL.
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string; branch?: string } {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s#\?]+)(?:\/tree\/([^\/\s#\?]+))?/i);
  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${url}`);
  }
  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }
  const branch = match[3];
  return { owner, repo, branch };
}

/**
 * Fetch headers for GitHub API requests.
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
 * Fetches public GitHub repository file tree, filters out non-code/large files,
 * ranks files by likely importance, and returns reviewable file metadata.
 */
export async function fetchRepoFiles(repoUrl: string): Promise<FetchRepoFilesResult> {
  const { owner, repo, branch: specifiedBranch } = parseGitHubUrl(repoUrl);
  const headers = getGitHubHeaders();

  let branch = specifiedBranch;

  // Step 1: If branch is not specified in URL, fetch default branch via GitHub API
  if (!branch) {
    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoInfoRes.ok) {
      if (repoInfoRes.status === 404) {
        throw new Error(`GitHub repository not found: ${owner}/${repo}`);
      }
      throw new Error(`Failed to fetch repository metadata for ${owner}/${repo}: ${repoInfoRes.statusText}`);
    }
    const repoInfo: any = await repoInfoRes.json();
    branch = repoInfo.default_branch || 'main';
  }

  // Step 2: Call GitHub recursive tree API
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    throw new Error(`Failed to fetch file tree for ${owner}/${repo}@${branch}: ${treeRes.statusText}`);
  }

  const treeData: any = await treeRes.json();
  const treeItems: any[] = Array.isArray(treeData.tree) ? treeData.tree : [];

  // Step 3: Filter files
  const filtered: RepoFile[] = [];

  for (const item of treeItems) {
    // Only process blobs (files), skip directories ('tree')
    if (item.type !== 'blob') continue;

    const filePath: string = item.path || '';

    // Check directory exclusion
    const pathSegments = filePath.split('/');
    const isExcludedDir = pathSegments.some((segment) => EXCLUDED_DIRS.has(segment.toLowerCase()));
    if (isExcludedDir) continue;

    // Check extension exclusion
    const ext = filePath.includes('.') ? filePath.split('.').pop()!.toLowerCase() : '';
    if (BINARY_EXTENSIONS.has(ext)) continue;

    // Check size limit (max 50KB = 50 * 1024 bytes)
    const fileSize: number = item.size ?? 0;
    if (fileSize > 50 * 1024) continue;

    // Build raw content URL
    const raw_url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;

    filtered.push({
      path: filePath,
      raw_url,
      size: fileSize,
    });
  }

  // Step 4: Prioritize files by score before capping
  filtered.sort((a, b) => {
    const scoreA = getFilePriorityScore(a.path);
    const scoreB = getFilePriorityScore(b.path);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    const depthA = a.path.split('/').length;
    const depthB = b.path.split('/').length;
    if (depthA !== depthB) {
      return depthA - depthB;
    }
    return a.path.localeCompare(b.path);
  });

  const total_files_found = filtered.length;
  const MAX_FILES = 30;
  const files = filtered.slice(0, MAX_FILES);
  const skipped = Math.max(0, total_files_found - MAX_FILES);
  const capped = total_files_found > MAX_FILES;

  return {
    files,
    skipped,
    capped,
    total_files_found,
    owner,
    repo,
    branch,
  };
}
