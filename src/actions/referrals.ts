import { Context } from "telegraf";
import { getOrCreateUser } from "../helpers/user";
import { prisma, telegraf } from "..";

export async function referralsAction(ctx: Context) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();
    const user = await getOrCreateUser(senderId);

    let referredUserCount = 0;

    const botUser = await telegraf.telegram.getMe();
    const botUsername = botUser.username;

    const referredBy = user.referredByUserId;

    let referrerByString = "";

    if (referredBy) {
      const referrerUser = await prisma.user.findFirstOrThrow({
        where: {
          id: referredBy,
        },
      });

      const referrerTelegramUser = await telegraf.telegram.getChat(referrerUser.telegramId);
      // @ts-ignore
      const referrerUsername = referrerTelegramUser.username;
      referrerByString = `Referred by @${referrerUsername}`;
    }

    // Calculate total referred users and total earned from referrals
    const referredUsers = await prisma.user.findMany({
      where: {
        referredByUserId: user.id,
      },
    });

    referredUserCount = referredUsers.length;

    const referralLink = `https://t.me/${botUsername}?start=ref-${user.id}`;

    const message = `🤖 <b>Referral Program</b>
Veniam laborum cupidatat commodo sit enim adipisicing velit exercitation sit ullamco ex. Commodo cillum exercitation officia irure occaecat reprehenderit laborum in aliqua anim elit exercitation culpa sunt.

${referrerByString}
Referred user count: ${referredUserCount} users
Total earned from referrals: ${user.referralTotalEarningsSol.toFixed(5)} SOL

⚠️ Always have at least 0.05 SOL in your master wallet to be able to receive referral rewards.

Your referral link: ${referralLink}

Share this link with your friends and earn rewards!`;

    await ctx.reply(message, {
      parse_mode: "HTML",
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
