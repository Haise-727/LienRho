import { createOpenAI } from "@ai-sdk/openai";

export const siliconFlow = createOpenAI({
  baseURL: "https://api.siliconflow.com/v1",
  apiKey: process.env.SILICONFLOW_API_KEY || "",
});
