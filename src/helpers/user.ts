import { Context } from "telegraf";
import { prisma } from "..";
import { Keypair } from "@solana/web3.js";
import base58 from "bs58";

export async function getOrCreateUser(telegramId: string) {
  let user = await prisma.user.findFirst({
    where: {
      telegramId,
    },
  });

  const newKeypair = Keypair.generate();

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        masterWalletPK: base58.encode(newKeypair.secretKey),
        masterWalletAddress: newKeypair.publicKey.toBase58(),
      },
    });
  }

  return user;
}
