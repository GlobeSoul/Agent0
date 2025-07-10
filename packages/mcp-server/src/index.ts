/// <reference lib="deno.ns" />

import { main } from './mcp-server.ts';

// Start the MCP server using the official SDK
if (import.meta.main) {
  main();
}
