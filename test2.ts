import { getTaskInfo } from './lib/sunoApi';

async function run() {
  const info = await getTaskInfo('d938a2cb8ac93886b36add952c5c5637');
  console.log("PARSED INFO:", JSON.stringify(info, null, 2));
}

run();
