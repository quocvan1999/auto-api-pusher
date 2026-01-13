import { GoogleGenAI } from "@google/genai";
import { ApiConfig } from "../types";

// Helper to remove keys starting with _ recursively
const cleanInternalKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(cleanInternalKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      // Remove keys starting with _ (e.g., _comment, __internal)
      if (!key.startsWith('_')) {
        newObj[key] = cleanInternalKeys(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

export const parseCurlWithGemini = async (curlString: string, providedApiKey?: string): Promise<ApiConfig> => {
  // Prioritize provided key (from UI), then environment variable
  const apiKey = providedApiKey || process.env.API_KEY;
  
  if (!apiKey) {
      throw new Error("API Key is missing. Please provide a valid Google Gemini API Key.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = "gemini-3-flash-preview";
    
    const response = await ai.models.generateContent({
      model: model,
      contents: `
        You are a developer tool. Your task is to parse a cURL command string and extract the HTTP method, URL, headers, and the JSON body structure.
        
        The cURL command is:
        ${curlString}

        Output valid JSON only with this structure:
        {
          "method": "GET" | "POST" | ...,
          "url": "https://...",
          "headers": { "Key": "Value" },
          "bodyTemplate": { "key": "value" }
        }

        Rules:
        1. Extract 'method' (GET, POST, PUT, DELETE, etc.). Default to GET if not found.
        2. Extract 'url'.
        3. Extract 'headers' as a key-value object.
        4. Extract 'bodyTemplate' as a JSON object. If the cURL has a raw body, parse it. If it uses -d key=value, convert to JSON. If no body, return empty object.
        5. IMPORTANT: Ignore and exclude any headers or body keys that start with "_" (underscore). These are internal variables or comments.
      `,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text) as ApiConfig;
      
      // Post-process to strictly ensure no underscore keys exist
      parsed.headers = cleanInternalKeys(parsed.headers || {});
      parsed.bodyTemplate = cleanInternalKeys(parsed.bodyTemplate || {});
      
      return parsed;
    }
    throw new Error("Empty response from AI");
  } catch (error: any) {
    console.error("Error parsing cURL:", error);
    throw new Error(error.message || "Failed to parse cURL command.");
  }
};