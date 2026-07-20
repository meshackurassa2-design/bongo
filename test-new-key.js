const API_KEY = '13f2a0b42e2ef8af321d5151b9c2f532';
const BASE_URL = 'https://api.sunoapi.org/api/v1';

async function test() {
  console.log("Testing new API key generation...");
  try {
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
  } catch(e) {
    console.log("ERR:", e);
  }
}

test();
