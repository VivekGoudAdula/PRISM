/**
 * PRISM Encryption Migration & Key Rotation Service
 *
 * Implements a safe, resumable, idempotent migration tool for encrypting legacy
 * plaintext document payloads in MongoDB (Task plannerOutput.files).
 *
 * Safety Guarantees:
 * 1. Resumable & Idempotent: Only unencrypted fields are processed; already-encrypted fields are skipped.
 * 2. Pre-Write Verification: Every encrypted value is immediately decrypted and verified
 *    to match original plaintext before being saved. If verification fails, no write occurs.
 * 3. Zero Content Logging: Document contents, filenames, and Base64 payloads are NEVER logged.
 * 4. Batched Processing: Uses MongoDB cursor pagination to handle arbitrary scale without memory exhaustion.
 * 5. Dry-Run Mode: Can inspect and report migration requirements without modifying records.
 */

import mongoose from 'mongoose';
import { Task } from '../models/Task';
import {
  encryptDocument,
  decryptDocument,
  isEncrypted,
  getEncryptionKey,
} from './encryption';

export interface MigrationStats {
  totalTasksScanned: number;
  tasksWithFiles: number;
  tasksNeedingMigration: number;
  tasksMigrated: number;
  filesInspected: number;
  filesEncrypted: number;
  filesAlreadyEncrypted: number;
  verificationFailures: number;
  errors: number;
  durationMs: number;
  dryRun: boolean;
}

export interface MigrationOptions {
  /** If true, inspects and logs counts without writing to database */
  dryRun?: boolean;
  /** Number of records to process per batch (default: 50) */
  batchSize?: number;
  /** Optional callback for progress reporting (called after each batch) */
  onProgress?: (stats: MigrationStats) => void;
}

/**
 * Migrates legacy unencrypted document payloads in Task.plannerOutput to AES-256-GCM.
 * Safe to run multiple times; resumes from wherever it left off.
 */
export async function migrateLegacyTasks(options: MigrationOptions = {}): Promise<MigrationStats> {
  const { dryRun = false, batchSize = 50, onProgress } = options;
  const startTime = Date.now();

  const stats: MigrationStats = {
    totalTasksScanned: 0,
    tasksWithFiles: 0,
    tasksNeedingMigration: 0,
    tasksMigrated: 0,
    filesInspected: 0,
    filesEncrypted: 0,
    filesAlreadyEncrypted: 0,
    verificationFailures: 0,
    errors: 0,
    durationMs: 0,
    dryRun,
  };

  // Find all tasks that have plannerOutput.files
  const query = {
    'plannerOutput.files': { $exists: true, $ne: [] },
  };

  const cursor = Task.find(query)
    .select('_id plannerOutput.files')
    .cursor({ batchSize });

  for await (const task of cursor) {
    stats.totalTasksScanned++;
    const files = task.plannerOutput?.files;
    if (!Array.isArray(files) || files.length === 0) continue;

    stats.tasksWithFiles++;
    let taskNeedsUpdate = false;
    const updatedFiles: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      stats.filesInspected++;
      let fileModified = false;
      const updatedFile = { ...file };

      // Fields to inspect and encrypt
      const sensitiveFields = ['content_base64', 'extracted_text', 'text', 'content'];

      for (const field of sensitiveFields) {
        const val = file[field];
        if (typeof val === 'string' && val.trim().length > 0) {
          if (isEncrypted(val)) {
            stats.filesAlreadyEncrypted++;
          } else {
            // Found unencrypted legacy content
            taskNeedsUpdate = true;
            fileModified = true;

            if (!dryRun) {
              try {
                // 1. Encrypt with AES-256-GCM
                const encrypted = encryptDocument(val);

                // 2. Pre-write Verification: decrypt and verify equality
                const roundtrip = decryptDocument(encrypted);
                if (roundtrip !== val) {
                  stats.verificationFailures++;
                  throw new Error(
                    `Pre-write verification failed for task ${task._id}, file index ${i}, field ${field}`
                  );
                }

                updatedFile[field] = encrypted;
                stats.filesEncrypted++;
              } catch (err: any) {
                stats.errors++;
                console.error(
                  `[MIGRATION ERROR] Failed to encrypt/verify field ${field} in task ${task._id}:`,
                  err.message
                );
                // Do not update field if verification failed
              }
            } else {
              stats.filesEncrypted++;
            }
          }
        }
      }

      updatedFiles.push(fileModified && !dryRun ? updatedFile : file);
    }

    if (taskNeedsUpdate) {
      stats.tasksNeedingMigration++;

      if (!dryRun) {
        try {
          await Task.updateOne(
            { _id: task._id },
            { $set: { 'plannerOutput.files': updatedFiles } }
          );
          stats.tasksMigrated++;
        } catch (saveErr: any) {
          stats.errors++;
          console.error(`[MIGRATION ERROR] Failed to save migrated task ${task._id}:`, saveErr.message);
        }
      }
    }

    if (stats.totalTasksScanned % batchSize === 0 && onProgress) {
      stats.durationMs = Date.now() - startTime;
      onProgress(stats);
    }
  }

  stats.durationMs = Date.now() - startTime;
  return stats;
}

