import { Context } from "telegraf";
import { prisma } from "..";
import { getAccountBalance, keypairFromPrivateKey, sendAllSolana } from "../utils/helpers";
import { PublicKey } from "@solana/web3.js";

export async function withdrawSlaveToMasterAction(ctx: Context, boosterId: string) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();

    const booster = await prisma.volumeBooster.findUnique({
      where: {
        id: boosterId,
      },
    });

    const boosterOwner = await prisma.user.findFirst({
      where: {
        telegramId: senderId,
      },
    });

    if (!booster || !boosterOwner) {
      return ctx.reply("Booster not found.");
    }

    if (booster.ownerId !== boosterOwner.telegramId) {
      return ctx.reply("You are not the owner of this booster.");
    }

    const slaveBalance = await getAccountBalance(new PublicKey(booster.slaveWalletAddress));

    if (slaveBalance === 0) {
      return ctx.reply("The slave wallet is empty.");
    }

    // Withdraw the balance from the slave wallet to the master wallet
    await ctx.reply(`Withdrawing ${slaveBalance} SOL from the slave wallet to the master wallet...`);

    await sendAllSolana({
      fromKeypair: keypairFromPrivateKey(booster.slaveWalletPK),
      to: new PublicKey(boosterOwner.masterWalletAddress),
    });

    await ctx.reply("Withdrawal successful.");
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
