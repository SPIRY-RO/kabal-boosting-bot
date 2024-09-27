import { Telegraf, Markup, Scenes, session } from "telegraf";

import { config } from "./config";
import { downloadFileFromURL, generateStartMenu, getUserMembershipLevel } from "./helpers";
import { PrismaClient } from "@prisma/client";
import { wizardBasicInput } from "./scenes/basic-input-wizard";
import { walletAction } from "./actions/wallet";
import { defaultCommand } from "./commands/default";
import { rentAction } from "./actions/rent";
import { initRentDaemon } from "./management/rent/rent-daemon";
import { comingSoonAction } from "./actions/coming-soon";
import { showVolumeBoostersAction } from "./actions/volume-booster/show";
import { wizardCreateVolumeBooster } from "./scenes/create-volume-booster-wizard";
import { showVolumeBoosterDetailsAction } from "./actions/volume-booster/details";
import { wizardEditSpeedVolumeBooster } from "./scenes/edit-speed-volume-booster-wizard";
import { changeBoosterStatus, initVolumeBoosterManagerDaemon } from "./management/boosters/volume-booster";
import { initJitoAverageTipLoop } from "./solana/jito/average-tip";
import { initAllPriceFeeds } from "./utils/price-feeds";
import { wizardTopUpVolumeBooster } from "./scenes/topup-volume-booster-wizard";
import { withdrawSlaveToMasterAction } from "./actions/withdraw";
import { wizardEditCutoffVolumeBooster } from "./scenes/edit-cutoff-volume-booster-wizard";

export const prisma = new PrismaClient();
export const telegraf = new Telegraf(config.TG_BOT_TOKEN);

const stage = new Scenes.Stage([wizardCreateVolumeBooster, wizardEditSpeedVolumeBooster, wizardTopUpVolumeBooster, wizardEditCutoffVolumeBooster]);

// initRentDaemon();

initJitoAverageTipLoop();
initAllPriceFeeds();
initVolumeBoosterManagerDaemon();

telegraf.start(async (ctx) => {
  ctx.reply(await generateStartMenu(ctx), {
    // @ts-ignore
    disable_web_page_preview: true,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
});

export let inlineKeyboard = [
  [
    {
      text: "Rent the bot",
      callback_data: "rent",
    },
  ],
  [
    {
      text: "=== MY BOOSTERS ===",
      callback_data: "none",
    },
  ],
  [
    {
      text: "Volume",
      callback_data: "volume_boosters",
    },
    {
      text: "Holder ",
      callback_data: "holder_boosters",
    },
    {
      text: "Rank ",
      callback_data: "rank_boosters",
    },
  ],

  [
    {
      text: "🔙 Main menu",
      callback_data: "main_menu",
    },
  ],

  // [Markup.button.callback("▶️ Main menu", "main_menu")],
];

telegraf.use(session());
telegraf.use(stage.middleware());
// Actions

// telegraf.action("twitter_settings", async (ctx) => {
//   twitterSettingsAction(ctx);
// });

telegraf.command("default", async (ctx) => {
  return defaultCommand(ctx);
});

telegraf.action("wizard-create-volume-booster", async (ctx: any) => {
  ctx.scene.enter("wizard-create-volume-booster", {
    sender: ctx.callbackQuery.from.id,
    state: "test",
  });
});

telegraf.action("rent", async (ctx: any) => {
  return rentAction(ctx);
});
telegraf.action("volume_boosters", async (ctx: any) => {
  return showVolumeBoostersAction(ctx);
});
telegraf.action("holder_boosters", async (ctx: any) => {
  return comingSoonAction(ctx);
});
telegraf.action("rank_boosters", async (ctx: any) => {
  return comingSoonAction(ctx);
});

telegraf.action(/\bdata(-\w+)+\b/g, (ctx: any) => {
  const string = ctx.match[0];
  const args = string.split("-");
  const actionName = args[1];
  const sender = ctx.callbackQuery.from.id;
  if (actionName === "volume_booster") {
    const boosterId = args[2];
    const boosterAction = args[3];

    if (boosterAction === "view") {
      return showVolumeBoosterDetailsAction(ctx, boosterId);
    }
    if (boosterAction === "withdraw") {
      return withdrawSlaveToMasterAction(ctx, boosterId);
    }
    if (boosterAction === "editspeed") {
      return ctx.scene.enter("wizard-edit-speed-volume-booster", {
        boosterId,
      });
    }
    if (boosterAction === "editcutoff") {
      return ctx.scene.enter("wizard-edit-cutoff-volume-booster", {
        boosterId,
      });
    }
    if (boosterAction === "topup") {
      return ctx.scene.enter("wizard-top-up-volume-booster", {
        boosterId,
      });
    }
    if (boosterAction === "start") {
      changeBoosterStatus(boosterId, "start_requested");
    }

    if (boosterAction === "stop") {
      changeBoosterStatus(boosterId, "stop_requested");
    }

    // showVolumeBoosterDetails(ctx, boosterId)
    // postManagerAction(ctx, postId, action);
  }

  console.log(`Action name: ${actionName}`);

  return ctx.answerCbQuery(`Param: ${ctx.match[1]}! 👍`);
});

telegraf.help(async (ctx: any) => {
  ctx.reply(await generateStartMenu(ctx), {
    disable_web_page_preview: true,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
});

telegraf.action("main_menu", async (ctx) => {
  const sender = ctx.callbackQuery.from.id;
  const rank = await getUserMembershipLevel(sender.toString());

  ctx.reply(await generateStartMenu(ctx), {
    // @ts-ignore
    disable_web_page_preview: true,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
});

process.once("SIGINT", () => telegraf.stop("SIGINT"));
process.once("SIGTERM", () => telegraf.stop("SIGTERM"));

telegraf.launch();
