import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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

// Parse and validate configuration
function createConfig(): Config {
  const getEnv = (key: string, defaultValue?: string): string => {
    return process.env[key] ?? defaultValue ?? '';
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
      error.issues.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Export sync configuration loader
export const getConfig = createConfig;

// Export schema for external validation
export { configSchema };
