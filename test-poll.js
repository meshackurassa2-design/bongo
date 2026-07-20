const API_KEY = '2a755692ef522083ec0872d146f75cb9';
const BASE_URL = 'https://api.sunoapi.org/api/v1';

async function test() {
  console.log("Generating...");
  const genRes = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      prompt: "A short fast rock song",
      tags: "rock",
      title: "TestRock",
      customMode: true,
      instrumental: false,
      model: "V4_5ALL",
      callBackUrl: "https://httpbin.org/post"
    }),
  });
  const genJson = await genRes.json();
  console.log("GENERATE RESPONSE:", JSON.stringify(genJson, null, 2));
  const taskId = genJson.data?.taskId || genJson.taskId || (typeof genJson.data === 'string' ? genJson.data : null);
  console.log("Task ID:", taskId);

  if (!taskId) return;

  for (let i = 0; i < 20; i++) {
    console.log(`\nPolling ${i+1}...`);
    try {
      const infoRes = await fetch(`${BASE_URL}/generate/record-info?taskId=${taskId}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      });
      const infoJson = await infoRes.json();
      console.log("Status:", infoJson.data?.status);
      console.log("Has Response:", !!infoJson.data?.response);
      if (infoJson.data?.response) {
        console.log("SunoData length:", infoJson.data.response.sunoData?.length);
      }
      
      if (infoJson.data?.status === 'SUCCESS' && infoJson.data?.response?.sunoData?.length > 0) {
        console.log("DONE!");
        break;
      }
    } catch(e) {
      console.log("POLL ERROR:", e.message);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
}

test();
