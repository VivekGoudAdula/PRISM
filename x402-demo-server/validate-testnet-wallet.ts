/**
 * PRISM — Testnet Wallet Validator
 *
 * Verifies that the configured Testnet AVM_ADDRESS:
 *   1. Exists on Algorand Testnet
 *   2. Has Testnet ALGO balance > 0 (for transaction fees)
 *   3. Is opted into Testnet USDC ASA 10458941
 *   4. Can receive Testnet USDC
 *
 * Usage:
 *   npx ts-node validate-testnet-wallet.ts [address]
 *   npx ts-node validate-testnet-wallet.ts          # uses AVM_ADDRESS from .env
 *
 * DO NOT run this with a Mainnet address on Testnet — it checks a different ledger.
 */

import { config } from 'dotenv';
config();

const TESTNET_ALGOD_URL = 'https://testnet-api.algonode.cloud';
const TESTNET_USDC_ASA_ID = 10458941;

/**
 * Fetches Algorand Testnet account info via the public AlgoNode API.
 */
async function fetchAccountInfo(address: string): Promise<any> {
  const url = `${TESTNET_ALGOD_URL}/v2/accounts/${address}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status === 404) {
    return null; // Account not found / never funded
  }

  if (!response.ok) {
    throw new Error(`Algod API error: HTTP ${response.status} — ${await response.text()}`);
  }

  return await response.json();
}

/**
 * Validates the Testnet payTo address and prints a clear status report.
 */
async function validateTestnetWallet(address: string): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('PRISM — TESTNET WALLET VALIDATOR');
  console.log('═'.repeat(60));
  console.log(`Address:       ${address}`);
  console.log(`Network:       Algorand Testnet`);
  console.log(`Algod:         ${TESTNET_ALGOD_URL}`);
  console.log(`USDC ASA ID:   ${TESTNET_USDC_ASA_ID}`);
  console.log('═'.repeat(60));

  // ── Check 1: Account exists ────────────────────────────────────────────────
  console.log('\n[1/4] Checking account existence...');
  const accountInfo = await fetchAccountInfo(address);

  if (!accountInfo) {
    console.error('  ❌ FAIL — Account not found on Algorand Testnet.');
    console.error('     The address has never been funded. Use the Testnet Dispenser:');
    console.error('     https://bank.testnet.algorand.network/');
    process.exit(1);
  }
  console.log('  ✅ PASS — Account exists on Testnet.');

  // ── Check 2: ALGO balance ──────────────────────────────────────────────────
  console.log('\n[2/4] Checking ALGO balance (needed for transaction fees)...');
  const algoBalance = accountInfo.amount ?? 0;
  const algoBalanceAlgos = algoBalance / 1e6;

  if (algoBalance === 0) {
    console.error(`  ❌ FAIL — Zero ALGO balance. Account needs ALGO for fees.`);
    console.error('     Fund via: https://bank.testnet.algorand.network/');
    process.exit(1);
  }

  const MIN_ALGO_MICROALGOS = 200_000; // 0.2 ALGO minimum
  if (algoBalance < MIN_ALGO_MICROALGOS) {
    console.warn(`  ⚠️  WARN — Low ALGO balance: ${algoBalanceAlgos.toFixed(4)} ALGO.`);
    console.warn('     Consider adding more Testnet ALGO for sustained fee coverage.');
  } else {
    console.log(`  ✅ PASS — ALGO balance: ${algoBalanceAlgos.toFixed(4)} ALGO`);
  }

  // ── Check 3: Opted into Testnet USDC ASA ──────────────────────────────────
  console.log(`\n[3/4] Checking opt-in to Testnet USDC (ASA ${TESTNET_USDC_ASA_ID})...`);
  const assets: any[] = accountInfo.assets ?? [];
  const usdcAsset = assets.find((a: any) => a['asset-id'] === TESTNET_USDC_ASA_ID);

  if (!usdcAsset) {
    console.error(`  ❌ FAIL — Account is NOT opted into Testnet USDC (ASA ${TESTNET_USDC_ASA_ID}).`);
    console.error('     The account cannot receive Testnet USDC payments.');
    console.error('     To opt in, send a 0-amount ASA transfer to yourself using a Testnet wallet.');
    console.error('     Use Pera Wallet or Lute Wallet on Testnet, or the AlgoKit CLI:');
    console.error(`     algokit utils asset opt-in --asset ${TESTNET_USDC_ASA_ID} --network testnet`);
    process.exit(1);
  }

  const usdcBalance = usdcAsset.amount ?? 0;
  const usdcBalanceFormatted = (usdcBalance / 1e6).toFixed(4);
  console.log(`  ✅ PASS — Opted into Testnet USDC. Balance: ${usdcBalanceFormatted} USDC`);

  // ── Check 4: Can receive USDC (summary) ───────────────────────────────────
  console.log('\n[4/4] Validating receive capability...');
  if (usdcAsset && algoBalance >= MIN_ALGO_MICROALGOS) {
    console.log('  ✅ PASS — Account can receive Testnet USDC payments.');
  } else {
    console.warn('  ⚠️  WARN — Account may have issues receiving payments (see above warnings).');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('TESTNET WALLET VALIDATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Address:         ${address.slice(0, 8)}...${address.slice(-4)}`);
  console.log(`ALGO Balance:    ${algoBalanceAlgos.toFixed(4)} ALGO`);
  console.log(`USDC Opted In:   YES (ASA ${TESTNET_USDC_ASA_ID})`);
  console.log(`USDC Balance:    ${usdcBalanceFormatted} USDC`);
  console.log(`Status:          ✅ READY FOR TESTNET PAYMENTS`);
  console.log('═'.repeat(60) + '\n');
}

// ── Entry point ────────────────────────────────────────────────────────────────

const addressArg = process.argv[2] || process.env.AVM_ADDRESS;

if (!addressArg) {
  console.error('❌ No address provided.');
  console.error('   Usage: npx ts-node validate-testnet-wallet.ts <TESTNET_ADDRESS>');
  console.error('   Or:    set AVM_ADDRESS in .env and run without arguments.');
  process.exit(1);
}

if (!/^[A-Z2-7]{58}$/.test(addressArg)) {
  console.error(`❌ Invalid Algorand address format: ${addressArg}`);
  console.error('   Algorand addresses are 58 characters, uppercase, base32.');
  process.exit(1);
}

validateTestnetWallet(addressArg).catch((err) => {
  console.error('❌ Validation failed with error:', err.message);
  process.exit(1);
});
