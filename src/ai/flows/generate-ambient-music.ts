'use server';

/**
 * @fileOverview An ambient music generation AI agent.
 *
 * - generateAmbientMusic - A function that handles the ambient music generation process.
 * - GenerateAmbientMusicInput - The input type for the generateAmbientMusic function.
 * - GenerateAmbientMusicOutput - The return type for the generateAmbientMusic function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAmbientMusicInputSchema = z.object({
  soloInstrument: z.enum(['synthesizer', 'organ', 'piano']).describe('The instrument for the solo part.'),
  accompanimentInstrument: z
    .enum(['synthesizer', 'organ', 'piano'])
    .describe('The instrument for the accompaniment part.'),
  bassInstrument: z.enum(['bass guitar']).describe('The instrument for the bass part.'),
});

export type GenerateAmbientMusicInput = z.infer<typeof GenerateAmbientMusicInputSchema>;

const GenerateAmbientMusicOutputSchema = z.object({
  soloPart: z.string().describe("The generated solo part music as a space-separated sequence of notes (e.g., 'C4 D4 E4'). Should be between 4 and 8 notes long."),
  accompanimentPart: z.string().describe("The generated accompaniment part music as a space-separated sequence of notes. Should be between 2 and 4 notes long."),
  bassPart: z.string().describe("The generated bass part music as a space-separated sequence of notes. Should be 1 or 2 notes long."),
});

export type GenerateAmbientMusicOutput = z.infer<typeof GenerateAmbientMusicOutputSchema>;

export async function generateAmbientMusic(
  input: GenerateAmbientMusicInput
): Promise<GenerateAmbientMusicOutput> {
  return generateAmbientMusicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAmbientMusicPrompt',
  input: {schema: GenerateAmbientMusicInputSchema},
  output: {schema: GenerateAmbientMusicOutputSchema},
  prompt: `You are a composer specializing in ambient music.

You will generate three parts: solo, accompaniment, and bass.

The style is ambient, minimalist, and looping. The notes should be in a consistent key, like C major or A minor.

The instruments are:
- Solo: {{{soloInstrument}}}
- Accompaniment: {{{accompanimentInstrument}}}
- Bass: {{{bassInstrument}}}

Constraints:
- The output must be ONLY space-separated musical notes in scientific pitch notation (e.g., 'C4 G4 E4').
- Solo Part: Generate a sequence of 4-8 notes.
- Accompaniment Part: Generate a sequence of 2-4 notes that harmonize with the solo part.
- Bass Part: Generate a sequence of 1-2 low-pitched notes that provide a foundation.
- Ensure variety and evolution in all parts but they should sound good when looped.
- Limit the total number of concurrent voices to 8-10 to ensure crisp and clear audio, focusing on performance for mobile devices.
- Do not include any other text, labels, or explanations.
`,
});

const generateAmbientMusicFlow = ai.defineFlow(
  {
    name: 'generateAmbientMusicFlow',
    inputSchema: GenerateAmbientMusicInputSchema,
    outputSchema: GenerateAmbientMusicOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_LOW_AND_ABOVE',
        },
      ],
    });
    return output!;
  }
);
