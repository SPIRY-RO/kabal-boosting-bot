import { LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { connection } from "../solana/jito/config";
import { Keypair } from "@solana/web3.js";
import { logger } from "./logger";
import base58 from "bs58";

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function percentageDifferent(a: number, b: number): number {
  return ((b - a) / a) * 100;
}

export function floatToLamports(float: number) {
  return Math.floor(float * LAMPORTS_PER_SOL);
}

export function lamportsToFloat(lamports: number) {
  return lamports / LAMPORTS_PER_SOL;
}

// Calculate what a numer represents in percentage of another number
export function percentageOf(total: number, part: number): number {
  return (part / total) * 100;
}

export async function getAccountBalance(account: PublicKey) {
  const balance = await connection.getBalance(account);
  const balanceFloat = balance / LAMPORTS_PER_SOL;
  return balanceFloat;
}

export async function getAccountBalanceLamports(account: PublicKey) {
  const balance = await connection.getBalance(account);
  return balance;
}

export async function sendSolana({ fromKeypair, to, amountFloat }: { fromKeypair: Keypair; to: PublicKey; amountFloat: number }) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: to,
      lamports: floatToLamports(amountFloat),
    })
  );

  const fromAddress = truncateAddress(fromKeypair.publicKey.toBase58());
  const toAddress = truncateAddress(to.toBase58());

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      logger.info(`Attempt ${attempts + 1}: Sending transaction from ${fromAddress} to ${toAddress} with amount ${amountFloat} SOL...`);

      const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
      logger.info("Transaction sent, awaiting confirmation...");

      const confirmation = await connection.getSignatureStatus(signature);

      if (confirmation?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value?.err)}`);
      }

      logger.info(`Transaction from ${fromAddress} to ${toAddress} confirmed successfully!`);
      logger.info(`Transaction Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      attempts += 1;
      logger.error(`Attempt ${attempts}: Error during transaction from ${fromAddress} to ${toAddress}: ${error.message}`);

      if (attempts >= maxAttempts) {
        logger.error(`Maximum attempts reached. Transaction from ${fromAddress} to ${toAddress} failed.`);
        throw new Error("Transaction failed after 10 attempts.");
      }

      // Optionally: Add a small sleep between attempts
      await sleep(1000); // Wait for 1 second before retrying
    }
  }
}

export async function sendSolanaBatchInSingleTransaction({ fromKeypair, transactions }: { fromKeypair: Keypair; transactions: { to: PublicKey; amountFloat: number }[] }) {
  const fromAddress = truncateAddress(fromKeypair.publicKey.toBase58());
  const transaction = new Transaction();

  // Add each transfer instruction to the transaction
  for (const { to, amountFloat } of transactions) {
    const toAddress = truncateAddress(to.toBase58());
    logger.info(`Adding transfer instruction to ${toAddress} for ${amountFloat} SOL...`);

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: to,
        lamports: floatToLamports(amountFloat),
      })
    );
  }

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      logger.info(`Attempt ${attempts + 1}: Sending single transaction with ${transactions.length} instructions...`);

      const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
      logger.info("Transaction sent, awaiting confirmation...");

      const confirmation = await connection.getSignatureStatus(signature);

      if (confirmation?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value?.err)}`);
      }

      logger.info(`Single transaction with ${transactions.length} instructions confirmed successfully!`);
      logger.info(`Transaction Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      attempts += 1;
      logger.error(`Attempt ${attempts}: Error during transaction: ${error.message}`);

      if (attempts >= maxAttempts) {
        logger.error(`Maximum attempts reached. Transaction failed.`);
        throw new Error("Transaction failed after 10 attempts.");
      }

      // Optionally: Add a small sleep between attempts
      await sleep(1000); // Wait for 1 second before retrying
    }
  }
}

export async function sendAllSolana({ fromKeypair, to }: { fromKeypair: Keypair; to: PublicKey }) {
  const balance = await getAccountBalanceLamports(fromKeypair.publicKey);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: to,
      lamports: balance - 5000,
    })
  );

  const fromAddress = truncateAddress(fromKeypair.publicKey.toBase58());
  const toAddress = truncateAddress(to.toBase58());

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      logger.info(`Attempt ${attempts + 1}: Sending transaction from ${fromAddress} to ${toAddress} with amount ${balance} lamports...`);

      const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
      logger.info("Transaction sent, awaiting confirmation...");

      const confirmation = await connection.getSignatureStatus(signature);

      if (confirmation?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value?.err)}`);
      }

      logger.info(`Transaction from ${fromAddress} to ${toAddress} confirmed successfully!`);
      logger.info(`Transaction Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      attempts += 1;
      logger.error(`Attempt ${attempts}: Error during transaction from ${fromAddress} to ${toAddress}: ${error.message}`);

      if (attempts >= maxAttempts) {
        logger.error(`Maximum attempts reached. Transaction from ${fromAddress} to ${toAddress} failed.`);
        return null;
      }

      // Optionally: Add a small sleep between attempts
      await sleep(1000); // Wait for 1 second before retrying
    }
  }
}

export function keypairFromPrivateKey(privateKey: string) {
  return Keypair.fromSecretKey(base58.decode(privateKey));
}
