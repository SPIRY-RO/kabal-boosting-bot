import { Scenes, Markup } from "telegraf";
import { prisma, telegraf } from ".."; // Import your database or data store module here
import { getOrCreateUser } from "../helpers/user";
import { getAccountBalance, keypairFromPrivateKey, sendAllSolana, sendSolana } from "../utils/helpers";
import { PublicKey } from "@solana/web3.js";
import { sendStartMenu } from "../helpers";

export const wizardWithdrawMaster = new Scenes.WizardScene(
  "wizard-withdraw-master",
  async (ctx: any) => {
    try {
      const user = await getOrCreateUser(ctx.from.id.toString());
      const currentBalance = await getAccountBalance(new PublicKey(user.masterWalletAddress));

      // Save this in state
      ctx.wizard.state.currentBalance = currentBalance;

      await ctx.reply(
        `Your current balance is <b>${currentBalance} SOL</b>
Please enter the amount you want to withdraw or select 'Withdraw all'.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Withdraw all",
                  callback_data: "withdraw_all",
                },
              ],
            ],
          },
        }
      );
      return ctx.wizard.next();
    } catch (error) {
      console.error("Error in Step 1:", error);
      await ctx.reply("An error occurred. Please try again later.");
      return ctx.scene.leave();
    }
  },
  async (ctx: any) => {
    try {
      const messageText = ctx.callbackQuery?.data === "withdraw_all" ? "withdraw_all" : ctx.message.text;

      const currentBalance = ctx.wizard.state.currentBalance;

      if (messageText === "withdraw_all") {
        // Save the entire balance as the withdrawal amount
        ctx.wizard.state.withdrawAmount = currentBalance;
        ctx.wizard.state.withdrawAll = true; // Flag to indicate full withdrawal

        await ctx.reply("Please enter the address you want to withdraw to.");

        return ctx.wizard.next();
      }

      const withdrawAmount = parseFloat(messageText);

      if (isNaN(withdrawAmount)) {
        await ctx.reply("Invalid input. Please enter a valid number.");
        return;
      }

      if (withdrawAmount > currentBalance) {
        await ctx.reply("You don't have enough balance to withdraw this amount.");
        return;
      }

      // Save this in state
      ctx.wizard.state.withdrawAmount = withdrawAmount;
      ctx.wizard.state.withdrawAll = false; // Not a full withdrawal

      await ctx.reply("Please enter the address you want to withdraw to.");

      return ctx.wizard.next();
    } catch (error) {
      console.error("Error in Step 2:", error);
      await ctx.reply("An error occurred. Please try again later.");
      return ctx.scene.leave();
    }
  },
  async (ctx: any) => {
    try {
      const withdrawAddress = ctx.message.text;

      // Save this in state
      ctx.wizard.state.withdrawAddress = withdrawAddress;

      await ctx.reply(
        `You are about to withdraw <b>${ctx.wizard.state.withdrawAmount} SOL</b> to <b>${withdrawAddress}</b>
Please confirm.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Confirm",
                  callback_data: "withdraw_master_confirm",
                },
                {
                  text: "Cancel",
                  callback_data: "withdraw_master_cancel",
                },
              ],
            ],
          },
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      console.error("Error in Step 3:", error);
      await ctx.reply("An error occurred. Please try again later.");
      return ctx.scene.leave();
    }
  },
  async (ctx: any) => {
    try {
      const btnPress = ctx.callbackQuery?.data;

      if (btnPress === "withdraw_master_confirm") {
        // Withdraw
        const user = await getOrCreateUser(ctx.from.id.toString());
        const withdrawAmount = ctx.wizard.state.withdrawAmount;
        const withdrawAddress = ctx.wizard.state.withdrawAddress;

        await ctx.reply(`Withdrawing ${withdrawAmount} SOL to ${withdrawAddress}...`);

        if (ctx.wizard.state.withdrawAll) {
          // Withdraw all balance from the master wallet
          await sendAllSolana({
            fromKeypair: keypairFromPrivateKey(user.masterWalletPK),
            to: new PublicKey(withdrawAddress),
          });
        } else {
          // Withdraw a specific amount
          await sendSolana({
            fromKeypair: keypairFromPrivateKey(user.masterWalletPK),
            to: new PublicKey(withdrawAddress),
            amountFloat: withdrawAmount,
          });
        }

        await ctx.reply("Withdrawal successful.");
      } else {
        await ctx.reply("Withdrawal cancelled.");
      }

      ctx.scene.leave();

      return sendStartMenu(ctx);
    } catch (error) {
      console.error("Error in Step 4:", error);
      await ctx.reply("An error occurred. Please try again later.");
      return ctx.scene.leave();
    }
  }
);
