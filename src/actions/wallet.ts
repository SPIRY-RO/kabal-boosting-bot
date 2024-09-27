import { Context } from "telegraf";

export async function walletAction(ctx: Context) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();

    await ctx.reply("Wallet feature is not available yet.");
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
