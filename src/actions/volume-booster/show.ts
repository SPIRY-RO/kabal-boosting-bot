import { Context } from "telegraf";
import { getOrCreateUser } from "../../helpers/user";
import { prisma } from "../..";
import { solanaUsdPrice } from "../../utils/price-feeds";
import { getTokenDetails } from "../../token-info/get";
import { getAccountBalance, truncateAddress } from "../../utils/helpers";
import { PublicKey } from "@solana/web3.js";

export async function showVolumeBoostersAction(ctx: Context) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();
    const user = await getOrCreateUser(senderId);
    const boosters = await prisma.volumeBooster.findMany({
      where: {
        ownerId: user.telegramId,
      },
    });

    // Loop through all boosters and if auto stop is in the future and the booster is stopped, clear it

    let boostersString = `🔊 <b>Volume boosters</b>\n\n`;

    let inlineKeyboard = [];

    for (let booster of boosters) {
      const totalVolumeSol = booster.totalBuysSol + booster.totalSellsSol;
      const totalVolumeUsd = solanaUsdPrice * totalVolumeSol;

      const slaveBalance = await getAccountBalance(new PublicKey(booster.slaveWalletAddress));

      boostersString += `<b>${booster.tokenName} (${booster.tokenSymbol})</b>
Slave: ${truncateAddress(booster.slaveWalletAddress)} | Balance: ${slaveBalance} SOL
BUY VOL :${booster.totalBuysSol.toFixed(2)} SOL | SELL VOL: ${booster.totalSellsSol.toFixed(2)} SOL
VOL: ${totalVolumeSol} ~ $${totalVolumeUsd.toFixed(2)}\n`;

      inlineKeyboard.push([
        {
          text: `🔊 ${booster.tokenName}`,
          callback_data: `data-volume_booster-${booster.id}-view`,
        },
      ]);
    }

    if (boosters.length === 0) {
      boostersString += "You don't have any volume boosters yet. You can create one by clicking the button below.";
    }

    inlineKeyboard.push([
      {
        text: "Create volume booster",
        callback_data: "wizard-create-volume-booster",
      },
      {
        text: "🔙 Main menu",
        callback_data: "main_menu",
      },
    ]);

    return ctx.reply(boostersString, {
      // @ts-ignore
      disable_web_page_preview: true,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
