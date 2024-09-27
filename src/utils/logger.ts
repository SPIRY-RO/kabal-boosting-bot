const filteredTags = ["hellomoon"];

export const logger = {
  info: (message: string) => {
    // if (!message.includes(filteredTags[0])) {
    //   return;
    // }
    console.log(`[${timestamp()}] INFO ${message}`);
  },
  warn: (message: string) => {
    console.log(`[${timestamp()}] WARN ${message}`);
  },
  error: (message: string) => {
    console.log(`[${timestamp()} ERROR ${message}`);
  },
};

export function timestamp() {
  return new Date().toISOString();
}

export function logAveragePollingRate(address: string, pollingRate: number) {
  logger.info(`Average polling rate for ${address} is ${pollingRate} ms.`);
}
