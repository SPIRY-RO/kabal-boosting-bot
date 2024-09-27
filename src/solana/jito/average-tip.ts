import axios from "axios";
import { logger } from "../../utils/logger";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { sleep } from "../../utils/helpers";

type JitoBundle = {
  bundleId: string;
  timestamp: string;
  tippers: string[];
  transactions: string[];
  landedTipLamports: number;
};

export let averageJitoTip = 0;

function calculateAverageTip(data: JitoBundle[]) {
  if (!Array.isArray(data) || data.length === 0) {
    return 0;
  }

  const totalTip = data.reduce((sum, item) => sum + item.landedTipLamports, 0);
  return totalTip / data.length;
}

async function getAverageJitoTip() {
  try {
    const response = await axios({
      method: "get",
      url: "https://explorer.jito.wtf/wtfrest/api/v1/bundles/recent",
      params: {
        limit: 200,
        sort: "Time",
        asc: false,
        timeframe: "Week",
      },
    });

    const data = response.data;

    let averageTip = calculateAverageTip(data);

    averageTip /= LAMPORTS_PER_SOL;

    // Round to the nearest 5 decimals
    averageTip = Math.round(averageTip * 100000) / 100000;

    logger.info(`[jito::average_tip] Average tip: ${averageTip} SOL`);

    return averageTip;
  } catch (error) {
    logger.error(`[jito::average_tip] Error: ${error}`);
    return averageJitoTip;
  }
}

export async function initJitoAverageTipLoop() {
  while (true) {
    averageJitoTip = await getAverageJitoTip();
    await sleep(1000 * 60 * 1);
  }
}
