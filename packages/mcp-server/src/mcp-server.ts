/// <reference lib="deno.ns" />

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from '@dynamic-agency/config';
import { agentFactory } from './agent-factory.ts';

// Import the AgentCreationRequest type
interface AgentCreationRequest {
  specialty: string;
  goal: string;
  task: string;
  agent_type?: string;
}

// Type for registered agents
interface RegisteredAgent {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  registeredAt: string;
  status: 'active' | 'inactive';
}

// Module-level registry for dynamic agents
const registeredAgents = new Map<string, RegisteredAgent>();
const AGENTS_FILE = new URL('./agents.json', import.meta.url).pathname;

// Load agents from persistent storage
async function loadAgentsFromFile() {
  try {
    const data = await Deno.readTextFile(AGENTS_FILE);
    const agents: RegisteredAgent[] = JSON.parse(data);
    agents.forEach(agent => {
      registeredAgents.set(agent.name, agent);
    });
    console.log(`✅ Loaded ${agents.length} agents from persistent storage.`);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.log('ℹ️ No agents.json file found, starting with empty registry.');
    } else {
      console.error('❌ Failed to load agents from file:', err);
    }
  }
}

// Save agents to persistent storage
async function saveAgentsToFile() {
  try {
    const agents = Array.from(registeredAgents.values());
    await Deno.writeTextFile(AGENTS_FILE, JSON.stringify(agents, null, 2));
    console.log('💾 Agents saved to persistent storage.');
  } catch (err) {
    console.error('❌ Failed to save agents to file:', err);
  }
}

// Create MCP server instance
const server = new Server(
  {
    name: 'dynamic-agency-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Built-in create_agent tool
const createAgentTool = {
  name: 'create_agent',
  description:
    'Dynamically create and register a new agent as an MCP tool. This tool allows you to create specialized agents for different tasks like data analysis, code review, documentation, or any other specific domain. Once created, the agent becomes available as a tool for future use.',
  inputSchema: {
    type: 'object',
    properties: {
      specialty: {
        type: 'string',
        description:
          "Agent's specialty area (e.g., 'data analysis', 'code review', 'documentation', 'testing', 'optimization')",
      },
      goal: {
        type: 'string',
        description:
          "Agent's primary goal or objective (e.g., 'process CSV files', 'identify bugs', 'generate documentation')",
      },
      task: {
        type: 'string',
        description:
          "Specific task the agent should accomplish (e.g., 'analyze data and create charts', 'review TypeScript code for issues', 'write API documentation')",
      },
      agent_type: {
        type: 'string',
        description:
          "Type of agent (optional, defaults to 'general'). Examples: 'analyst', 'reviewer', 'writer', 'tester'",
      },
    },
    required: ['specialty', 'goal', 'task'],
  },
};

// Register the create_agent tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [
    createAgentTool,
    // Add dynamically registered agents
    ...Array.from(registeredAgents.values()).map((agent) => ({
      name: agent.name,
      description: agent.description,
      inputSchema: agent.inputSchema,
    })),
  ];

  return {
    tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'create_agent') {
      console.log('🏭 Creating agent via MCP tool:', args);

      // Validate args
      if (!args || typeof args !== 'object') {
        throw new Error('Invalid arguments for create_agent');
      }

      // Call agent factory with validated args
      const agent = await agentFactory(args as unknown as AgentCreationRequest);
      if (!agent) {
        throw new Error('Agent creation failed');
      }

      // Register agent in the in-memory registry
      registeredAgents.set(agent.name, {
        name: agent.name,
        description: agent.description,
        inputSchema: agent.inputSchema,
        registeredAt: new Date().toISOString(),
        status: 'active',
      });
      await saveAgentsToFile();

      console.log('✅ Agent created and registered:', agent.name);

      return {
        content: [
          {
            type: 'text',
            text: `Agent '${agent.name}' created and registered successfully as a tool.`,
          },
        ],
        isError: false,
      };
    }

    // Handle dynamically registered agents
    const registeredAgent = registeredAgents.get(name);
    if (registeredAgent) {
      console.log(`🔧 Invoking registered agent: ${name}`, args);

      // For now, return a placeholder response
      // In the future, this would execute the actual agent logic
      return {
        content: [
          {
            type: 'text',
            text: `Agent '${name}' executed with args: ${JSON.stringify(args)}`,
          },
        ],
        isError: false,
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    console.error('❌ Tool execution error:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Main function to start the MCP server
async function main() {
  try {
    await loadAgentsFromFile();
    const config = await getConfig();
    console.log('✅ MCP Server package loaded successfully');
    console.log('📊 Configuration:', {
      port: config.server.port,
      apiKey: config.server.apiKey ? '***' : 'not set',
    });

    console.log('🚀 Starting MCP server with official SDK...');

    // Create transport and start server
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.log('✅ MCP server started successfully');
    console.log('📋 Available tools: create_agent + dynamic agents');
  } catch (error) {
    console.error('❌ Error starting MCP server:', error);
    Deno.exit(1);
  }
}

export { main, server };
