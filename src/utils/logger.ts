import { appendFileSync, existsSync, writeFileSync } from "fs";

// Ensure the log file exists or create it
const logFile = "log.log";
if (!existsSync(logFile)) {
  writeFileSync(logFile, ""); // Creates an empty log file if it doesn't exist
}

const filteredTags = ["hellomoon"];

export const logger = {
  info: (message: string) => {
    const logMessage = `[${timestamp()}] INFO ${message}`;
    // if (!message.includes(filteredTags[0])) {
    //   return;
    // }
    console.log(logMessage);
    appendToFile(logMessage);
  },
  warn: (message: string) => {
    const logMessage = `[${timestamp()}] WARN ${message}`;
    console.log(logMessage);
    appendToFile(logMessage);
  },
  error: (message: string) => {
    const logMessage = `[${timestamp()}] ERROR ${message}`;
    console.log(logMessage);
    appendToFile(logMessage);
  },
};

// Helper function to append log to file
function appendToFile(logMessage: string) {
  try {
    appendFileSync(logFile, logMessage + "\n"); // Append message to the file with a newline
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

export function timestamp() {
  return new Date().toISOString();
}

export function logAveragePollingRate(address: string, pollingRate: number) {
  logger.info(`Average polling rate for ${address} is ${pollingRate} ms.`);
}
