import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CallClaudeOptions {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  timeoutMs?: number;
}

export async function callClaude({
  system,
  user,
  model,
  maxTokens,
  timeoutMs = 120000,
}: CallClaudeOptions): Promise<string> {
  const started = Date.now();
  const timeoutSecs = Math.round(timeoutMs / 1000);
  const inputEstimate = Math.ceil((system.length + user.length) / 4);

  const watchdog = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(
        `Anthropic call timed out after ${timeoutSecs}s. Any in-flight processing is orphaned.`
      ));
    }, timeoutMs);
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      (timer as NodeJS.Timeout).unref();
    }
  });

  let message: Anthropic.Message;
  try {
    const apiCall = anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: user }],
    });

    message = await Promise.race([apiCall, watchdog]);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  const latencyMs = Date.now() - started;
  const outputTokens = message.usage?.output_tokens ?? 0;
  console.log(
    `[AI] model=${model} inputEst=${inputEstimate} outputTokens=${outputTokens} latencyMs=${latencyMs}`
  );

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Anthropic response');
  }
  return textBlock.text;
}
