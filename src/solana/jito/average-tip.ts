import axios from "axios";
import { logger } from "../../utils/logger";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { sleep } from "../../utils/helpers";

// Jito bundle data
type JitoBundle = {
  bundleId: string;
  timestamp: string;
  tippers: string[];
  transactions: string[];
  landedTipLamports: number;
};

// Jito tip floor data
export type TipMetrics = {
  chanceOf25_inSol: number;
  chanceOf50_inSol: number;
  chanceOf75_inSol: number;
  chanceOf95_inSol: number;
  chanceOf99_inSol: number;
  chanceOfOver99_inSol: number,
  average_inSol: number,

  chanceOf25: number;
  chanceOf50: number;
  chanceOf75: number;
  chanceOf95: number;
  chanceOf99: number;
  chanceOfOver99: number;
  average: number,
};

// Jito tip floor data
const TIP_STATS_API_URL = "http://bundles-api-rest.jito.wtf/api/v1/bundles/tip_floor";
const OVER_99_INCREMENT_FACTOR = 1.5;


// Jito tip floor data
export const jitoTip: TipMetrics = {
  chanceOf25_inSol: 0,
  chanceOf50_inSol: 0,
  chanceOf75_inSol: 0,
  chanceOf95_inSol: 0,
  chanceOf99_inSol: 0,
  chanceOfOver99_inSol: 0,
  average_inSol: 0,

  chanceOf25: 0,
  chanceOf50: 0,
  chanceOf75: 0,
  chanceOf95: 0,
  chanceOf99: 0,
  chanceOfOver99: 0,
  average: 0,
};

// Fetch Jito tip floor data
async function fetchTipFloorData(): Promise<void> {
  try {
    const response = await axios.get(TIP_STATS_API_URL);
    const data = response.data[0];

    jitoTip.chanceOf25_inSol = data.landed_tips_25th_percentile;
    jitoTip.chanceOf50_inSol = data.landed_tips_50th_percentile;
    jitoTip.chanceOf75_inSol = data.landed_tips_75th_percentile;
    jitoTip.chanceOf95_inSol = data.landed_tips_95th_percentile;
    jitoTip.chanceOf99_inSol = data.landed_tips_99th_percentile;
    jitoTip.chanceOfOver99_inSol = Number(data.landed_tips_99th_percentile) * OVER_99_INCREMENT_FACTOR;

    jitoTip.chanceOf25 = Math.round(jitoTip.chanceOf25_inSol * LAMPORTS_PER_SOL);
    jitoTip.chanceOf50 = Math.round(jitoTip.chanceOf50_inSol * LAMPORTS_PER_SOL);
    jitoTip.chanceOf75 = Math.round(jitoTip.chanceOf75_inSol * LAMPORTS_PER_SOL);
    jitoTip.chanceOf95 = Math.round(jitoTip.chanceOf95_inSol * LAMPORTS_PER_SOL);
    jitoTip.chanceOf99 = Math.round(jitoTip.chanceOf99_inSol * LAMPORTS_PER_SOL);
    jitoTip.chanceOfOver99 = Math.round(jitoTip.chanceOfOver99_inSol * LAMPORTS_PER_SOL);
  } catch (error) {
    console.error("Error fetching tip floor data:", error);
  }
}

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
