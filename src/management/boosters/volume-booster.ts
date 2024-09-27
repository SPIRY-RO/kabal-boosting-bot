import { prisma } from "../..";
import { VolumeBooster } from "../../classes/VolumeBooster";
import { sleep } from "../../helpers";
import { logger } from "../../utils/logger";

export let activeVolumeBoosters: VolumeBooster[] = [];

export async function cleanupAllBoosters() {
  logger.info(`Cleaning up all boosters...`);
  // Find boosters which have a state different than "stopped" on boot startup
  const boosters = await prisma.volumeBooster.findMany({
    where: {
      status: {
        not: "stopped",
      },
    },
  });

  for (let booster of boosters) {
    const vb = new VolumeBooster(booster.id);
    await vb.cleanup();
  }
}

export async function changeBoosterStatus(boosterId: string, status: string) {
  await prisma.volumeBooster.update({
    where: {
      id: boosterId,
    },
    data: {
      status,
    },
  });
}

export async function initVolumeBoosterManagerDaemon() {
  await cleanupAllBoosters();

  while (true) {
    await volumeBoosterManagerDaemonStep();
    await sleep(2000);
  }
}

export async function volumeBoosterManagerDaemonStep() {
  // Check all boosters with status = "start_requested"
  const boosters = await prisma.volumeBooster.findMany({
    where: {
      status: "start_requested",
    },
  });

  for (let booster of boosters) {
    // Check if the booster is already active
    if (activeVolumeBoosters.find((b) => b.boosterId === booster.id)) {
      continue;
    }

    // Start the booster

    const vb = new VolumeBooster(booster.id);
    vb.start();

    activeVolumeBoosters.push(vb);
  }

  // Check all the boosters with status = "stop_requested"
  const boostersToStop = await prisma.volumeBooster.findMany({
    where: {
      status: "stop_requested",
    },
  });

  for (let booster of boostersToStop) {
    const vb = activeVolumeBoosters.find((b) => b.boosterId === booster.id);

    if (vb) {
      vb.stop();
    }
  }
}
