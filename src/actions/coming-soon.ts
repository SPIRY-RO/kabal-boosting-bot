import { Context } from "telegraf";

export async function comingSoonAction(ctx: Context) {
  try {
    return ctx.reply("This feature is coming soon. Stay tuned!");
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
