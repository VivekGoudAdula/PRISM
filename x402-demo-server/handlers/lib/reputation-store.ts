import * as fs from 'node:fs';
import * as path from 'node:path';

const reputationFilePath = path.join(__dirname, '..', '..', 'data', 'reputation.json');

export interface ReputationEntry {
  score: number;
  total_runs: number;
  verified_passes: number;
}

export type ReputationStore = Record<string, ReputationEntry>;

/**
 * Reads the reputation database
 */
export function readReputation(): ReputationStore {
  try {
    if (!fs.existsSync(reputationFilePath)) {
      // Return default template if file does not exist
      return {
        "/resume-screen-fast": { "score": 0.5, "total_runs": 0, "verified_passes": 0 },
        "/resume-screen-accurate": { "score": 0.5, "total_runs": 0, "verified_passes": 0 },
        "/contract-analyze-fast": { "score": 0.5, "total_runs": 0, "verified_passes": 0 },
        "/contract-analyze-accurate": { "score": 0.5, "total_runs": 0, "verified_passes": 0 },
        "/invoice-extract-fast": { "score": 0.5, "total_runs": 0, "verified_passes": 0 },
        "/invoice-extract-accurate": { "score": 0.5, "total_runs": 0, "verified_passes": 0 }
      };
    }
    const data = fs.readFileSync(reputationFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading reputation file:', error);
    return {};
  }
}

/**
 * Updates the reputation score of a specific endpoint
 */
export function updateReputation(endpoint_path: string, passed: boolean): void {
  try {
    const store = readReputation();
    if (!store[endpoint_path]) {
      store[endpoint_path] = { score: 0.5, total_runs: 0, verified_passes: 0 };
    }

    const entry = store[endpoint_path];
    entry.total_runs += 1;
    if (passed) {
      entry.verified_passes += 1;
    }

    entry.score = entry.total_runs > 0 ? entry.verified_passes / entry.total_runs : 0.5;

    // Write back synchronously to prevent race conditions in this MVP
    fs.writeFileSync(reputationFilePath, JSON.stringify(store, null, 2), 'utf-8');
    console.log(`Updated reputation for ${endpoint_path}: score=${entry.score}, total_runs=${entry.total_runs}`);
  } catch (error) {
    console.error('Error updating reputation file:', error);
  }
}
