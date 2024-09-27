import * as envalid from "envalid";
import dotenv from "dotenv";
dotenv.config();
const { str, bool, num } = envalid;

export const config = envalid.cleanEnv(process.env, {
  TG_BOT_TOKEN: str(),
  HTTP_RPC_URL: str(),
  REVENUE_WALLET: str(),
  TEAM_NOTIFICATIONS_CHAT: num(),
  TEAM_NOTIFICATIONS_CHAT_FALLBACK: num(),
  BLOCK_ENGINE_URL: str(),
  JITO_AUTH_PRIVATE_KEY: str(),
});

export const DEF_MESSAGE_OPTS = {
  disable_web_page_preview: true,
  parse_mode: "HTML",
};
