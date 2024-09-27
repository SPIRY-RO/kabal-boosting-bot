import axios from "axios";
import { floatToLamports, truncateAddress } from "../utils/helpers";
import { Keypair, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import { logger } from "../utils/logger";
import base58 from "bs58";
import { WSOL } from "../constants";

export async function createBuyTransaction({ tokenAddress, amountSol, slippage, keypair }: { tokenAddress: string; amountSol: number; slippage: number; keypair: Keypair }) {
  try {
    const response = await axios({
      method: "GET",
      url: "http://169.197.85.114:7676/quote",
      params: {
        inputMint: WSOL,
        outputMint: tokenAddress,
        amount: floatToLamports(amountSol),
        slippageBps: slippage * 100,
      },
    });

    const quoteResponse = response.data;

    const { inAmount, outAmount, otherAmountThreshold, priceImpactPct } = quoteResponse;

    logger.info(`[jupiter::quote] received ${truncateAddress(WSOL)} -> ${truncateAddress(tokenAddress)} | ${inAmount} SOL -> ${outAmount} TOK | slippage: ${slippage}`);

    const jupiterSwapResp = await axios({
      method: "POST",
      url: "http://169.197.85.114:7676/swap",
      data: {
        quoteResponse,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      },
    });

    const { swapTransaction } = jupiterSwapResp.data;

    // Deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(swapTransactionBuf);

    tx.sign([keypair]);

    return {
      tx,
      quoteResponse,
    };
  } catch (error) {
    logger.error(`[jupiter::quote] Error creating buy transaction: ${error}`);
    console.error(error);
    return null;
  }
}

export async function createSellTransaction({ tokenAddress, tokenAmountRaw, slippage, keypair }: { tokenAddress: string; tokenAmountRaw: number; slippage: number; keypair: Keypair }) {
  try {
    const response = await axios({
      method: "GET",
      url: "http://169.197.85.114:7676/quote",
      params: {
        inputMint: tokenAddress,
        outputMint: WSOL,
        amount: tokenAmountRaw,
        slippageBps: slippage * 100,
      },
    });

    const quoteResponse = response.data;

    const { inAmount, outAmount, otherAmountThreshold, priceImpactPct } = quoteResponse;

    logger.info(`[jupiter::quote] received ${truncateAddress(tokenAddress)} -> ${truncateAddress(WSOL)} | ${inAmount} TOK -> ${outAmount} SOL | slippage: ${slippage}`);

    const jupiterSwapResp = await axios({
      method: "POST",
      url: "http://169.197.85.114:7676/swap",
      data: {
        quoteResponse,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      },
    });

    const { swapTransaction } = jupiterSwapResp.data;

    // Deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(swapTransactionBuf);

    tx.sign([keypair]);

    return {
      tx,
      quoteResponse,
    };
  } catch (error) {
    logger.error(`[jupiter::quote] Error creating sell transaction: ${error}`);
    console.error(error);
    return null;
  }
}

export async function createSwapTransaction({ inputMint, outputMint, amount, slippage, keypair }: { inputMint: string; outputMint: string; amount: number; slippage: number; keypair: Keypair }) {
  try {
    const response = await axios({
      method: "GET",
      url: "http://169.197.85.114:7676/quote",
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps: slippage,
      },
    });

    const quoteResponse = response.data;

    const { inAmount, outAmount, otherAmountThreshold, priceImpactPct } = quoteResponse;

    logger.info(`[jupiter::quote] received ${truncateAddress(inputMint)} -> ${truncateAddress(outputMint)} | ${inAmount} IN -> ${outAmount} OUT | slippage: ${slippage}`);

    const jupiterSwapResp = await axios({
      method: "POST",
      url: "http://169.197.85.114:7676/swap",
      data: {
        quoteResponse,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      },
    });

    const { swapTransaction } = jupiterSwapResp.data;

    // Deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(swapTransactionBuf);

    tx.sign([keypair]);

    return tx;
  } catch (error) {
    logger.error(`[jupiter::quote] Error creating swap transaction: ${error}`);
    return null;
  }
}

export async function getSwapQuote({ inputMint, outputMint, amount, slippage, keypair }: { inputMint: string; outputMint: string; amount: number; slippage: number; keypair: Keypair }) {
  try {
    const response = await axios({
      method: "GET",
      url: "http://169.197.85.114:7676/quote",
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps: slippage,
      },
    });

    const quoteResponse = response.data;

    const { inAmount, outAmount, otherAmountThreshold, priceImpactPct } = quoteResponse;

    logger.info(`[jupiter::quote] received ${truncateAddress(inputMint)} -> ${truncateAddress(outputMint)} | ${inAmount} IN -> ${outAmount} OUT | slippage: ${slippage}`);

    return quoteResponse;
  } catch (error) {
    logger.error(`[jupiter::quote] Error creating swap transaction: ${error}`);
    console.error(error);
    return null;
  }
}
