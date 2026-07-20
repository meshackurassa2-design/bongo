const API_KEY = '13f2a0b42e2ef8af321d5151b9c2f532';
const BASE_URL = 'https://api.sunoapi.org/api/v1';
const taskId = 'c1e18ba09966ca28ddc7842a336e4dd2';

async function test() {
  const infoRes = await fetch(`${BASE_URL}/generate/record-info?taskId=${taskId}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  const infoJson = await infoRes.json();
  console.log("RESPONSE:", JSON.stringify(infoJson, null, 2));
}

test();
