import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import axios from "axios";
import { SearcherClient, searcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import { logger } from "../../utils/logger";
import { floatToLamports, sleep, truncateAddress } from "../../utils/helpers";
import { blockEngineUrl, connection, jito_auth_keypair } from "./config";
import { VersionedTransaction } from "@solana/web3.js";
import { averageJitoTip } from "./average-tip";

async function getBundleStatuses(bundleId: string) {
  const response = await axios.post("https://mainnet.block-engine.jito.wtf/api/v1/bundles", {
    jsonrpc: "2.0",
    id: 1,
    method: "getBundleStatuses",
    params: [[bundleId]],
  });

  return response.data.result.value;
}

export async function dispatchJitoBundle({ transactions, tipAmountOverrideFloat, signerKeypair }: { transactions: VersionedTransaction[]; tipAmountOverrideFloat?: number; signerKeypair: Keypair }) {
  logger.info(`[jito::bundler] Using ${blockEngineUrl} as the block engine URL.`);

  let landedTransactionSignature = null;

  const bundle = new Bundle([], 3);
  bundle.addTransactions(...transactions);

  const search = searcherClient(blockEngineUrl, jito_auth_keypair);
  const tipAccounts = await search.getTipAccounts();
  const tipAccount = new PublicKey(tipAccounts[Math.floor(Math.random() * tipAccounts.length)]);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");

  let tipAmountLamports = floatToLamports(tipAmountOverrideFloat ? tipAmountOverrideFloat : averageJitoTip);

  // Add 15% tip to the bundle

  tipAmountLamports = Math.floor(tipAmountLamports * 1.2);

  bundle.addTipTx(signerKeypair, tipAmountLamports, tipAccount, latestBlockhash.blockhash);

  try {
    const bundleId = await search.sendBundle(bundle);
    logger.info(`[jito::bundler] Dispatched Bundle ID: ${bundleId} with tip amount: ${tipAmountLamports / LAMPORTS_PER_SOL} SOL`);

    let tries = 0;
    const maxTries = 30;
    let success = false;
    let landedSlot;

    logger.info(`[jito::bundler] Waiting for bundle to land...`);

    while (tries < maxTries && !success) {
      const result = await getBundleStatuses(bundleId);
      await sleep(1000);
      success = result?.[0]?.confirmation_status === "confirmed";

      logger.info(`[jito::bundler] Bundle ${truncateAddress(bundleId)} is not landed yet...`);
      tries += 1;
    }

    if (success) {
      const result = await getBundleStatuses(bundleId);
      landedSlot = result?.[0]?.slot;
      landedTransactionSignature = result?.[0]?.transactions[0];
      logger.info(`[jito::bundler] ================ 🚀 BUNDLE LANDED 🚀 ================`);
      logger.info(`[jito::bundler] Bundle ID: ${bundleId}`);
      logger.info(`[jito::bundler] Landed TX Signature: ${landedTransactionSignature}`);
      logger.info(`[jito::bundler] Landed Slot: ${landedSlot}`);
      logger.info(`[jito::bundler] Landed successful ✅`);
      logger.info(`[jito::bundler] =====================================================`);
    } else {
      logger.error(`[jito::bundler] Bundle ${bundleId} was not landed successfully after ${maxTries} tries.`);
    }
  } catch (e: any) {
    logger.error(`[jito::bundler] Error sending bundle: ${e.message}`);
    return null;
  }

  return { landedTransactionSignature };
}
