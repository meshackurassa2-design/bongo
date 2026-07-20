const API_KEY = '2a755692ef522083ec0872d146f75cb9';
const BASE_URL = 'https://api.sunoapi.org/api/v1';

async function testStatus() {
  const response = await fetch(`${BASE_URL}/generate/record-info?taskId=d938a2cb8ac93886b36add952c5c5637`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  const text = await response.text();
  console.log("STATUS_CODE:", response.status);
  console.log("RECORD_INFO_BODY:", text);
}

testStatus();
