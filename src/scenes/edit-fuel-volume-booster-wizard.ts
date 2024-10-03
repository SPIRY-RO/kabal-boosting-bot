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
Current fuel amount: ${booster.fuelAmountFloat} SOL.

Please enter a number of SOL to use to generate volume.`);
    return ctx.wizard.next();
  } catch (error) {
    console.error("Error in Step 1:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

const stepTwo = async (ctx: any) => {
  try {
    const fuel = parseFloat(ctx.message.text);

    if (isNaN(fuel)) {
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
        fuelAmountFloat: fuel,
      },
    });

    await ctx.reply(`Volume booster for ${booster.tokenName} (${booster.tokenSymbol}) updated successfully. Fuel amount set to ${fuel} SOL.`);

    await ctx.scene.leave();

    return showVolumeBoosterDetailsAction(ctx, boosterId);
  } catch (error) {
    console.error("Error in Step 2:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

// Define the WizardScene using the step functions
export const wizardEditFuelVolumeBooster = new Scenes.WizardScene("wizard-edit-fuel-volume-booster", stepOne, stepTwo);
