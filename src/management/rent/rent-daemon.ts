import { PublicKey } from "@solana/web3.js";
import { prisma, telegraf } from "../..";
import { sleep } from "../../helpers";
import { getAccountBalance, keypairFromPrivateKey, sendSolana } from "../../utils/helpers";
import { logger } from "../../utils/logger";
import { RENT_TIMES_ARRAY } from "../../constants";
import { Keypair } from "@solana/web3.js";
import { config } from "../../config";

export async function initRentDaemon() {
  while (true) {
    await rentDaemonStep();
    await sleep(2000);
  }
}

export async function rentDaemonStep() {
  // logger.info(`Checking all work wallets for rent payments...`);
  const users = await prisma.user.findMany();

  // Create an array of promises for processing each user
  const rentCheckPromises = users.map(async (user) => {
    const balance = await getAccountBalance(new PublicKey(user.masterWalletAddress));
    let hasEnoughMoneyForRent = false;
    let selectedTier = null;

    // Check the rent times array by the highest rent time first
    for (let rentTime of RENT_TIMES_ARRAY) {
      const requiredAmount = rentTime.priceSolana;

      if (balance >= requiredAmount) {
        // User has enough money to pay for this tier
        hasEnoughMoneyForRent = true;
        selectedTier = rentTime;
      } else {
        continue;
      }
    }

    if (!hasEnoughMoneyForRent) {
      // logger.info(`User ${user.telegramId} does not have enough money to pay for any rent time. Skipping...`);
      return;
    }

    if (selectedTier) {
      logger.info(`User ${user.telegramId} has enough money to pay for at least one rent time. Have: ${balance}, Need: ${selectedTier.priceSolana}. Auto matched Tier: ${selectedTier.label}.`);

      // Send Solana for rent payment
      await sendSolana({
        fromKeypair: keypairFromPrivateKey(user.masterWalletPK),
        to: new PublicKey(config.REVENUE_WALLET),
        amountFloat: selectedTier.priceSolana,
      });

      const timeHours = selectedTier.timeSeconds / 3600;
      const previousRentExpiresAt = user.rentExpiresAt || new Date();

      // Update rent expiration time
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          rentExpiresAt: new Date(previousRentExpiresAt.getTime() + selectedTier.timeSeconds * 1000),
        },
      });

      // Notify user
      const message = `Your rent has been prolonged with ${timeHours} hours. Enjoy!`;
      await telegraf.telegram.sendMessage(user.telegramId, message);
    }
  });

  // Wait for all promises to resolve
  await Promise.all(rentCheckPromises);
}

export async function payHighestRentFromUserWallet() {
  // logger.info(`Checking all work wallets for rent payments...`);
  const users = await prisma.user.findMany();

  // Create an array of promises for processing each user
  const rentCheckPromises = users.map(async (user) => {
    const balance = await getAccountBalance(new PublicKey(user.masterWalletAddress));
    let hasEnoughMoneyForRent = false;
    let selectedTier = null;

    // Check the rent times array by the highest rent time first
    for (let rentTime of RENT_TIMES_ARRAY) {
      const requiredAmount = rentTime.priceSolana;

      if (balance >= requiredAmount) {
        // User has enough money to pay for this tier
        hasEnoughMoneyForRent = true;
        selectedTier = rentTime;
      } else {
        continue;
      }
    }

    if (!hasEnoughMoneyForRent) {
      // logger.info(`User ${user.telegramId} does not have enough money to pay for any rent time. Skipping...`);
      return;
    }

    if (selectedTier) {
      logger.info(`User ${user.telegramId} has enough money to pay for at least one rent time. Have: ${balance}, Need: ${selectedTier.priceSolana}. Auto matched Tier: ${selectedTier.label}.`);

      // Send Solana for rent payment
      await sendSolana({
        fromKeypair: keypairFromPrivateKey(user.masterWalletPK),
        to: new PublicKey(config.REVENUE_WALLET),
        amountFloat: selectedTier.priceSolana,
      });

      const timeHours = selectedTier.timeSeconds / 3600;
      const previousRentExpiresAt = user.rentExpiresAt || new Date();

      // Update rent expiration time
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          rentExpiresAt: new Date(previousRentExpiresAt.getTime() + selectedTier.timeSeconds * 1000),
        },
      });

      // Notify user
      const message = `Your rent has been prolonged with ${timeHours} hours. Enjoy!`;
      await telegraf.telegram.sendMessage(user.telegramId, message);
    }
  });

  // Wait for all promises to resolve
  await Promise.all(rentCheckPromises);
}
