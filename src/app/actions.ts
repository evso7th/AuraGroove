"use server";

import { z } from 'zod';
import { generateAmbientMusic } from '@/ai/flows/generate-ambient-music';
import type { GenerateAmbientMusicInput, GenerateAmbientMusicOutput } from '@/ai/flows/generate-ambient-music';

const FormSchema = z.object({
  soloInstrument: z.enum(['synthesizer', 'organ', 'piano']),
  accompanimentInstrument: z.enum(['synthesizer', 'organ', 'piano']),
  bassInstrument: z.enum(['bass guitar']),
});

interface ActionResult {
    data?: GenerateAmbientMusicOutput;
    error?: string;
}

export async function handleGenerateMusic(values: z.infer<typeof FormSchema>): Promise<ActionResult> {
  const validatedFields = FormSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: 'Invalid instrument selection.' };
  }
  
  try {
    const musicData = await generateAmbientMusic(validatedFields.data as GenerateAmbientMusicInput);
    
    // Quick validation of the returned data format. A more robust check might be needed.
    if (!musicData || typeof musicData.soloPart !== 'string') {
        return { error: 'AI returned an invalid data format.' };
    }

    return { data: musicData };
  } catch (error) {
    console.error('Error generating music with Genkit:', error);
    return { error: 'Failed to generate music. The AI model may be unavailable.' };
  }
}
