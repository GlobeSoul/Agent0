/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { load } from '@std/dotenv';
import { resolve } from '@std/path';
import { z } from 'zod';

// Default configuration constants
const DEFAULTS = {
  GOOGLE: {
    MODEL: 'gemini-2.5-flash',
    TEMPERATURE: 0,
  },
  SERVER: {
    PORT: 8080,
  },
} as const;

// Configuration schema with Zod validation
const configSchema = z.object({
  google: z.object({
    apiKey: z.string().min(1, 'Google API key is required'),
    model: z.string().default(DEFAULTS.GOOGLE.MODEL),
    temperature: z.number().min(0).max(2).default(DEFAULTS.GOOGLE.TEMPERATURE),
  }),
  server: z.object({
    port: z.number().int().min(1000).max(65535).default(DEFAULTS.SERVER.PORT),
    apiKey: z.string().min(1, 'MCP Server API key is required'),
  }),
});

// Type inference from schema
export type Config = z.infer<typeof configSchema>;

// Load environment variables from .env file
async function loadEnvVars(): Promise<Record<string, string>> {
  try {
    const workspaceRoot = resolve(Deno.cwd(), '../../');
    return await load({ envPath: resolve(workspaceRoot, '.env.test') });
  } catch {
    // .env file doesn't exist, return empty object
    return {};
  }
}

// Parse and validate configuration
async function createConfig(): Promise<Config> {
  const envVars = await loadEnvVars();

  const getEnv = (key: string, defaultValue?: string): string => {
    return envVars[key] || Deno.env.get(key) || defaultValue || '';
  };

  const rawConfig = {
    google: {
      apiKey: getEnv('GOOGLE_API_KEY'),
      model: getEnv('DEFAULT_MODEL', DEFAULTS.GOOGLE.MODEL),
      temperature: parseFloat(
        getEnv('DEFAULT_TEMPERATURE', DEFAULTS.GOOGLE.TEMPERATURE.toString()),
      ),
    },
    server: {
      port: parseInt(getEnv('MCP_SERVER_PORT', DEFAULTS.SERVER.PORT.toString()), 10),
      apiKey: getEnv('MCP_SERVER_API_KEY'),
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      (error as z.ZodError).errors.forEach((err: z.ZodIssue) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      Deno.exit(1);
    }
    throw error;
  }
}

// Export async configuration loader
export const getConfig = createConfig;

// Export schema for external validation
export { configSchema };
