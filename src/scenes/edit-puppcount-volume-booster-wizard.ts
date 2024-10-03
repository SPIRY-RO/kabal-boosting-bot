import { Scenes, Markup } from "telegraf";
import { getDexscreenerTokenInfo } from "../api/dexscreener";
import { prisma } from "..";
import { showVolumeBoosterDetailsAction } from "../actions/volume-booster/details";
import moment from "moment";

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

    await ctx.reply(`Currently editing volume booster for ${booster.tokenName} (${booster.tokenSymbol})
Current puppet wallet count: ${booster.puppetWalletCount}

Please enter a number of puppet wallets to use.`);
    return ctx.wizard.next();
  } catch (error) {
    console.error("Error in Step 1:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

const stepTwo = async (ctx: any) => {
  try {
    const puppetCount = parseInt(ctx.message.text);

    if (isNaN(puppetCount)) {
      await ctx.reply("Invalid input. Please enter a valid number.");
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

    await prisma.volumeBooster.update({
      where: {
        id: boosterId,
      },
      data: {
        puppetWalletCount: puppetCount,
      },
    });

    await ctx.reply(`Volume booster for ${booster.tokenName} (${booster.tokenSymbol}) updated successfully. Puppet wallet count set to ${puppetCount}.`);

    await ctx.scene.leave();

    return showVolumeBoosterDetailsAction(ctx, boosterId);
  } catch (error) {
    console.error("Error in Step 2:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

// Define the WizardScene using the step functions
export const wizardEditPuppetCountVolumeBooster = new Scenes.WizardScene("wizard-edit-puppetcount-volume-booster", stepOne, stepTwo);
