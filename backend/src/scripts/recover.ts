import { recoverStaleDispatches } from '../worker';

async function run() {
  console.log("Recovering stale dispatches...");
  await recoverStaleDispatches(0);
  console.log("Done");
  process.exit(0);
}

run();
