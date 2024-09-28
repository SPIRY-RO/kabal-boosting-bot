import { Context } from "telegraf";
import { getOrCreateUser } from "./helpers/user";
import { getAccountBalance } from "./utils/helpers";
import { PublicKey } from "@solana/web3.js";
import moment from "moment";

export async function getUserMembershipLevel(userId: string) {
  return "Diamond";
}

const axios = require("axios");
const fs = require("fs");

export async function downloadFileFromURL(url: string, path: string): Promise<void> {
  try {
    // Make an HTTP GET request to the URL to fetch the file data
    const response = await axios.get(url, { responseType: "stream" });

    // Build a path relative to the current directory

    // Create a write stream to save the file
    const fileStream = fs.createWriteStream(path);

    // Pipe the response data to the file stream
    response.data.pipe(fileStream);

    // Wait for the file to finish writing
    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    console.log(`File downloaded and saved to ${path}`);
  } catch (error) {
    console.error("Error downloading file:", error);
  }
}

interface Argument {
  value: string;
  placeholder: string;
}

export function unwrapCommandArguments(ctx: Context, command: string, args: Argument[]) {
  if (!args) {
    return;
  }

  // Get an array of arguments between the marking character which is " ". for example /setup "test" "test3"
  // @ts-ignore
  const msgArguments: string[] = ctx.message?.text.split(" ");

  // Check if the length of the unwrapped arguments is the same as the expected arguments

  console.log(msgArguments.length);
  console.log(args.length + 1);

  if (msgArguments.length !== args.length + 1) {
    ctx.reply(
      `⚠️ There was an error processing your command. 
Please check command tutorial and check again.

📍 *Tutorial*: /${command} <${args.map((arg) => arg.value).join("> <")}> 
✅ *Example usage*: /${command} ${args.map((arg) => arg.placeholder).join(" ")}
`,
      {
        parse_mode: "Markdown",
      }
    );
    return;
  }

  // Create an object, where the key is the argument name and the value is the argument value
  return args.reduce((acc: any, arg, index) => {
    acc[arg.value] = msgArguments[index + 1];
    return acc;
  }, {});
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateStartMenu(ctx: Context) {
  const userId = ctx.from?.id.toString();
  if (!userId) {
    return "Error getting user id";
  }
  const user = await getOrCreateUser(userId);
  const balance = await getAccountBalance(new PublicKey(user.masterWalletAddress));
  const rentExpiryAt = user.rentExpiresAt;

  return `
🚀 Kabal Boosting Service 🚀

💼 Wallet: ${user?.masterWalletAddress || "Not set"}
💰 Balance: ${balance.toFixed(4)} SOL
⏳ Rent Expiry: ${rentExpiryAt ? moment(user?.rentExpiresAt).format("DD/MM/YYYY HH:mm") : "No credits. Please fund wallet"}

🔗 Referred by: ${user?.referredByTelegramId || "Not set"}

🔹 Functions:
1. 📈 Boost your trading volume
2. 💼 Manage your crypto holdings
3. 🏆 Improve your rank in the crypto community

👇 Click the buttons to get started 👇
`;
}
