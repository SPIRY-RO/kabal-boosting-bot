import { TokenInfo } from "@prisma/client";
import { prisma } from "..";

export async function getTokenDetails(tokenAddress: string): Promise<TokenInfo | null> {
  const token = await prisma.tokenInfo.findFirst({
    where: {
      tokenAddress,
    },
  });

  if (!token) {
    return null;
  }

  return token;
}
