import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { getConfig } from '@dynamic-agency/config';

// Interface for agent creation request
interface AgentCreationRequest {
  specialty: string;
  goal: string;
  task: string;
  agent_type?: string;
}

// Interface for created agent
interface CreatedAgent {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  specialty: string;
  goal: string;
}

// Zod schema for agent creation response
const agentCreationSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    type: z.string(),
    properties: z.object({
      input: z.object({
        type: z.string(),
        description: z.string(),
      }),
    }),
    required: z.array(z.string()).optional(),
  }),
});

// Agent factory function for MCP tool
export async function createAgent(request: AgentCreationRequest): Promise<CreatedAgent> {
  const config = getConfig();

  const llm = new ChatGoogleGenerativeAI({
    model: config.google.model,
    temperature: config.google.temperature,
    apiKey: config.google.apiKey,
  });

  // Use withStructuredOutput to bind the schema to the model
  const modelWithStructure = llm.withStructuredOutput(agentCreationSchema);

  const prompt =
    `You are an agent factory that creates specialized AI agents. Based on the request, create a new agent with the following information:

  Specialty: ${request.specialty}
  Goal: ${request.goal}
  Task: ${request.task}
  Agent Type: ${request.agent_type || 'general'}

  Create an agent with:
  1. A descriptive name (use snake_case)
  2. A clear description of what the agent does
  3. An input schema with a single "input" property that describes what the agent needs
  4. The input property should be relevant to the agent's specialty and task`;

  try {
    // Invoke the model with structured output - no manual JSON parsing needed!
    const agentData = await modelWithStructure.invoke(prompt);

    return {
      ...agentData,
      specialty: request.specialty,
      goal: request.goal,
    };
  } catch (error) {
    console.error('Failed to create agent with structured output:', error);
    throw new Error('Failed to create agent');
  }
}

// Main agent factory function for MCP tool
export async function agentFactory(request: AgentCreationRequest): Promise<CreatedAgent | null> {
  try {
    console.log(`🏭 Creating agent with specialty: ${request.specialty}`);

    // Create the agent
    const agent = await createAgent(request);
    console.log(`✅ Agent created: ${agent.name}`);

    // No HTTP registration; return agent for MCP SDK registration
    return agent;
  } catch (error) {
    console.error('❌ Agent factory error:', error);
    return null;
  }
}
