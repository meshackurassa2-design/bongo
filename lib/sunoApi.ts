import { supabase } from './supabase';

export const getApiConfig = async (): Promise<{ provider: 'suno' | 'kie', apiKey: string, baseUrl: string }> => {
  const [providerRes, sunoKeyRes, kieKeyRes] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'ai_api_provider').single(),
    supabase.from('system_settings').select('value').eq('key', 'suno_api_key').single(),
    supabase.from('system_settings').select('value').eq('key', 'kie_api_key').single()
  ]);

  const provider = (providerRes.data?.value as 'suno' | 'kie') || 'suno';
  const apiKey = provider === 'kie' ? kieKeyRes.data?.value : sunoKeyRes.data?.value;

  if (!apiKey) {
    throw new Error(`Could not retrieve API key for ${provider.toUpperCase()}`);
  }

  const baseUrl = provider === 'kie' ? 'https://api.kie.ai/api/v1' : 'https://api.sunoapi.org/api/v1';

  return { provider, apiKey, baseUrl };
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
  prompt?: string;
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
  styleInfluence?: number,
  personaId?: string
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
    model: personaId ? "V3_5" : "V4_5ALL",
    callBackUrl: "https://httpbin.org/post",
  };

  if (personaId) {
    payload.personaId = personaId;
  }

  // Add advanced parameters if they are provided
  if (uploadUrl) payload.uploadUrl = uploadUrl;
  if (typeof weirdness === 'number') payload.weirdness = weirdness;
  if (typeof styleInfluence === 'number') payload.style_influence = styleInfluence;

  const { provider, apiKey, baseUrl } = await getApiConfig();

  const response = await fetch(`${baseUrl}/generate`, {
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

export const separateVocals = async (taskId: string, audioId: string): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  let endpoint = `${baseUrl}/separate-vocals`;
  let payload: any = { audioId };
  
  if (provider === 'kie') {
    endpoint = `${baseUrl}/vocal-removal/generate`;
    payload = {
      taskId,
      audioId,
      type: 'separate_vocal',
      callBackUrl: 'https://bongo-stream.com/callback'
    };
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to separate vocals: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  
  let resultTaskId;
  if (typeof json.data === 'string') {
    resultTaskId = json.data;
  } else if (json.data && json.data.taskId) {
    resultTaskId = json.data.taskId;
  } else {
    resultTaskId = json.taskId;
  }
  
  if (!resultTaskId) {
     console.error("Suno API full response:", json);
     throw new Error(json.msg || "No taskId returned.");
  }
  return resultTaskId;
};

export const getTaskInfo = async (taskId: string): Promise<SunoTaskResponse> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const response = await fetch(`${baseUrl}/generate/record-info?taskId=${taskId}`, {
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
  const status = taskData.successFlag || taskData.status || 'PENDING';
  
  let mappedData: SunoAudioData[] = [];
  if (provider === 'kie' && taskData.response) {
    if (taskData.response.vocalUrl) {
      mappedData.push({
        id: `${taskData.taskId}-vocal`,
        title: 'Isolated Vocals',
        imageUrl: 'https://via.placeholder.com/150/8A2BE2/FFFFFF?text=Vocals',
        audioUrl: taskData.response.vocalUrl,
        videoUrl: ''
      });
    }
    if (taskData.response.instrumentalUrl) {
      mappedData.push({
        id: `${taskData.taskId}-inst`,
        title: 'Isolated Instrumental',
        imageUrl: 'https://via.placeholder.com/150/4169E1/FFFFFF?text=Instrumental',
        audioUrl: taskData.response.instrumentalUrl,
        videoUrl: ''
      });
    }
    if (mappedData.length === 0) {
      mappedData = taskData.response.sunoData || [];
    }
  } else {
    mappedData = taskData.response?.sunoData || [];
  }

  return {
    taskId: taskData.taskId,
    status: status,
    data: mappedData,
  };
};

export const getVocalRemovalInfo = async (taskId: string): Promise<SunoTaskResponse> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  let endpoint = `${baseUrl}/generate/record-info?taskId=${taskId}`;
  if (provider === 'kie') {
    endpoint = `${baseUrl}/vocal-removal/record-info?taskId=${taskId}`;
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch vocal removal info: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  
  if (json.code !== 200 || !json.data) {
    throw new Error(json.msg || "Failed to fetch vocal removal info");
  }

  const taskData = json.data;
  const status = taskData.successFlag || taskData.status || 'PENDING';
  
  let mappedData: SunoAudioData[] = [];
  if (provider === 'kie' && taskData.response) {
    if (taskData.response.vocalUrl) {
      mappedData.push({
        id: `${taskData.taskId}-vocal`,
        title: 'Isolated Vocals',
        imageUrl: 'https://via.placeholder.com/150/8A2BE2/FFFFFF?text=Vocals',
        audioUrl: taskData.response.vocalUrl,
        videoUrl: ''
      });
    }
    if (taskData.response.instrumentalUrl) {
      mappedData.push({
        id: `${taskData.taskId}-inst`,
        title: 'Isolated Instrumental',
        imageUrl: 'https://via.placeholder.com/150/4169E1/FFFFFF?text=Instrumental',
        audioUrl: taskData.response.instrumentalUrl,
        videoUrl: ''
      });
    }
    if (mappedData.length === 0) {
      mappedData = taskData.response.sunoData || [];
    }
  } else {
    mappedData = taskData.response?.sunoData || [];
  }

  return {
    taskId: taskData.taskId,
    status: status,
    data: mappedData,
  };
};

export const getApiCreditBalance = async (): Promise<number> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const response = await fetch(`${baseUrl}/generate/credit`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const response = await fetch(`${baseUrl}/generate/generate-persona`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const payload: any = {
    prompt,
    style,
    title,
    customMode: true,
    instrumental: false,
    callBackUrl: "https://httpbin.org/post",
    model: "V3_5" // Always force V3_5 for covers to prevent it from getting stuck
  };

  if (personaId) {
    payload.personaId = personaId;
  }
  
  if (audioId) payload.audioId = audioId;
  if (audioUrl) {
    payload.uploadUrl = audioUrl;
    payload.audioUrl = audioUrl;
  }

  const response = await fetch(`${baseUrl}/generate/upload-cover`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/voice/validate`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/voice/validate-info?taskId=${taskId}`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/voice/generate`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/voice/record-info?taskId=${taskId}`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const payload: any = { prompt };
  if (loop) payload.loop = loop;
  if (tempo) payload.tempo = tempo;
  if (key) payload.key = key;
  
  const response = await fetch(`${baseUrl}/generate/sounds`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const payload: any = { 
    taskId, 
    audioId,
    callBackUrl: 'https://bongo-stream.vercel.app/api/suno-callback' // Required by API, though we poll manually
  };
  if (author) payload.author = author;
  if (domainName) payload.domainName = domainName;
  
  const response = await fetch(`${baseUrl}/mp4/generate`, {
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
  const { provider, apiKey, baseUrl } = await getApiConfig();
  const response = await fetch(`${baseUrl}/mp4/record-info?taskId=${taskId}`, {
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

// EXTEND AUDIO
export const extendAudio = async (
  audioId: string,
  prompt: string,
  continueAt?: string | number
): Promise<string> => {
  const { provider, apiKey, baseUrl } = await getApiConfig();
  
  const payload: any = {
    audioId,
    prompt,
    customMode: true,
    model: "V4_5ALL"
  };
  if (continueAt !== undefined && continueAt !== '') {
    payload.continue_at = continueAt;
  }

  const response = await fetch(`${baseUrl}/generate/extend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to extend audio: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "Failed to extend audio");
  }

  const taskId = json.data?.taskId || json.taskId || (typeof json.data === 'string' ? json.data : undefined);
  if (!taskId) throw new Error("No taskId returned for extend audio");
  return taskId;
};
