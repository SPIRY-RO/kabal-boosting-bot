import { Scenes, Markup } from "telegraf";
import { prisma, telegraf } from ".."; // Import your database or data store module here

export const wizardBasicInput = new Scenes.WizardScene(
  "wizard-basic-input",
  async (ctx: any) => {
    try {
      await ctx.reply("What is the title of your post?");
      return ctx.wizard.next();
    } catch (error) {
      console.error("Error in Step 1:", error);
      await ctx.reply("An error occurred. Please try again later.");
      return ctx.scene.leave();
    }
  },
  async (ctx: any) => {
    try {
      // Set the title in the state
      ctx.wizard.state.title = ctx.message.text;
      await ctx.reply("What is the content of your post?", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Cancel",
                callback_data: "test",
              },
            ],
          ],
        },
      });
      return ctx.wizard.next();
    } catch (error) {
      console.error("Error in Step 2:", error);
      await ctx.reply("An error occurred. Please try again later.");
      return ctx.scene.leave();
    }
  },
  async (ctx: any) => {
    try {
      const btnPress = ctx.callbackQuery?.data;
      console.log(btnPress);
      // Set the content in the session
      ctx.wizard.state.text = ctx.message.text;

      const { title, content } = ctx.wizard.state;

      await ctx.reply(`Message title: ${title}
Message content: ${content}`);

      return ctx.scene.leave();
    } catch (error) {
      console.error("Error in Step 3:", error);
      await ctx.reply("An error occurred. Please try again later.");
      return ctx.scene.leave();
    }
  }
);
