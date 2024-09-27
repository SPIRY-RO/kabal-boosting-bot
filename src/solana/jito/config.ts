import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

import * as bs58 from "bs58";
import { config } from "../../config";

// define these
export const blockEngineUrl = config.BLOCK_ENGINE_URL;
const jitoAuthPrivateKey = config.JITO_AUTH_PRIVATE_KEY || "";

export const rpc_https_url = "http://169.197.85.114:8899";
export const rpc_https_backup = "https://solana-mainnet.g.alchemy.com/v2/yKznUGE6i2hR_LPNU2-uhjYG2FS8oIiB";
export const jito_auth_keypair = Keypair.fromSecretKey(new Uint8Array(bs58.decode(jitoAuthPrivateKey)));

export const connection = new Connection(rpc_https_url, "confirmed");
