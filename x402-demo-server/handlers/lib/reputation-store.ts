import mongoose from 'mongoose';
import { Reputation } from '../../models/AnalyticsData';

export interface ReputationEntry {
  score: number;
  total_runs: number;
  verified_passes: number;
}

export type ReputationStore = Record<string, ReputationEntry>;

const DEFAULT_ENDPOINTS = [
  "/resume-screen-fast",
  "/resume-screen-accurate",
  "/contract-analyze-fast",
  "/contract-analyze-accurate",
  "/invoice-extract-fast",
  "/invoice-extract-accurate",
  "/code-review-fast",
  "/code-review-accurate",
  "/claim-extract-fast",
  "/claim-extract-accurate",
  "/claim-verify-fast",
  "/claim-verify-accurate",
  "/claim-verify",
  "/source-compare-fast",
  "/source-compare-accurate",
  "/source-compare",
  "/news-research-fast",
  "/news-research-accurate",
  "/news-research",
  "/api/news-research"
];

/**
 * Reads the reputation database from MongoDB (async)
 */
export async function readReputationAsync(): Promise<ReputationStore> {
  try {
    if (mongoose.connection.readyState !== 1) {
      return readReputation();
    }
    const docs = await Reputation.find({});
    const store: ReputationStore = {};

    for (const ep of DEFAULT_ENDPOINTS) {
      store[ep] = { score: 0.5, total_runs: 0, verified_passes: 0 };
    }

    for (const doc of docs) {
      store[doc.endpointPath] = {
        score: doc.score,
        total_runs: doc.totalRuns,
        verified_passes: doc.verifiedPasses
      };
    }

    return store;
  } catch (error) {
    console.error('Error reading reputation from MongoDB:', error);
    const fallback: ReputationStore = {};
    for (const ep of DEFAULT_ENDPOINTS) {
      fallback[ep] = { score: 0.5, total_runs: 0, verified_passes: 0 };
    }
    return fallback;
  }
}

/**
 * Synchronous backward-compatibility wrapper (returns default/cached structure)
 */
export function readReputation(): ReputationStore {
  const store: ReputationStore = {};
  for (const ep of DEFAULT_ENDPOINTS) {
    store[ep] = { score: 0.5, total_runs: 0, verified_passes: 0 };
  }
  return store;
}

/**
 * Updates the reputation score of a specific endpoint in MongoDB
 */
export async function updateReputation(endpoint_path: string, passed: boolean): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    let rep = await Reputation.findOne({ endpointPath: endpoint_path });
    if (!rep) {
      rep = new Reputation({
        endpointPath: endpoint_path,
        score: 0.5,
        totalRuns: 0,
        verifiedPasses: 0
      });
    }

    rep.totalRuns += 1;
    if (passed) {
      rep.verifiedPasses += 1;
    }

    rep.score = rep.totalRuns > 0 ? rep.verifiedPasses / rep.totalRuns : 0.5;
    await rep.save();

    console.log(`Updated MongoDB reputation for ${endpoint_path}: score=${rep.score}, totalRuns=${rep.totalRuns}`);
  } catch (error) {
    console.error('Error updating reputation in MongoDB:', error);
  }
}
