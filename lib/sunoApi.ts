const API_KEY = '13f2a0b42e2ef8af321d5151b9c2f532';
const BASE_URL = 'https://api.sunoapi.org/api/v1';

export type SunoTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SENSITIVE_WORD_ERROR';

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

export const generateMusic = async (
  prompt: string, 
  tags: string, 
  title: string,
  uploadUrl?: string,
  vocalGender?: 'Male' | 'Female' | 'Any',
  weirdness?: number,
  styleInfluence?: number
): Promise<string> => {
  // Append vocal gender to tags if selected
  let finalTags = tags;
  if (vocalGender && vocalGender !== 'Any') {
    finalTags = finalTags ? `${finalTags}, ${vocalGender.toLowerCase()} vocals` : `${vocalGender.toLowerCase()} vocals`;
  }

  const payload: any = {
    prompt,
    tags: finalTags,
    title,
    customMode: true,
    instrumental: false,
    model: "V4_5ALL",
    callBackUrl: "https://httpbin.org/post",
  };

  // Add advanced parameters if they are provided
  if (uploadUrl) payload.uploadUrl = uploadUrl;
  if (typeof weirdness === 'number') payload.weirdness = weirdness;
  if (typeof styleInfluence === 'number') payload.style_influence = styleInfluence;

  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate music: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  
  let taskId;
  if (typeof json.data === 'string') {
    taskId = json.data;
  } else if (json.data && json.data.taskId) {
    taskId = json.data.taskId;
  } else {
    taskId = json.taskId;
  }
  
  if (!taskId) {
     console.error("Suno API full response:", json);
     throw new Error(json.msg || "No taskId returned. Check console for full response.");
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
  
  if (json.code !== 200 || !json.data) {
    throw new Error(json.msg || "Failed to fetch task info");
  }

  const taskData = json.data;
  return {
    taskId: taskData.taskId,
    status: taskData.status,
    data: taskData.response?.sunoData || [],
  };
};
