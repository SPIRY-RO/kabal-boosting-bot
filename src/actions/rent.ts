import { Context } from "telegraf";
import { getOrCreateUser } from "../helpers/user";
import { RENT_TIMES_ARRAY } from "../constants";

export async function rentAction(ctx: Context) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();
    const user = await getOrCreateUser(senderId);

    let message = `🤖 *Rent the bot*`;

    let inlineKeyboard = [];

    for (const rentTime of RENT_TIMES_ARRAY) {
      message += `
🕒 *${rentTime.label}*
💰 *${rentTime.priceSolana} SOL*
`;

      inlineKeyboard.push([
        {
          text: `Rent for ${rentTime.label}`,
          callback_data: `rent-${rentTime.timeSeconds}`,
        },
      ]);
    }

    message += `\n\nSimply send the amount you wish to rent the bot for to the following address: \`${user.masterWalletAddress}\``;
    message += `On confiramtion, the bot will be rented to you for the specified time.`;

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔙 Main menu",
              callback_data: "main_menu",
            },
          ],
        ],
      },
    });
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
