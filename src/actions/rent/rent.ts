import { Context } from "telegraf";
import { getOrCreateUser } from "../../helpers/user";
import { RENT_TIMES_ARRAY } from "../../constants";
import { getAccountBalance } from "../../utils/helpers";
import { PublicKey } from "@solana/web3.js";
import { getTimeDifference } from "../../helpers";

export async function rentAction(ctx: Context) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();
    const user = await getOrCreateUser(senderId);
    const rentExpiryDate = user.rentExpiresAt;
    const now = new Date();

    const currentBalance = await getAccountBalance(new PublicKey(user.masterWalletAddress));

    // Determine the hours the user has from now to expiryRate
    let remainingRentString = "0 hours 0 minutes";
    if (rentExpiryDate) {
      remainingRentString = `${getTimeDifference(rentExpiryDate).hours} hours ${getTimeDifference(rentExpiryDate).minutes} minutes`;
    }

    let message = `🤖 *Rent time packages*
    
You have ${remainingRentString} left on your current rent.

Your deposit address:
\`${user.masterWalletAddress}\`
Current balance: *${currentBalance.toFixed(3)} SOL*

*Available rent time packages:*`;

    let inlineKeyboard = [];

    for (let i = 0; i < RENT_TIMES_ARRAY.length; i += 2) {
      let buttonRow = [];

      // First button
      buttonRow.push({
        text: `${RENT_TIMES_ARRAY[i].label} - ${RENT_TIMES_ARRAY[i].priceSolana} SOL`,
        callback_data: `data-buyrent-${RENT_TIMES_ARRAY[i].timeSeconds}`,
      });

      // Second button, if it exists
      if (i + 1 < RENT_TIMES_ARRAY.length) {
        buttonRow.push({
          text: `${RENT_TIMES_ARRAY[i + 1].label} - ${RENT_TIMES_ARRAY[i + 1].priceSolana} SOL`,
          callback_data: `data-buyrent-${RENT_TIMES_ARRAY[i + 1].timeSeconds}`,
        });
      }

      inlineKeyboard.push(buttonRow);
    }

    inlineKeyboard.push([
      {
        text: "🔙 Main menu",
        callback_data: "main_menu",
      },
    ]);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
