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
  prompt: `You are an expert composer specializing in creating deep, evolving ambient music. Your goal is to generate a short, loopable musical piece with a clear sense of atmosphere and harmony.

You will compose three distinct parts: a solo melody, an accompaniment harmony, and a bass line. The overall style should be minimalist, atmospheric, and suitable for looping, creating an evolving soundscape. All parts must be in a harmonically consistent key (e.g., C Major, A Minor).

Instruments:
- Solo: {{{soloInstrument}}}
- Accompaniment: {{{accompanimentInstrument}}}
- Bass: {{{bassInstrument}}}

Compositional Guidelines:
- Solo Part: Create a simple, memorable, and expressive melody. It should be a sequence of 4-8 notes. Use varying note durations and rhythms to add interest.
- Accompaniment Part: Generate a harmonic progression that supports the solo melody. This could be slow-moving chords or a gentle arpeggio. Use 2-4 notes. This part should complement the solo, not overpower it.
- Bass Part: Provide a foundational bass line with 1-2 low-pitched notes. These notes should anchor the harmony and be rhythmically simple, often holding for a long duration.

Technical Constraints:
- The output MUST consist of only space-separated musical notes in scientific pitch notation (e.g., 'C4 G4 E4').
- Do not include any other text, labels, or explanations.
- To ensure a clear and crisp sound suitable for mobile devices, the total number of simultaneous notes (polyphony) should not exceed 8-10 voices.
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
