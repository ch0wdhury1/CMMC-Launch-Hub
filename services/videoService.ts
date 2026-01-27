
import { GoogleGenAI } from "@google/genai";

/**
 * Service for generating professional CMMC training videos
 * Uses Veo 3.1 for high-fidelity cinematic training content
 */
export const generateTrainingVideo = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  // 1. Initial generation request
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Professional cinematic corporate training video, flat design graphics overlay, clear informative tone: ${prompt}`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  // 2. Poll for completion
  while (!operation.done) {
    // Wait 10 seconds before polling
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  // 3. Get download link
  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error("Video generation completed but no link was provided.");
  }

  // 4. Fetch the actual MP4 bytes with API key
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  
  return URL.createObjectURL(blob);
};
