/**
 * PRISM Data Retention & Lifecycle Management Service
 *
 * Implements configurable retention periods and automated lifecycle pruning
 * for sensitive document contents, temporary execution files, semantic caches,
 * and session tokens in compliance with DPDP Act 2023 and GDPR minimization rules.
 */

import mongoose from 'mongoose';
import { Task } from '../models/Task';
import { SemanticCache } from '../models/SemanticCache';
import { UserSession } from '../models/UserSession';
import { DataMap } from '../models/DataMap';
import { AuditLog } from '../models/AuditLog';

export interface RetentionPolicyConfig {
  /** Retention for raw uploaded document files and extracted text (default: 30 days) */
  documentFilesRetentionDays: number;
  /** Retention for semantic cache entries (default: 60 days) */
  semanticCacheRetentionDays: number;
  /** Retention for user refresh token sessions (default: 30 days) */
  sessionRetentionDays: number;
}

export function getRetentionConfig(): RetentionPolicyConfig {
  return {
    documentFilesRetentionDays: parseInt(process.env.DOCUMENT_RETENTION_DAYS || '30', 10),
    semanticCacheRetentionDays: parseInt(process.env.SEMANTIC_CACHE_RETENTION_DAYS || '60', 10),
    sessionRetentionDays: parseInt(process.env.SESSION_RETENTION_DAYS || '30', 10),
  };
}

export interface PruneResult {
  scrubbedTasksCount: number;
  purgedCacheCount: number;
  expiredSessionsCount: number;
  timestamp: string;
}

export interface RetentionSchedulerStatus {
  active: boolean;
  intervalHours: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: PruneResult | null;
}

let schedulerTimer: NodeJS.Timeout | null = null;
let lastPruneResult: PruneResult | null = null;
let lastRunTimestamp: Date | null = null;
let nextRunTimestamp: Date | null = null;
let currentIntervalHours = 24;

/**
 * Executes a lifecycle retention pass:
 * 1. Scrubs raw file contents from completed/failed tasks older than documentFilesRetentionDays.
 * 2. Purges stale semantic cache entries unused for more than semanticCacheRetentionDays.
 * 3. Deletes expired user sessions.
 *
 * Fully idempotent: Safe to execute repeatedly without duplicating work or corrupting data.
 */
export async function pruneExpiredData(): Promise<PruneResult> {
  const config = getRetentionConfig();
  const now = Date.now();

  const docCutoff = new Date(now - config.documentFilesRetentionDays * 24 * 60 * 60 * 1000);
  const cacheCutoff = new Date(now - config.semanticCacheRetentionDays * 24 * 60 * 60 * 1000);

  let scrubbedTasksCount = 0;
  let purgedCacheCount = 0;
  let expiredSessionsCount = 0;

  try {
    // 1. Scrub document contents from tasks older than retention window
    const scrubResult = await Task.updateMany(
      {
        createdAt: { $lt: docCutoff },
        'plannerOutput.files': { $exists: true, $ne: [] },
      },
      {
        $unset: {
          'plannerOutput.files': '',
          'plannerOutput.extractedFiles': '',
        },
        $set: {
          'plannerOutput.retentionStatus': 'expired_and_scrubbed',
          'plannerOutput.scrubbedAt': new Date(),
        },
      }
    );
    scrubbedTasksCount = scrubResult.modifiedCount || 0;

    // 2. Purge stale semantic cache entries
    const cacheResult = await SemanticCache.deleteMany({
      $or: [
        { lastUsedAt: { $lt: cacheCutoff } },
        { lastUsedAt: { $exists: false }, createdAt: { $lt: cacheCutoff } },
      ],
    });
    purgedCacheCount = cacheResult.deletedCount || 0;

    // 3. Purge expired user sessions
    const sessionResult = await UserSession.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    expiredSessionsCount = sessionResult.deletedCount || 0;

    console.log(
      `[PRISM RETENTION] Retention pass completed: scrubbed ${scrubbedTasksCount} task files, purged ${purgedCacheCount} cache entries, deleted ${expiredSessionsCount} sessions.`
    );
  } catch (err: any) {
    console.error('[PRISM RETENTION] Error running retention pruning:', err.message);
  }

  const result: PruneResult = {
    scrubbedTasksCount,
    purgedCacheCount,
    expiredSessionsCount,
    timestamp: new Date().toISOString(),
  };

  lastPruneResult = result;
  lastRunTimestamp = new Date();
  if (schedulerTimer) {
    nextRunTimestamp = new Date(Date.now() + currentIntervalHours * 60 * 60 * 1000);
  }

  return result;
}

/**
 * Starts the automated recurring retention cleanup scheduler.
 * Runs on a configurable interval (default: 24 hours).
 */
export function startRetentionScheduler(intervalHours: number = 24): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  currentIntervalHours = intervalHours;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  nextRunTimestamp = new Date(Date.now() + intervalMs);

  schedulerTimer = setInterval(async () => {
    console.log('[PRISM RETENTION SCHEDULER] Triggering scheduled lifecycle pruning pass...');
    try {
      await pruneExpiredData();
    } catch (err: any) {
      console.error('[PRISM RETENTION SCHEDULER] Scheduled prune error:', err.message);
    }
  }, intervalMs);

  // Unref timer so it does not block graceful Node.js process termination
  if (schedulerTimer.unref) {
    schedulerTimer.unref();
  }

  console.log(
    `[PRISM RETENTION SCHEDULER] Automated retention scheduler active (running every ${intervalHours}h, next run: ${nextRunTimestamp.toISOString()}).`
  );
}

/**
 * Stops the automated retention cleanup scheduler.
 */
export function stopRetentionScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    nextRunTimestamp = null;
    console.log('[PRISM RETENTION SCHEDULER] Automated retention scheduler stopped.');
  }
}

/**
 * Retrieves the current status and telemetry of the automated retention scheduler.
 */
export function getRetentionSchedulerStatus(): RetentionSchedulerStatus {
  return {
    active: schedulerTimer !== null,
    intervalHours: currentIntervalHours,
    lastRunAt: lastRunTimestamp ? lastRunTimestamp.toISOString() : null,
    nextRunAt: nextRunTimestamp ? nextRunTimestamp.toISOString() : null,
    lastResult: lastPruneResult,
  };
}
