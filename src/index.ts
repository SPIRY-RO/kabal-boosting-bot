import { Telegraf, Markup, Scenes, session } from "telegraf";

import { config } from "./config";
import { sendStartMenu } from "./helpers";
import { PrismaClient } from "@prisma/client";
import { wizardBasicInput } from "./scenes/basic-input-wizard";
import { walletAction } from "./actions/wallet";
import { defaultCommand } from "./commands/default";
import { rentAction } from "./actions/rent/rent";
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
import { wizardEditCutoffVolumeBooster } from "./scenes/edit-cutoff-volume-booster-wizard";
import { buyRentAction } from "./actions/rent/buyrent";
import { referralsAction } from "./actions/referrals";
import { getOrCreateUser } from "./helpers/user";
import { withdrawSlaveToMasterAction } from "./actions/volume-booster/withdraw";
import { wizardWithdrawMaster } from "./scenes/withdraw-master-wizard";
import { wizardEditPuppetCountVolumeBooster } from "./scenes/edit-puppcount-volume-booster-wizard";
import { wizardEditFuelVolumeBooster } from "./scenes/edit-fuel-volume-booster-wizard";

export const prisma = new PrismaClient();
export const telegraf = new Telegraf(config.TG_BOT_TOKEN);

const stage = new Scenes.Stage([wizardCreateVolumeBooster, wizardEditSpeedVolumeBooster, wizardTopUpVolumeBooster, wizardEditCutoffVolumeBooster, wizardWithdrawMaster, wizardEditPuppetCountVolumeBooster, wizardEditFuelVolumeBooster]);

// initRentDaemon();

initJitoAverageTipLoop();
initAllPriceFeeds();
initVolumeBoosterManagerDaemon();

telegraf.start(async (ctx) => {
  const hasPayload = ctx.startPayload;

  if (hasPayload) {
    // Payload is of format ref-internalUserId
    const payload = hasPayload.split("-");
    const referrerId = payload[1];

    // Check if the current user is already referred by someone
    const user = await getOrCreateUser(ctx.from.id.toString());

    if (user.referredByUserId) {
      return ctx.reply("You are already referred by someone.");
    } else {
      // Prevent the user from referring themselves
      if (user.id === referrerId) {
        return ctx.reply("You cannot refer yourself.");
      }

      // Update the user's referredByTelegramId field
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          referredByUserId: referrerId,
        },
      });
    }
  }

  await sendStartMenu(ctx);
});

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
telegraf.action("wizard-withdraw-master", async (ctx: any) => {
  ctx.scene.enter("wizard-withdraw-master", {
    sender: ctx.callbackQuery.from.id,
    state: "test",
  });
});

telegraf.action("referrals", async (ctx: any) => {
  return referralsAction(ctx);
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
    if (boosterAction === "editpuppcount") {
      return ctx.scene.enter("wizard-edit-puppetcount-volume-booster", {
        boosterId,
      });
    }
    if (boosterAction === "editfuel") {
      return ctx.scene.enter("wizard-edit-fuel-volume-booster", {
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
  if (actionName === "buyrent") {
    const timeSeconds = args[2];
    console.log(`Buy rent time: ${timeSeconds}`);
    return buyRentAction(ctx, parseInt(timeSeconds));
  }

  console.log(`Action name: ${actionName}`);

  return ctx.answerCbQuery(`Param: ${ctx.match[1]}! 👍`);
});

telegraf.help(async (ctx: any) => {
  await sendStartMenu(ctx);
});

telegraf.action("main_menu", async (ctx) => {
  await sendStartMenu(ctx);
});

process.once("SIGINT", () => telegraf.stop("SIGINT"));
process.once("SIGTERM", () => telegraf.stop("SIGTERM"));

telegraf.launch();
