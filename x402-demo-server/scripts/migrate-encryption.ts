/**
 * PRISM Encryption Migration CLI Tool
 *
 * Usage:
 *   npx tsx scripts/migrate-encryption.ts --dry-run
 *   npx tsx scripts/migrate-encryption.ts --execute
 *   npx tsx scripts/migrate-encryption.ts --rotate --new-key <64-char-hex>
 *
 * Safety:
 * - In dry-run mode, inspects database and prints summary without writing.
 * - In execute mode, pre-verifies every encrypted field by decrypting and checking equality.
 * - Does NOT print or log document content.
 * - Resumable and idempotent.
 */

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import { migrateLegacyTasks, rotateTaskEncryptionKey } from '../services/migration';
import { getEncryptionKey } from '../services/encryption';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isExecute = args.includes('--execute');
  const isRotate = args.includes('--rotate');
  const newKeyIdx = args.indexOf('--new-key');
  const newKeyHex = newKeyIdx !== -1 ? args[newKeyIdx + 1] : null;

  if (!isDryRun && !isExecute && !isRotate) {
    console.log(`
PRISM Document Encryption Migration & Key Rotation CLI
───────────────────────────────────────────────────────
Commands:
  --dry-run                 Inspect all Task records and report plaintext vs encrypted counts without modifying data.
  --execute                 Encrypt all legacy plaintext document files in-place with AES-256-GCM.
  --rotate --new-key <hex>  Re-encrypt all existing encrypted records with a new 256-bit key.

Safety Features:
  • Pre-write verification (decrypts & compares before writing to DB)
  • Idempotent (skips already encrypted records)
  • Zero content logging (no document text is ever printed)
    `);
    process.exit(0);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('✅ Connected to MongoDB.\n');

  try {
    // Validate current active key
    const activeKey = getEncryptionKey();
    console.log(`Active Encryption Key: ${activeKey.length * 8}-bit AES key verified.`);

    if (isRotate) {
      if (!newKeyHex || newKeyHex.length !== 64) {
        console.error('❌ --rotate requires --new-key <64-character-hex-string>');
        process.exit(1);
      }
      console.log('Starting key rotation...');
      const stats = await rotateTaskEncryptionKey(newKeyHex, { dryRun: isDryRun });
      console.log('\nKey Rotation Summary:');
      console.table(stats);
    } else {
      console.log(`Starting document encryption migration [mode: ${isDryRun ? 'DRY-RUN' : 'EXECUTE'}]...`);
      const stats = await migrateLegacyTasks({
        dryRun: isDryRun,
        batchSize: 50,
        onProgress: (p) => {
          console.log(`  Processed ${p.totalTasksScanned} tasks (${p.filesEncrypted} files encrypted)...`);
        },
      });

      console.log('\nMigration Complete. Final Statistics:');
      console.log('────────────────────────────────────────');
      console.log(`  Mode:                    ${stats.dryRun ? 'DRY RUN (No writes)' : 'LIVE EXECUTION'}`);
      console.log(`  Tasks Scanned:           ${stats.totalTasksScanned}`);
      console.log(`  Tasks with Files:        ${stats.tasksWithFiles}`);
      console.log(`  Tasks Needing Migration: ${stats.tasksNeedingMigration}`);
      console.log(`  Tasks Migrated:          ${stats.tasksMigrated}`);
      console.log(`  Files Inspected:         ${stats.filesInspected}`);
      console.log(`  Files Encrypted:         ${stats.filesEncrypted}`);
      console.log(`  Files Already Encrypted: ${stats.filesAlreadyEncrypted}`);
      console.log(`  Verification Failures:   ${stats.verificationFailures}`);
      console.log(`  Errors:                  ${stats.errors}`);
      console.log(`  Elapsed Time:            ${stats.durationMs}ms`);
      console.log('────────────────────────────────────────');

      if (stats.verificationFailures > 0) {
        console.error(`❌ WARNING: ${stats.verificationFailures} verification failures detected!`);
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
