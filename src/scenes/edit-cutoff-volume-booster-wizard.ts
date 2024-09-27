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

    const cutoffString = `${booster.autoStopAfter?.toUTCString().replace("GMT", "UTC")} (${moment(booster.autoStopAfter).fromNow()})`;

    await ctx.reply(`Currently editing volume booster for ${booster.tokenName} (${booster.tokenSymbol})
Current cut-off time: ${cutoffString}

Please enter a number of hours to set cut-off from now.`);
    return ctx.wizard.next();
  } catch (error) {
    console.error("Error in Step 1:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

const stepTwo = async (ctx: any) => {
  try {
    const hours = parseInt(ctx.message.text);

    if (isNaN(hours)) {
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

    const now = new Date();
    const cutoffDate = moment(now).add(hours, "hours").toDate();

    await prisma.volumeBooster.update({
      where: {
        id: boosterId,
      },
      data: {
        autoStopAfter: cutoffDate,
      },
    });

    await ctx.reply(`Volume booster for ${booster.tokenName} (${booster.tokenSymbol}) updated successfully. Automatic cut-off time set to ${cutoffDate.toUTCString().replace("GMT", "UTC")}. (In ${hours} hours from now)`);

    await ctx.scene.leave();

    return showVolumeBoosterDetailsAction(ctx, boosterId);
  } catch (error) {
    console.error("Error in Step 2:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

// Define the WizardScene using the step functions
export const wizardEditCutoffVolumeBooster = new Scenes.WizardScene("wizard-edit-cutoff-volume-booster", stepOne, stepTwo);
