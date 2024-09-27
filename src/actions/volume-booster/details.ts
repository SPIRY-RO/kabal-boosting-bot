import { Context } from "telegraf";
import { getOrCreateUser } from "../../helpers/user";
import { prisma } from "../..";
import { solanaUsdPrice } from "../../utils/price-feeds";
import { getTokenDetails } from "../../token-info/get";
import { getAccountBalance, keypairFromPrivateKey, truncateAddress } from "../../utils/helpers";
import { PublicKey } from "@solana/web3.js";
import moment from "moment";

export async function showVolumeBoosterDetailsAction(ctx: Context, boosterId: string) {
  try {
    // @ts-ignore
    const senderId = ctx.update?.callback_query?.message?.chat.id?.toString();
    const user = await getOrCreateUser(senderId);

    const booster = await prisma.volumeBooster.findUnique({
      where: {
        id: boosterId,
      },
    });

    if (!booster) {
      return ctx.reply("Booster not found.");
    }

    const autoStopEnabled = booster.autoStopAfter !== null;

    const slaveBalance = await getAccountBalance(new PublicKey(booster.slaveWalletAddress));

    const puppets = booster.puppetWalletPKs;

    let puppetMsg = `Puppets (${puppets.length}):`;

    for (let i = 0; i < puppets.length; i++) {
      const puppet = puppets[i];
      const keypair = keypairFromPrivateKey(puppet);
      const balance = await getAccountBalance(keypair.publicKey);
      puppetMsg += `\n ${i + 1}. ${truncateAddress(keypair.publicKey.toBase58())} - ${balance} SOL`;
    }

    const message = ` Volume Booster Details
ID: ${booster.id}
Token: ${booster.tokenName} (${booster.tokenSymbol})
Address: ${truncateAddress(booster.tokenAddress)}
Slave: ${truncateAddress(booster.slaveWalletAddress)} | Balance: ${slaveBalance.toFixed(3)} SOL

Total buys: ${booster.totalBuysSol.toFixed(3)} SOL
Total sells: ${booster.totalSellsSol.toFixed(3)} SOL
Total volume: ${(booster.totalBuysSol + booster.totalSellsSol).toFixed(3)} SOL
Total volume USD: $${(solanaUsdPrice * (booster.totalBuysSol + booster.totalSellsSol)).toFixed(2)}

${puppetMsg}

${autoStopEnabled ? `Auto stops after: ${booster.autoStopAfter?.toUTCString().replace("GMT", "UTC")} (${moment(booster.autoStopAfter).fromNow()})` : ""}

TX speed: ${booster.txDelaySeconds} seconds
Status: ${booster.status}
`;

    let actionButton;

    if (booster.status === "stopping") {
      actionButton = {
        text: "Stopping...",
        callback_data: "none",
      };
    } else if (booster.status === "starting") {
      actionButton = {
        text: "Starting...",
        callback_data: "none",
      };
    } else if (booster.status === "stopped") {
      actionButton = {
        text: "Start",
        callback_data: `data-volume_booster-${booster.id}-start`,
      };
    } else if (booster.status === "running") {
      actionButton = {
        text: "Stop",
        callback_data: `data-volume_booster-${booster.id}-stop`,
      };
    } else {
      actionButton = {
        text: "Unknown status",
        callback_data: "none",
      };
    }

    const inlineKeyboard = [
      [
        {
          text: "Top up",
          callback_data: `data-volume_booster-${booster.id}-topup`,
        },
        {
          text: "Withdraw",
          callback_data: `data-volume_booster-${booster.id}-withdraw`,
        },
      ],
      [
        actionButton,
        {
          text: "Refresh",
          callback_data: `data-volume_booster-${booster.id}-view`,
        },
      ],

      [
        {
          text: "Edit TX speed",
          callback_data: `data-volume_booster-${booster.id}-editspeed`,
        },
        {
          text: "Edit cut-off time",
          callback_data: `data-volume_booster-${booster.id}-editcutoff`,
        },
      ],
      [
        {
          text: "🔙 Back",
          callback_data: "volume_boosters",
        },
      ],
    ];

    return ctx.reply(message, {
      // @ts-ignore
      disable_web_page_preview: true,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (e: any) {
    console.error(e);
    await ctx.reply("An error occurred. Please try again later.");
  }
}
