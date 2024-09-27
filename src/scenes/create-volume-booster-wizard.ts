import { Scenes, Markup } from "telegraf";
import { getDexscreenerTokenInfo } from "../api/dexscreener";
import { prisma } from "..";
import { Keypair } from "@solana/web3.js";
import base58 from "bs58";

// Step 1: Ask for the title
const stepOne = async (ctx: any) => {
  try {
    await ctx.reply("What is the token address?");
    return ctx.wizard.next();
  } catch (error) {
    console.error("Error in Step 1:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

// Step 2: Ask for the content
const stepTwo = async (ctx: any) => {
  try {
    // Set the title in the state
    ctx.wizard.state.tokenAddress = ctx.message.text;

    const dexscreenerTokenInfo = await getDexscreenerTokenInfo(ctx.wizard.state.tokenAddress);

    if (!dexscreenerTokenInfo) {
      await ctx.reply("Invalid token address. Please try again.");
      return ctx.scene.leave();
    }

    await ctx.reply(`Detected token: ${dexscreenerTokenInfo.tokenName} (${dexscreenerTokenInfo.tokenSymbol})`);

    // Save the token info in the state
    ctx.wizard.state.tokenName = dexscreenerTokenInfo.tokenName;
    ctx.wizard.state.tokenSymbol = dexscreenerTokenInfo.tokenSymbol;
    ctx.wizard.state.tokenAddress = ctx.message.text;

    // Confirm YES or NO with inline keyboard
    await ctx.reply("Is this the correct token?", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes",
              callback_data: "yes",
            },
            {
              text: "No",
              callback_data: "no",
            },
          ],
        ],
      },
    });

    // Token is valid
    return ctx.wizard.next();
  } catch (error) {
    console.error("Error in Step 2:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

const stepThree = async (ctx: any) => {
  try {
    const btnPress = ctx.callbackQuery?.data;

    if (btnPress === "no") {
      await ctx.reply("Please enter the correct token address.");
      return ctx.scene.reenter();
    }

    if (btnPress === "yes") {
      // Create the volume booster in the database
      const tokenAddress = ctx.wizard.state.tokenAddress;
      const tokenName = ctx.wizard.state.tokenName;
      const tokenSymbol = ctx.wizard.state.tokenSymbol;

      const slaveKeypair = Keypair.generate();

      await prisma.volumeBooster.create({
        data: {
          ownerId: ctx.from.id.toString(),
          tokenAddress,
          tokenName,
          tokenSymbol,
          slaveWalletAddress: slaveKeypair.publicKey.toString(),
          slaveWalletPK: base58.encode(slaveKeypair.secretKey),
        },
      });

      const inlineKeyboard = [
        [
          // boosters
          {
            text: "My boosters",
            callback_data: "volume_boosters",
          },
        ],
        [
          {
            text: "🔙 Main menu",
            callback_data: "main_menu",
          },
        ],
      ];

      await ctx.reply("Volume booster created successfully!", {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    }

    return ctx.scene.leave();
  } catch (error) {
    console.error("Error in Step 3:", error);
    await ctx.reply("An error occurred. Please try again later.");
    return ctx.scene.leave();
  }
};

// Define the WizardScene using the step functions
export const wizardCreateVolumeBooster = new Scenes.WizardScene("wizard-create-volume-booster", stepOne, stepTwo, stepThree);
