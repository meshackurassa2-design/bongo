const API_KEY = '2a755692ef522083ec0872d146f75cb9';
const BASE_URL = 'https://api.sunoapi.org/api/v1';

async function check() {
  try {
    const res = await fetch(`${BASE_URL}/generate/record-info?taskId=3c8a1bbd92752b64b395421313e88e3d`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const text = await res.text();
    console.log("RESPONSE:", text);
  } catch(e) {
    console.log("ERR:", e);
  }
}
check();
