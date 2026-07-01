const API_KEY = '2a755692ef522083ec0872d146f75cb9';
const BASE_URL = 'https://api.sunoapi.org/api/v1';

export type SunoTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface SunoAudioData {
  id: string;
  title: string;
  audioUrl: string;
  imageUrl: string;
  videoUrl: string;
  duration: number;
  status: string;
}

export interface SunoTaskResponse {
  taskId: string;
  status: SunoTaskStatus;
  data?: SunoAudioData[];
}

export const generateMusic = async (prompt: string, tags: string, title: string): Promise<string> => {
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      tags,
      title,
      customMode: true,
      instrumental: false,
      model: "V4_5ALL",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate music: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  const taskId = json.data?.taskId || json.taskId;
  
  if (!taskId) {
     throw new Error("No taskId returned from Suno API");
  }
  return taskId;
};

export const getTaskInfo = async (taskId: string): Promise<SunoTaskResponse> => {
  const response = await fetch(`${BASE_URL}/generate/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch task info: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  return json;
};