/**
 * Key Rotation: Rotates encrypted documents from an old key to a new 256-bit key.
 *
 * Requirements:
 * 1. Both old and new keys must be 32 bytes (64 hex characters or 32 raw bytes).
 * 2. Every re-encrypted record is verified against the old decrypted plaintext before write.
 * 3. Supports dry-run verification.
 */
export async function rotateTaskEncryptionKey(
  newKeyHex: string,
  options: { dryRun?: boolean; batchSize?: number } = {}
): Promise<MigrationStats> {
  const { dryRun = false, batchSize = 50 } = options;
  const startTime = Date.now();

  const currentKey = getEncryptionKey();
  const targetKey = Buffer.from(newKeyHex, 'hex');
  if (targetKey.length !== 32) {
    throw new Error('New key must be 32 bytes (64 hex characters)');
  }

  const stats: MigrationStats = {
    totalTasksScanned: 0,
    tasksWithFiles: 0,
    tasksNeedingMigration: 0,
    tasksMigrated: 0,
    filesInspected: 0,
    filesEncrypted: 0,
    filesAlreadyEncrypted: 0,
    verificationFailures: 0,
    errors: 0,
    durationMs: 0,
    dryRun,
  };

  const cursor = Task.find({ 'plannerOutput.files': { $exists: true, $ne: [] } })
    .select('_id plannerOutput.files')
    .cursor({ batchSize });

  for await (const task of cursor) {
    stats.totalTasksScanned++;
    const files = task.plannerOutput?.files;
    if (!Array.isArray(files) || files.length === 0) continue;

    stats.tasksWithFiles++;
    let taskNeedsUpdate = false;
    const updatedFiles: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      stats.filesInspected++;
      const updatedFile = { ...file };

      for (const field of ['content_base64', 'extracted_text', 'text', 'content']) {
        const val = file[field];
        if (typeof val === 'string' && isEncrypted(val)) {
          taskNeedsUpdate = true;
          if (!dryRun) {
            try {
              // 1. Decrypt using current active key
              const plaintext = decryptDocument(val);

              // 2. Encrypt using new key
              const reEncrypted = encryptDocument(plaintext, targetKey);

              // 3. Verify using new key
              const verified = decryptDocument(reEncrypted, targetKey);
              if (verified !== plaintext) {
                stats.verificationFailures++;
                throw new Error(`Rotation verification failed for task ${task._id}`);
              }

              updatedFile[field] = reEncrypted;
              stats.filesEncrypted++;
            } catch (err: any) {
              stats.errors++;
              console.error(`[ROTATION ERROR] Failed to rotate field in task ${task._id}:`, err.message);
            }
          } else {
            stats.filesEncrypted++;
          }
        }
      }
      updatedFiles.push(updatedFile);
    }

    if (taskNeedsUpdate) {
      stats.tasksNeedingMigration++;
      if (!dryRun) {
        await Task.updateOne(
          { _id: task._id },
          { $set: { 'plannerOutput.files': updatedFiles } }
        );
        stats.tasksMigrated++;
      }
    }
  }

  stats.durationMs = Date.now() - startTime;
  return stats;
}
