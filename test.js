const API_KEY = '2a755692ef522083ec0872d146f75cb9';
const BASE_URL = 'https://api.sunoapi.org/api/v1';

async function test() {
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      prompt: "A peaceful acoustic guitar melody",
      tags: "acoustic",
      title: "Test",
      customMode: true,
      instrumental: false,
      model: "V4_5ALL",
      callBackUrl: "https://httpbin.org/post"
    }),
  });

  const text = await response.text();
  console.log("RESPONSE_STATUS:", response.status);
  console.log("RESPONSE_BODY:", text);
}

test();
