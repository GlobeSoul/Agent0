/// <reference lib="deno.ns" />

import { getConfig } from '@dynamic-agency/config';

// Main function to test the supervisor graph setup
async function main() {
  try {
    const config = await getConfig();
    console.log('✅ Supervisor Graph package loaded successfully');
    console.log('📊 Configuration:', {
      model: config.google.model,
      temperature: config.google.temperature,
      port: config.server.port,
    });

    console.log('🚀 Supervisor graph ready for MCP tool integration');
    console.log('📋 Next steps:');
    console.log('  1. Implement MCP tool discovery and invocation');
    console.log('  2. Add create_agent MCP tool to server');
    console.log('  3. Build dynamic agent generation and registration');
    console.log('  4. Test end-to-end MCP-based agent creation');
  } catch (error) {
    console.error('❌ Error loading configuration:', error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { main };
