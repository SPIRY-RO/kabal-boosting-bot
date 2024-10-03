import { log } from "console";
import { logger } from "../utils/logger";
import { changeBoosterStatus } from "../management/boosters/volume-booster";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { prisma } from "..";
import { floatToLamports, getAccountBalance, getAccountBalanceLamports, keypairFromPrivateKey, sendAllSolana, sendSolana, truncateAddress } from "../utils/helpers";
import { connection } from "../solana/jito/config";
import base58 from "bs58";
import { createBuyTransaction, createSellTransaction, getSwapQuote } from "../solana/jupiter-helpers";
import { WSOL } from "../constants";
import { dispatchJitoBundle } from "../solana/jito/bundler";
import { sleep } from "../helpers";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export class VolumeBooster {
  public boosterId: string;
  public tokenAddress: string = "";
  public puppetKeypairs: Keypair[] = [];
  public puppetWorkerIds: string[] = [];
  public isInitialized = false;
  public shouldContinueBoosting = true;

  constructor(boosterId: string) {
    logger.info(`[${boosterId}] Creating volume booster instance...`);
    this.boosterId = boosterId;
  }

  async sellAllAndCloseTokenAta(keypair: Keypair, remainingTokensRaw: string) {
    const sellTx = await createSellTransaction({
      tokenAddress: this.tokenAddress,
      tokenAmountRaw: Number(remainingTokensRaw),
      slippage: 1,
      keypair: keypair,
    });

    if (!sellTx) {
      logger.error(`[${this.boosterId}] Error creating sell transaction.`);
      return;
    }

    logger.info(`[${this.boosterId}] Dispatching jito bundle to sell remaining tokens...`);
    const result = await dispatchJitoBundle({
      transactions: [sellTx.tx],
      signerKeypair: keypair,
    });

    const landedTransactionSignature = result?.landedTransactionSignature;

    if (!landedTransactionSignature) {
      logger.error(`[${this.boosterId}] Error selling remaining tokens.`);
      return false;
    }

    logger.info(`[${this.boosterId}] Remaining tokens sold successfully.`);

    // Close the token ATA
  }

  async createPuppetsIfNotExists() {
    // Check the working wallet private keys
    let booster = await prisma.volumeBooster.findUnique({
      where: {
        id: this.boosterId,
      },
    });

    if (!booster) {
      throw new Error("Booster not found.");
    }

    this.tokenAddress = booster.tokenAddress;

    const requiredPuppets = booster.puppetWalletCount;
    const existingPuppets = booster.puppetWalletPKs;

    if (existingPuppets.length < requiredPuppets) {
      logger.error(`[${this.boosterId}] Not enough puppets for the booster. Required: ${requiredPuppets}, Existing: ${existingPuppets.length}`);
      logger.error(`[${this.boosterId}] Creating puppets...`);
    }

    const missingPuppets = requiredPuppets - existingPuppets.length;

    for (let i = 0; i < missingPuppets; i++) {
      const keypair = Keypair.generate();
      logger.info(`[${this.boosterId}] Created puppet ${truncateAddress(keypair.publicKey.toBase58())}`);
      await prisma.volumeBooster.update({
        where: {
          id: this.boosterId,
        },
        data: {
          puppetWalletPKs: {
            push: base58.encode(keypair.secretKey),
          },
        },
      });
    }

    logger.info(`[${this.boosterId}] All puppets are ready. Performing sanity checks...`);

    // Update the booster object with the new DB item
    booster = await prisma.volumeBooster.findFirstOrThrow({
      where: {
        id: this.boosterId,
      },
    });

    const puppetPks = booster.puppetWalletPKs;

    const activePuppetCount = booster.puppetWalletCount;

    for (let i = 0; i < activePuppetCount; i++) {
      const keypair = keypairFromPrivateKey(puppetPks[i]);
      const balance = await getAccountBalance(keypair.publicKey);
      this.puppetKeypairs.push(keypair);
      logger.info(`[${this.boosterId}] Registered puppet ${truncateAddress(keypair.publicKey.toBase58())} | Balance: ${balance} SOL`);
    }
  }

  async initClass() {
    if (this.isInitialized) {
      return;
    }
    logger.info(`[${this.boosterId}] Initializing volume booster...`);

    await this.createPuppetsIfNotExists();

    this.isInitialized = true;
  }

  async cleanup() {
    await this.initClass();
    logger.info(`[${this.boosterId}] Cleaning up volume booster...`);
    await this.drainPuppets();
    // TODO: implement  this
    // await this.removeExcessPuppets();
  }

  async removeExcessPuppets() {
    // Check if all the puppets have empty balances
    await this.drainPuppets();

    const booster = await prisma.volumeBooster.findFirstOrThrow({
      where: {
        id: this.boosterId,
      },
    });

    let hasUnemptyPuppets = false;

    // Check that all the puppets have been drained
    const puppetPks = booster.puppetWalletPKs;
    for (let pk of puppetPks) {
      const keypair = keypairFromPrivateKey(pk);
      const balance = await getAccountBalance(keypair.publicKey);
      if (balance > 0) {
        logger.error(`[${this.boosterId}] Puppet ${truncateAddress(keypair.publicKey.toBase58())} has a non-zero balance. Attempting to drain...`);
        await this.drainPuppet(keypair, booster.slaveWalletAddress);

        // Check if the puppet has been drained

        const puppetBalance = await getAccountBalance(keypair.publicKey);
        if (puppetBalance > 0) {
          logger.error(`[${this.boosterId}] Puppet ${truncateAddress(keypair.publicKey.toBase58())} still has a non-zero balance. Skipping...`);

          hasUnemptyPuppets = true;
          return;
        }

        return;
      }
    }

    // Add all the current puppets to the list of puppets to be removed
    for (let pk of puppetPks) {
      const keypair = keypairFromPrivateKey(pk);
      await prisma.removedWallet.create({
        data: {
          walletPK: base58.encode(keypair.secretKey),
          walletAddress: keypair.publicKey.toBase58(),
        },
      });
    }

    // If all puppets have been drained, remove all puppets, as new ones will be created on the next run
    if (!hasUnemptyPuppets) {
      // Remove the excess puppets, starting from

      await prisma.volumeBooster.update({
        where: {
          id: this.boosterId,
        },
        data: {
          puppetWalletPKs: {
            set: [],
          },
        },
      });

      logger.info(`[${this.boosterId}] All puppets have been drained and removed.`);
      await this.createPuppetsIfNotExists();
    }
  }

  async drainPuppets() {
    await this.initClass();
    const booster = await prisma.volumeBooster.findFirstOrThrow({
      where: {
        id: this.boosterId,
      },
    });

    const user = await prisma.user.findFirstOrThrow({
      where: {
        telegramId: booster.ownerId,
      },
    });

    logger.info(`[${this.boosterId}] Requested puppet draining...`);
    logger.info(`[${this.boosterId}] Booster owner TGID: ${user.telegramId} | Working wallet: ${user.masterWalletAddress}`);
    for (let keypair of this.puppetKeypairs) {
      await this.drainPuppet(keypair, booster.slaveWalletAddress);
    }
    logger.info(`[${this.boosterId}] All puppets drained successfully.`);
    logger.info(`[${this.boosterId}] Booster cleanup complete.`);

    await changeBoosterStatus(this.boosterId, "stopped");
  }

  async drainPuppet(keypair: Keypair, destination: string) {
    // Check if there are some left-over tokens in the puppet wallet

    try {
      const tokenAta = getAssociatedTokenAddressSync(new PublicKey(this.tokenAddress), keypair.publicKey);
      const tokenBalance = await connection.getTokenAccountBalance(tokenAta);
      const tokenBalanceRaw = tokenBalance.value.amount;

      if (tokenBalanceRaw !== "0") {
        logger.info(`[${this.boosterId}] Detected left-over tokens in the puppet ${truncateAddress(keypair.publicKey.toBase58())}. Selling all and closing accounts...`);
        const success = await this.sellAllAndCloseTokenAta(keypair, tokenBalanceRaw);
        if (!success) {
          logger.error(`[${this.boosterId}] Error selling left-over tokens in the puppet ${truncateAddress(keypair.publicKey.toBase58())}. Will attempt selling next time the booster is started.`);

          return;
        }
      }
    } catch (e) {
      logger.error(`[${this.boosterId}] Error selling left-over tokens in the puppet ${truncateAddress(keypair.publicKey.toBase58())}.`);
    }

    logger.info(`[${this.boosterId}] Draining puppet ${truncateAddress(keypair.publicKey.toBase58())} to the ${truncateAddress(destination)}`);
    const puppetBalanceLamports = await getAccountBalanceLamports(keypair.publicKey);
    const puppetBalance = puppetBalanceLamports / LAMPORTS_PER_SOL;

    const minPuppetBalanceForCleanupLamports = 5000;

    if (puppetBalanceLamports < minPuppetBalanceForCleanupLamports) {
      logger.info(`[${this.boosterId}] Puppet ${truncateAddress(keypair.publicKey.toBase58())} has insufficient balance (${puppetBalanceLamports}) to drain. Skipping...`);
      return;
    } else {
      logger.info(`[${this.boosterId}] Puppet ${truncateAddress(keypair.publicKey.toBase58())} has enough balance (${puppetBalanceLamports}) to drain.`);
      const result = await sendAllSolana({
        fromKeypair: keypair,
        to: new PublicKey(destination),
      });

      if (!result) {
        logger.error(`[${this.boosterId}] Error draining puppet ${truncateAddress(keypair.publicKey.toBase58())}.`);
        await changeBoosterStatus(this.boosterId, "error");
      }

      logger.info(`[${this.boosterId}] Drained puppet ${truncateAddress(keypair.publicKey.toBase58())} to the ${truncateAddress(destination)} | Amount: ${puppetBalance} SOL`);
    }

    logger.info(`[${this.boosterId}] Puppet ${truncateAddress(keypair.publicKey.toBase58())} drained successfully.`);

    // Determine if the puppet has enough balance to drain ( > 5000 lamports)
  }

  async fillPuppets() {
    logger.info(`[${this.boosterId}] Filling puppets...`);

    const booster = await prisma.volumeBooster.findFirstOrThrow({
      where: {
        id: this.boosterId,
      },
    });

    const boosterOwner = await prisma.user.findFirstOrThrow({
      where: {
        telegramId: booster.ownerId,
      },
    });

    const slaveWalletKeypair = keypairFromPrivateKey(booster.slaveWalletPK);
    const fuelAmount = booster.fuelAmountFloat;

    const slaveWalletBalance = await getAccountBalance(slaveWalletKeypair.publicKey);
    if (slaveWalletBalance < fuelAmount) {
      logger.error(`[${this.boosterId}] Not enough balance in the slave wallet to fill puppets. Required: ${fuelAmount}, Available: ${slaveWalletBalance}`);
      return;
    } else {
      logger.info(`[${this.boosterId}] slave wallet balance: ${slaveWalletBalance} SOL | Required: ${fuelAmount} SOL | Checks passed.`);
    }

    const amountPerPuppet = fuelAmount / this.puppetKeypairs.length;

    for (let keypair of this.puppetKeypairs) {
      logger.info(`[${this.boosterId}] Filling puppet ${truncateAddress(keypair.publicKey.toBase58())} with ${amountPerPuppet} SOL...`);
      await sendSolana({
        fromKeypair: slaveWalletKeypair,
        to: keypair.publicKey,
        amountFloat: amountPerPuppet,
      });
      logger.info(`[${this.boosterId}] Puppet ${truncateAddress(keypair.publicKey.toBase58())} filled successfully.`);
      this.startPuppetWorker(keypair);
    }

    logger.info(`[${this.boosterId}] All puppets filled successfully.`);
    await changeBoosterStatus(this.boosterId, "running");
  }

  async startPuppetWorker(puppetKeypair: Keypair) {
    // Generate a random worker ID
    const workerId = Math.random().toString(36).substring(7);
    this.puppetWorkerIds.push(workerId);
    logger.info(`[${this.boosterId}](${workerId}) Starting puppet worker...`);

    let cutoffTimeExpired = false;

    while (this.shouldContinueBoosting && !cutoffTimeExpired) {
      // Get the TX delay time
      const booster = await prisma.volumeBooster.findFirstOrThrow({
        where: {
          id: this.boosterId,
        },
      });

      const cutoffEnabled = booster.autoStopAfter !== null;
      if (cutoffEnabled) {
        const now = new Date();
        const cutoffTime = booster?.autoStopAfter as Date;
        cutoffTimeExpired = now > cutoffTime;
      } else {
        cutoffTimeExpired = false;
      }

      await this.doPuppetWork(puppetKeypair, workerId);
      await sleep(booster.txDelaySeconds * 1000);
    }

    // Change status to stopping
    await changeBoosterStatus(this.boosterId, "stopping");

    logger.info(`[${this.boosterId}](${workerId}) Puppet worker stopped.`);

    // Remove the worker ID from the list
    const workerIndex = this.puppetWorkerIds.indexOf(workerId);
    if (workerIndex > -1) {
      this.puppetWorkerIds.splice(workerIndex, 1);
    }

    // Check if all workers are stopped
    if (this.puppetWorkerIds.length === 0) {
      logger.info(`[${this.boosterId}] All puppet workers stopped. Stopping booster...`);
      await this.cleanup();
    }
  }

  async doPuppetWork(puppetKeypair: Keypair, workerId: string) {
    const puppetCurrentBalance = await getAccountBalance(puppetKeypair.publicKey);
    logger.info(`[${this.boosterId}](${workerId}) Puppet balance: ${puppetCurrentBalance} SOL`);
    // Buy with 90% of the balance
    const buyAmount = puppetCurrentBalance * 0.9;

    // Generate a buy transaction
    const buyTxRequest = await createBuyTransaction({
      tokenAddress: this.tokenAddress,
      amountSol: buyAmount,
      slippage: 1,
      keypair: puppetKeypair,
    });

    const buyTx = buyTxRequest?.tx;
    const minAmountReceived = buyTxRequest?.quoteResponse?.otherAmountThreshold;

    logger.info(`[${this.boosterId}](${workerId}) Getting quote for Buy amount: ${buyAmount} SOL | Min tokens received: ${minAmountReceived}`);

    // Generate a sell transaction with the min received tokens
    const sellTxRequest = await createSellTransaction({
      tokenAddress: this.tokenAddress,
      tokenAmountRaw: minAmountReceived,
      slippage: 1,
      keypair: puppetKeypair,
    });

    const sellTx = sellTxRequest?.tx;
    const minSolReceived = sellTxRequest?.quoteResponse?.otherAmountThreshold;

    if (!buyTx || !sellTx) {
      logger.error(`[${this.boosterId}](${workerId}) Error creating buy or sell transaction.`);
      return;
    }

    logger.info(`[${this.boosterId}](${workerId}) Dispatching jito bundle...`);

    // Send the buy transaction
    await dispatchJitoBundle({
      transactions: [buyTx, sellTx],
      signerKeypair: puppetKeypair,
    });

    const minSolReceivedFloat = minSolReceived / LAMPORTS_PER_SOL;
    logger.info(`[${this.boosterId}](${workerId}) Sell minimum received: ${minSolReceivedFloat} SOL`);

    // Increase the total buys and sells
    await prisma.volumeBooster.update({
      where: {
        id: this.boosterId,
      },
      data: {
        totalBuysSol: {
          increment: buyAmount,
        },
        totalSellsSol: {
          increment: minSolReceivedFloat,
        },
      },
    });

    logger.info(`[${this.boosterId}](${workerId}) Jito bundle dispatched and confirmed.`);
  }

  async stop() {
    await this.initClass();
    this.shouldContinueBoosting = false;
  }

  async start() {
    await this.initClass();
    await this.cleanup();
    await changeBoosterStatus(this.boosterId, "starting");
    await this.fillPuppets();
  }
}
