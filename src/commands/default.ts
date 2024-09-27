import { Context } from "telegraf";
import { unwrapCommandArguments } from "../helpers";

export async function defaultCommand(ctx: Context) {
  // Get the groupId

  const groupId = ctx.message?.chat.id;

  try {
    // @ts-ignore
    const { text1, text2 } = unwrapCommandArguments(ctx, "default", [
      {
        value: "text1",
        placeholder: "Your name",
      },
      {
        value: "text2",
        placeholder: "Your surname",
      },
    ]);

    console.log(text1, text2);
  } catch (e: any) {
    console.log(e);
    // Catch
  }
}
