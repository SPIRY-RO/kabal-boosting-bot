import { Context } from "telegraf";
import { getOrCreateUser } from "./helpers/user";
import { getAccountBalance } from "./utils/helpers";
import { PublicKey } from "@solana/web3.js";
import moment from "moment";
import { prisma } from ".";

const axios = require("axios");
const fs = require("fs");

export function getTimeDifference(date: Date): { hours: number; minutes: number } {
  const now = new Date();
  const diffInMilliseconds = now.getTime() - date.getTime();

  // Take the absolute value of the difference in milliseconds to avoid negative values
  const diffInMinutes = Math.floor(Math.abs(diffInMilliseconds) / (1000 * 60));
  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;

  return {
    hours: hours,
    minutes: minutes,
  };
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export let mainMenuInlineKeyboard = [
  [
    {
      text: "> Buy Rent Time",
      callback_data: "rent",
    },
  ],
  [
    {
      text: "=== BOOSTERS ===",
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
      // withdraw
      text: "Withdraw",
      callback_data: "wizard-withdraw-master",
    },
    {
      text: "Referrals",
      callback_data: "referrals",
    },
    {
      text: "Support",
      url: "https://t.me/spirybtc",
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

export async function sendStartMenu(ctx: Context) {
  const userId = ctx.from?.id.toString();
  if (!userId) {
    return "Error getting user id";
  }
  const user = await getOrCreateUser(userId);
  const balance = await getAccountBalance(new PublicKey(user.masterWalletAddress));
  const rentExpiryAt = user.rentExpiresAt;
  const now = new Date();

  const isExpired = rentExpiryAt && now > rentExpiryAt;
  let remainingRentTimeHoursString = "Expired";
  if (!isExpired && rentExpiryAt) {
    const timeDifference = getTimeDifference(rentExpiryAt);
    remainingRentTimeHoursString = `${timeDifference.hours} hours ${timeDifference.minutes} minutes`;
  }

  // remaining rent time string should be of format X hours Y minutesß

  const message = `
Solana Volume Bot
Powered by <b>KabalTools</b>

Wallet: 
<code>${user?.masterWalletAddress || "Not set"}</code>
Balance: <b>${balance.toFixed(4)} SOL</b> 
Remaining rent time: ${isExpired ? "Expired" : `${remainingRentTimeHoursString}`}

👇 Click the buttons to get started 👇`;

  ctx.reply(message, {
    // @ts-ignore
    disable_web_page_preview: true,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: mainMenuInlineKeyboard,
    },
  });
}
