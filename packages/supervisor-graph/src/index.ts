import { getConfig } from '@dynamic-agency/config';

// Main function to test the supervisor graph setup
async function main() {
  try {
    const config = getConfig();
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
    process.exit(1);
  }
}

// Check if this module is the main module for Node.js
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { main };
