import { supabase } from './supabase';

const BASE_URL = 'https://api.sunoapi.org/api/v1';

export const getDynamicApiKey = async (): Promise<string> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'suno_api_key')
    .single();
    
  if (error || !data) {
    throw new Error("Could not retrieve Suno API key from system settings.");
  }
  return data.value;
};

export type SunoTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SENSITIVE_WORD_ERROR';

export interface SunoAudioData {
  id: string;
  title: string;
  audioUrl: string;
  imageUrl: string;
  videoUrl: string;
  duration: number;
  status: string;
  streamAudioUrl?: string;
  sourceAudioUrl?: string;
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

  const apiKey = await getDynamicApiKey();
  
  const response = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
  const apiKey = await getDynamicApiKey();
  
  const response = await fetch(`${BASE_URL}/generate/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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

export const getApiCreditBalance = async (): Promise<number> => {
  const apiKey = await getDynamicApiKey();
  
  const response = await fetch(`${BASE_URL}/generate/credit`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch credit balance: ${response.status}`);
  }

  const json = await response.json();
  
  if (json.code !== 200) {
    throw new Error(json.msg || "Failed to fetch credit balance");
  }

  return json.data;
};

export const generatePersona = async (
  audioId: string,
  name: string,
  description: string
): Promise<string> => {
  const apiKey = await getDynamicApiKey();
  
  const response = await fetch(`${BASE_URL}/generate/generate-persona`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      audioId,
      name,
      description
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate persona: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "Failed to generate persona");
  }
  
  return json.data?.personaId || json.personaId || (json.data && json.data.taskId) || json.taskId || json.data;
};

export const uploadAndCoverAudio = async (
  prompt: string,
  style: string,
  title: string,
  personaId: string,
  audioId?: string,
  audioUrl?: string
): Promise<string> => {
  const apiKey = await getDynamicApiKey();
  
  const payload: any = {
    prompt,
    style,
    title,
    personaId,
    callBackUrl: "https://httpbin.org/post",
  };
  
  if (audioId) payload.audioId = audioId;
  if (audioUrl) payload.audioUrl = audioUrl;

  const response = await fetch(`${BASE_URL}/generate/upload-cover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload and cover audio: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "Failed to upload and cover audio");
  }

  let taskId;
  if (typeof json.data === 'string') {
    taskId = json.data;
  } else if (json.data && json.data.taskId) {
    taskId = json.data.taskId;
  } else {
    taskId = json.taskId;
  }
  
  if (!taskId) {
     console.error("Suno API upload cover full response:", json);
     throw new Error(json.msg || "No taskId returned. Check console for full response.");
  }
  return taskId;
};

// CUSTOM VOICE METHODS

export const generateVoiceValidation = async (
  voiceUrl: string,
  vocalStartS: number,
  vocalEndS: number,
  language: string = 'en',
  callBackUrl?: string
): Promise<string> => {
  const apiKey = await getDynamicApiKey();
  const response = await fetch(`${BASE_URL}/voice/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      voiceUrl,
      vocalStartS,
      vocalEndS,
      language,
      callBackUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate validation: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed");
  
  return json.data?.taskId || json.taskId;
};

export const getVoiceValidationInfo = async (taskId: string): Promise<any> => {
  const apiKey = await getDynamicApiKey();
  const response = await fetch(`${BASE_URL}/voice/validate-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get validation info: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed");
  
  return json.data;
};

export const createCustomVoice = async (
  taskId: string,
  verifyUrl: string,
  voiceName?: string,
  description?: string,
  style?: string,
  singerSkillLevel: string = 'beginner',
  callBackUrl?: string
): Promise<string> => {
  const apiKey = await getDynamicApiKey();
  const response = await fetch(`${BASE_URL}/voice/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      taskId,
      verifyUrl,
      voiceName,
      description,
      style,
      singerSkillLevel,
      callBackUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create custom voice: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed");
  
  return json.data?.taskId || json.taskId;
};

export const getCustomVoiceRecord = async (taskId: string): Promise<any> => {
  const apiKey = await getDynamicApiKey();
  const response = await fetch(`${BASE_URL}/voice/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get custom voice record: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed");
  
  return json.data;
};

// SOUNDS
export const generateSounds = async (
  prompt: string,
  loop?: boolean,
  tempo?: string,
  key?: string
): Promise<string> => {
  const apiKey = await getDynamicApiKey();
  const payload: any = { prompt };
  if (loop) payload.loop = loop;
  if (tempo) payload.tempo = tempo;
  if (key) payload.key = key;
  
  const response = await fetch(`${BASE_URL}/generate/sounds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate sound: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed to generate sound");
  
  let taskId = json.data?.taskId || json.taskId || (typeof json.data === 'string' ? json.data : undefined);
  if (!taskId) throw new Error("No taskId returned");
  return taskId;
};

// MUSIC VIDEO
export const createMusicVideo = async (
  taskId: string,
  audioId: string,
  author?: string,
  domainName?: string
): Promise<string> => {
  const apiKey = await getDynamicApiKey();
  const payload: any = { 
    taskId, 
    audioId,
    callBackUrl: 'https://bongo-stream.vercel.app/api/suno-callback' // Required by API, though we poll manually
  };
  if (author) payload.author = author;
  if (domainName) payload.domainName = domainName;
  
  const response = await fetch(`${BASE_URL}/mp4/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate video: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed to generate video");
  
  let returnedTaskId = json.data?.taskId || json.taskId || (typeof json.data === 'string' ? json.data : undefined);
  if (!returnedTaskId) throw new Error("No taskId returned for video");
  return returnedTaskId;
};

export const getVideoRecordInfo = async (taskId: string): Promise<any> => {
  const apiKey = await getDynamicApiKey();
  const response = await fetch(`${BASE_URL}/mp4/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get video info: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) throw new Error(json.msg || "Failed to get video info");
  
  return json.data;
};
