import { Context } from "telegraf";
import { getOrCreateUser } from "../../helpers/user";
import { RENT_TIMES_ARRAY } from "../../constants";
import { floatToLamports, getAccountBalance, keypairFromPrivateKey, lamportsToFloat, sendSolana, sendSolanaBatchInSingleTransaction } from "../../utils/helpers";
import { PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import { config } from "../../config";
import { prisma, telegraf } from "../..";
import { sendStartMenu } from "../../helpers";

export async function buyRentAction(ctx: Context, rentTimeSeconds: number) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();
    const user = await getOrCreateUser(senderId);

    const rentTimePackage = RENT_TIMES_ARRAY.find((r) => r.timeSeconds === rentTimeSeconds);

    if (!rentTimePackage) {
      await ctx.reply("Invalid rent time package.");
      return;
    }

    const currentBalance = await getAccountBalance(new PublicKey(user.masterWalletAddress));

    const hasEnoughBalance = currentBalance >= rentTimePackage.priceSolana;

    if (!hasEnoughBalance) {
      return await ctx.reply("You don't have enough balance to buy this rent time package.");
    }

    const message = await ctx.reply(
      `🕐 Buying <b>${rentTimePackage.label}</b> worth of rent time for ${rentTimePackage.priceSolana} SOL...
<i>Transaction can take up to 1 minute. Please wait...</i>`,
      {
        parse_mode: "HTML",
      }
    );

    const isReferred = user.referredByUserId;
    let referrerUsername = "";
    if (isReferred) {
      let referrerUser = await prisma.user.findFirstOrThrow({
        where: {
          id: isReferred,
        },
      });

      // @ts-ignore
      referrerUsername = (await telegraf.telegram.getChat(referrerUser.telegramId)).username;

      const referralFee = rentTimePackage.priceSolana * config.REFERRAL_FEE_PERCENT;
      const topUpAmount = rentTimePackage.priceSolana - referralFee - lamportsToFloat(5000);

      await sendSolanaBatchInSingleTransaction({
        fromKeypair: keypairFromPrivateKey(user.masterWalletPK),
        transactions: [
          {
            to: new PublicKey(config.REVENUE_WALLET),
            amountFloat: topUpAmount,
          },
          {
            to: new PublicKey(referrerUser.masterWalletAddress),
            amountFloat: referralFee,
          },
        ],
      });

      // Send the referee user a notification about the referral
      await telegraf.telegram.sendMessage(referrerUser.telegramId, `🎉 You have received a referral fee of ${referralFee} SOL from @${((await telegraf.telegram.getChat(senderId)) as any).username} for their rent time purchase.`);

      // AD the referral fee to the referrer's total earnings
      await prisma.user.update({
        where: {
          id: referrerUser.id,
        },
        data: {
          referralTotalEarningsSol: {
            increment: referralFee,
          },
        },
      });
    } else {
      // Standard top-up, no referral

      await sendSolana({
        fromKeypair: keypairFromPrivateKey(user.masterWalletPK),
        to: new PublicKey(config.REVENUE_WALLET),
        amountFloat: rentTimePackage.priceSolana,
      });
    }

    // Perform the rent time purchase here

    const currentExpiryTime = user.rentExpiresAt || new Date();
    const newExpiryTime = new Date(currentExpiryTime.getTime() + rentTimePackage.timeSeconds * 1000);

    // Update the user rent expiry time
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        rentExpiresAt: newExpiryTime,
      },
    });

    const telegramUser = await ctx.telegram.getChat(senderId);
    // @ts-ignoree
    const telegramUsername = telegramUser.username;

    // Announce this in the admin chat
    await ctx.telegram.sendMessage(
      config.ANNOUNCEMENT_CHANNEL_ID,
      `🕐 User @${telegramUsername} has bought ${rentTimePackage.label} worth of rent time for ${rentTimePackage.priceSolana} SOL.
Referred by: ${isReferred ? `@${referrerUsername}` : "None"}`
    );

    // Edit the message to show the success
    await ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, `✅ Rent time package: ${rentTimePackage.label} bought successfully!`);

    return sendStartMenu(ctx);
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
