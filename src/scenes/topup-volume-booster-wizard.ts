import { Scenes, Markup } from "telegraf";
import { getDexscreenerTokenInfo } from "../api/dexscreener";
import { prisma } from "..";
import { showVolumeBoosterDetailsAction } from "../actions/volume-booster/details";
import { getAccountBalance, keypairFromPrivateKey, sendSolana } from "../utils/helpers";
import { PublicKey } from "@solana/web3.js";
import { logger } from "../utils/logger";

const stepOne = async (ctx: any) => {
  try {
    const boosterId = ctx.wizard.state.boosterId;
    const booster = await prisma.volumeBooster.findUnique({
      where: {
        id: boosterId,
      },
    });

    if (!booster) {
      await ctx.reply("Booster not found.");
      return ctx.scene.leave();
    }

    const boosterOwner = await prisma.user.findFirstOrThrow({
      where: {
        telegramId: booster.ownerId,
      },
    });

    const masterWalletBalance = await getAccountBalance(new PublicKey(boosterOwner.masterWalletAddress));

    // Save this in state
    ctx.wizard.state.availableBalance = masterWalletBalance;
    ctx.wizard.state.boosterOwner = boosterOwner;

    await ctx.reply(`Enter the top up amonut in SOL for ${booster.tokenName} (${booster.tokenSymbol}).
Available balance: ${masterWalletBalance} SOL
---------
Please enter the amount in SOL.`);
    return ctx.wizard.next();
  } catch (error) {
    console.error("Error in Step 1:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

const stepTwo = async (ctx: any) => {
  try {
    const topUpAmount = parseFloat(ctx.message.text);

    if (isNaN(topUpAmount)) {
      await ctx.reply("Invalid input. Please enter a valid number.");
      return;
    }

    // Check if the top up amount is higher than the available balance
    if (topUpAmount > ctx.wizard.state.availableBalance) {
      await ctx.reply("You don't have enough balance to top up this amount.");
      return;
    }

    const boosterId = ctx.wizard.state.boosterId;

    const booster = await prisma.volumeBooster.findUnique({
      where: {
        id: boosterId,
      },
    });

    if (!booster) {
      await ctx.reply("Booster not found.");
      return ctx.scene.leave();
    }

    const boosterOwner = await prisma.user.findFirstOrThrow({
      where: {
        telegramId: booster.ownerId,
      },
    });

    // Top up from the master wallet

    logger.info(`Topping up volume booster ${boosterId} with ${topUpAmount} SOL from ${ctx.wizard.state.boosterOwner.masterWalletAddress}`);

    const message = await ctx.reply(`Topping up volume booster. Please wait...`);

    await sendSolana({
      fromKeypair: keypairFromPrivateKey(boosterOwner.masterWalletPK),
      to: new PublicKey(booster.slaveWalletAddress),
      amountFloat: topUpAmount,
    });

    await ctx.reply(`Volume booster topped up successfully. New balance: ${topUpAmount} SOL`);

    ctx.scene.leave();

    return showVolumeBoosterDetailsAction(ctx, boosterId);
  } catch (error) {
    console.error("Error in Step 2:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

// Define the WizardScene using the step functions
export const wizardTopUpVolumeBooster = new Scenes.WizardScene("wizard-top-up-volume-booster", stepOne, stepTwo);
