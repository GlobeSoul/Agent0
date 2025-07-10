# **Dynamic Agency: An Architectural Guide to Self-Expanding, Supervisor-Driven Workflows with LangGraph-TypeScript and MCP**

## **Introduction**

The prevailing paradigm in multi-agent systems has largely centered on predefined teams of specialized AI agents, orchestrated to solve complex but bounded problems. While powerful, these static architectures face a fundamental limitation: their capabilities are fixed at design time. When confronted with novel tasks that fall outside the expertise of the existing team, they are unable to adapt. This report details an architectural blueprint for the next frontier in agentic systems: dynamic, self-expanding workflows. We will move beyond static teams to design a system capable of autonomous evolution, where a supervisor agent can reason about its own capability gaps and dynamically provision new, specialized worker agents to meet emerging demands.

The central thesis of this guide is that the confluence of three key technologies enables this new paradigm. First, a controllable, graph-based runtime, for which we will use langgraph-typescript, provides the low-level primitives necessary for building stateful, cyclical, and observable agentic workflows.2 Second, a dynamic agent provisioning mechanism, which we will formalize as the "Agent Factory" pattern, encapsulates the logic for creating new agents as a standard tool. Third, a standardized and, crucially,

_mutable_ tool interface, implemented as a custom Model Context Protocol (MCP) server, allows these newly created agents to be exposed and discovered at runtime.4

This report provides a definitive, code-first blueprint for a system where a supervisor agent, upon identifying a task it cannot delegate, can commission the creation of a new worker agent. This new agent is then programmatically compiled and registered as a discoverable tool on a live MCP server, instantly expanding the supervisor's capabilities without requiring a restart or redeployment. By explicitly avoiding higher-level, vendor-specific abstractions like the OpenAI Agents SDK or Google's ADK, we will construct this system from first principles, offering unparalleled control, transparency, and interoperability.2 This guide is intended for advanced AI engineers seeking to build the next generation of robust, autonomous, and production-grade agentic systems.

## **Section 1: Architectural Foundations of Dynamic Multi-Agent Systems**

Before delving into implementation, it is imperative to establish a firm understanding of the three architectural pillars upon which our dynamic system is built. Each component—the orchestration framework, the coordination pattern, and the interoperability protocol—is chosen specifically to foster a system that is both powerful and fundamentally open. This choice reflects a deliberate architectural philosophy favoring control, transparency, and model-agnosticism over the convenience of proprietary, black-box solutions.2 A system built on open and extensible primitives is not merely a technical preference; it is a strategic decision to create a future-proof platform that can evolve independently of any single vendor's ecosystem.

### **1.1 The LangGraph State Machine: Orchestration as a Graph**

LangGraph is a library for building stateful, multi-actor applications by modeling their logic as a graph.7 Its fundamental departure from linear chain-based frameworks is its native support for cycles, a feature that is indispensable for implementing the iterative reasoning loops characteristic of most agentic architectures.9

State Management
At the core of any LangGraph application is the State object. This is a shared data structure, a "short-term memory" or "shared workspace" that is passed between all nodes in the graph.11 Each node can read from and write to this state, allowing context to persist and evolve throughout a workflow. In
langgraph-typescript, we define this state schema using Annotation, which provides a typed structure and allows for custom reducer functions to govern how state updates are applied.7 For instance, a common pattern is to define a

messages channel with a reducer that appends new messages to the history rather than overwriting it, ensuring a complete conversational record is maintained.7

TypeScript

import { Annotation, BaseMessage } from "@langchain/langgraph";
import { addMessages } from "@langchain/langgraph/prebuilt";

// A typical state schema for a chat-based agent system.
export const StateAnnotation \= Annotation.Root({
messages: Annotation\<BaseMessage\>({
reducer: addMessages, // Appends new messages to the list
}),
// Other state fields can be added here
next: Annotation\<string\>(),
});

Nodes and Edges
The computational logic of the graph is encapsulated in Nodes. A node is typically an asynchronous function that receives the current state, performs an operation (such as calling an LLM, executing a tool, or performing data manipulation), and returns a partial state update.14
Edges define the control flow, directing the execution from one node to the next.7

The primary class for constructing a workflow is StateGraph. We use its addNode method to register our functional actors and addEdge to define static, unconditional transitions between them.7

Conditional Routing
The true power of LangGraph for building intelligent agents is realized through conditional routing. The addConditionalEdges method allows the control flow to branch based on the output of a dedicated router function.17 This router function inspects the current state—often the output of a preceding LLM-powered node—and decides which node to execute next. This mechanism is what empowers our supervisor agent to make dynamic decisions, transforming the graph from a static flowchart into a dynamic, reasoning system.14

### **1.2 The Hierarchical Supervisor Pattern: Command and Control**

To manage the complexity of a multi-agent system, we employ a hierarchical supervisor pattern. This proven architectural pattern organizes agents into a command structure where a central "supervisor" agent coordinates a team of specialized "worker" agents.1 The supervisor is the sole entry point for user requests and is responsible for all task decomposition, delegation, and communication flow, while workers focus exclusively on their assigned sub-tasks.21

Implementation in LangGraph
In our LangGraph implementation, the supervisor is a dedicated node whose primary function is to use an LLM to reason about the user's request and the capabilities of its team.18 The system prompt for this supervisor LLM is critical; it must be instructed to analyze the task and select the most appropriate worker (or sequence of workers) to handle it.21 The workers are also nodes within the same graph.
The decision-making process is orchestrated as follows:

1. The supervisor node is invoked. It calls an LLM to determine the next action.
2. The LLM's output (e.g., a JSON object specifying the next agent and task) updates the graph's state.
3. A conditional edge connected to the supervisor node reads the state and routes the workflow to the chosen worker node.
4. The worker node executes its sub-task.
5. Crucially, every worker node has a static edge that routes control _back_ to the supervisor node upon completion. This creates the fundamental supervisor-worker loop, allowing the supervisor to review the worker's output and plan the next step.1

Agents as Tools
A powerful abstraction within this pattern is to treat subordinate agents as tools available to the supervisor.24 Instead of complex routing logic, the supervisor's prompt can simply instruct the LLM to call a tool corresponding to the desired worker. For example, a
delegate\_to\_researcher tool can be exposed. When the LLM calls this tool, the graph executes the researcher agent's node. This simplifies the supervisor's cognitive load and makes the system more modular. While the langgraph-supervisor Python library provides a create\_handoff\_tool helper for this 22, we will construct this mechanism from first principles in TypeScript.

### **1.3 The Model Context Protocol (MCP): A Universal Tool Bus**

The Model Context Protocol (MCP) is an open-source standard, originated by Anthropic, designed to create a universal interface between AI models and external systems.26 It functions as a standardized "plug" that allows any MCP-compliant agent to discover and interact with any MCP-compliant tool, eliminating the need for bespoke, brittle integrations for every new tool or data source.29

Client-Server Architecture
MCP is based on a client-server architecture. An MCP Server is a service that exposes a set of capabilities—tools, resources, or prompts. An MCP Client, which can be embedded within an AI agent or application, connects to one or more servers to consume these capabilities.31 This separation of concerns is powerful: a tool provider can build an MCP server for their service once, and any AI agent from any framework can then use it.
Key Operations
The protocol standardizes several key interactions, most notably tools/list and tools/call.32

- tools/list: A client sends this request to a server to discover the set of tools it offers, including their names, descriptions, and input schemas.
- tools/call: After discovering a tool, the client uses this request to execute it, passing the required arguments. The server performs the action and returns the result in a standardized format.

Significance for Our Architecture
While LangGraph has a native ToolNode for handling tool calls within a closed graph, integrating MCP elevates our system from a self-contained application to an open, interoperable platform. By exposing our dynamically created agents as tools via a custom MCP server, we make their capabilities available to any external MCP-compliant system. This is the key to building a truly extensible and collaborative agent ecosystem, rather than a monolithic, isolated one.

## **Section 2: Implementation of the Core Supervisor Graph**

With the architectural principles established, we now turn to the practical implementation of the core supervisor graph in TypeScript. This initial implementation will feature a static team of worker agents, providing a solid foundation upon which we will later build the dynamic creation capabilities. A critical design choice here is the management of state. A naive approach might allow worker agents to directly modify a single, global state object. However, a more robust and modular architecture treats each worker agent as an encapsulated "subgraph".33 The supervisor is responsible for passing only the necessary context to the worker's subgraph. The worker operates on its own internal state and, upon completion, returns a clean, structured output. The supervisor then integrates this result back into the main state. This enforces a clean separation of concerns, prevents state corruption, and makes individual agents far more testable and reusable.

### **2.1 Defining the Supervisor's State Schema**

The state is the lifeblood of the graph. We will define a comprehensive SupervisorState using Annotation to ensure type safety and control how updates are merged.

TypeScript

import { Annotation, BaseMessage, CompiledStateGraph } from "@langchain/langgraph";
import { addMessages } from "@langchain/langgraph/prebuilt";

// The state schema for our supervisor graph.
export const SupervisorStateAnnotation \= Annotation.Root({
// The full conversation history. \`addMessages\` ensures new messages are appended.
messages: Annotation\<BaseMessage\>({
reducer: addMessages,
}),
// A registry to hold the compiled graphs of the current worker agents.
// This is key for our dynamic architecture.
team: Annotation\<Record\<string, CompiledStateGraph\>\>({
reducer: (
current: Record\<string, CompiledStateGraph\>,
next: Record\<string, CompiledStateGraph\>
) \=\> ({...current,...next }),
default: () \=\> ({}),
}),
// The name of the next agent to be invoked, determined by the supervisor.
next: Annotation\<string\>(),
// The specific sub-task delegated to the worker agent.
currentUserRequest: Annotation\<string\>(),
});

// For convenience, we can export the inferred type.
export type SupervisorState \= typeof SupervisorStateAnnotation.State;

### **2.2 The Supervisor Node: The Brain of the Operation**

The supervisor node is where the primary decision-making occurs. It's an async function that takes the current SupervisorState as input, constructs a prompt for an LLM, and parses the response to determine the next step in the workflow.

Prompt Engineering
The prompt is the most critical component of the supervisor's logic. It must clearly define the supervisor's role, the available tools (which, in this architecture, represent the worker agents), and the required output format.

TypeScript

// Example prompt construction within the supervisor node
const constructSupervisorPrompt \= (state: SupervisorState): string \=\> {
const teamMembers \= Object.keys(state.team);
const toolDescriptions \= \`
You have the following agents at your disposal:
${teamMembers.map(agentName \=\> \`- ${agentName}\`).join('\\n')}

    \- FINISH: Use this action when the user's request has been fully addressed.
    \- create\_agent: Use this action when no existing agent can handle the task. Specify the 'specialty' and 'goal' for the new agent.

\`;

return \`You are a supervisor managing a team of AI agents. Your job is to analyze the user's request and delegate it to the appropriate agent or create a new one if necessary.

${toolDescriptions}

Based on the following conversation, decide the next action.
Conversation History:
${state.messages.map(m \=\> \`${m.\_getType()}: ${m.content}\`).join('\\n')}

Respond with a JSON object matching the required schema.\`;
};

Structured Output with Zod
To ensure the LLM's response is predictable and machine-readable, we will enforce a structured output using its tool-calling capabilities or JSON mode, validated against a Zod schema.35 This schema defines the supervisor's possible decisions.

TypeScript

import { z } from "zod";

// Zod schema for the supervisor's decision
const supervisorDecisionSchema \= z.union();

The supervisor node will then invoke the LLM with this schema, parse the result, and update the next and currentUserRequest fields in the state to drive the graph's next transition.

### **2.3 The Router: Implementing Conditional Control Flow**

The router is a simple function that implements the conditional logic of the graph. It reads the next field from the state, which was set by the supervisor, and returns a string indicating which node to execute next.18

TypeScript

import { END } from "@langchain/langgraph";

// The router function for the conditional edge.
const route \= (state: SupervisorState): string \=\> {
const { next } \= state;
if (next \=== "FINISH") {
return END;
}
if (next \=== "create\_agent") {
// We will implement this node in Section 3
return "agent\_factory";
}
// Route to the specified worker agent
if (state.team\[next\]) {
return next;
}
// Fallback or error handling
return END;
};

// In the graph definition:
// workflow.addConditionalEdges("supervisor", route, {
// ...mapping of agent names to node names...
// "agent\_factory": "agent\_factory",
// : END,
// });

This function is connected to the supervisor node via workflow.addConditionalEdges, with a mapping that connects the output strings ("agent\_factory", "researcher", etc.) to their corresponding nodes in the graph.15

### **2.4 Worker Agents as Nodes**

Initially, we will define a static team. Each worker agent is a self-contained, compiled LangGraph, which we then wrap in a node function for integration into the main supervisor graph. This wrapper approach is crucial for maintaining modularity.20

TypeScript

import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily\_search";
import { ChatOpenAI } from "@langchain/openai";

// 1\. Create a standalone worker agent (e.g., a researcher)
const researchTool \= new TavilySearchResults({ maxResults: 2 });
const researchModel \= new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
const researcherAgent \= createReactAgent({
llm: researchModel,
tools:,
// Checkpointer is omitted here; only the top-level graph has one.
});

// 2\. Create a wrapper node function for the supervisor graph
const createWorkerNode \= (agent: CompiledStateGraph, name: string) \=\> {
return async (state: SupervisorState): Promise\<Partial\<SupervisorState\>\> \=\> {
const { currentUserRequest } \= state;
// Invoke the worker agent's graph with the specific sub-task
const result \= await agent.invoke({
messages:,
});
// Format the output as a ToolMessage to maintain a clean history
const finalResponse \= result.messages\[result.messages.length \- 1\];
return {
messages:,
};
};
};

const researcherNode \= createWorkerNode(researcherAgent, "researcher");

// 3\. Add the worker to the graph
// workflow.addNode("researcher", researcherNode);
// workflow.addEdge("researcher", "supervisor"); // Always report back to the supervisor

This pattern ensures that the worker agent operates on a clean slate (new HumanMessage(currentUserRequest)), preventing it from accessing or corrupting the supervisor's full state. Its final output is neatly packaged as a ToolMessage, which the supervisor can then parse in the next cycle. This completes the robust, encapsulated loop: Supervisor \-\> Router \-\> Worker \-\> Supervisor.

## **Section 3: The Agent Factory: A Pattern for Dynamic Creation**

The ability to dynamically create new agents is the cornerstone of a truly adaptive system. Instead of hard-coding a fixed team, the supervisor can commission new specialists as needed. We achieve this through the "Agent Factory" pattern: a dedicated tool that encapsulates the logic for programmatic agent creation. This approach is superior to granting the supervisor direct, "god-like" access to modify its own runtime, as it maintains a clean separation of concerns and treats agent creation as a standard, observable action.6

### **3.0 MCP Tool Approach (Recommended Implementation)**

The most elegant approach is to implement the Agent Factory as an MCP tool itself. This provides several advantages:

1. **Standardized Interface**: The `create_agent` tool follows MCP standards for input/output schemas
2. **Dynamic Discovery**: New agents are immediately available as MCP tools
3. **Interoperability**: Any MCP-compliant system can use the created agents
4. **Scalability**: Multiple supervisors can share the same agent creation system

**Implementation Strategy:**

- Create a `create_agent` MCP tool that takes agent specifications
- Use dynamic code generation to create agent implementations
- Auto-register created agents as new MCP tools
- Enable immediate invocation through the MCP protocol

This approach transforms the Agent Factory from a hardcoded component into a discoverable, reusable MCP tool that any supervisor can leverage.

### **3.1 The "Agent Factory" as a Supervisor's Tool**

The supervisor's interaction with the agent creation process is mediated through a simple tool call. When the supervisor's LLM determines that none of the existing agents in its team are suitable for a given task, it will formulate a call to the create\_agent tool.

The tool's interface is defined using a Zod schema, which provides a structured contract for the supervisor to follow. This ensures that the supervisor provides all the necessary information to construct the new agent.

TypeScript

import { z } from "zod";

// Zod schema for the input of the create\_agent tool
export const agentCreationSchema \= z.object({
specialty: z.string().describe("A concise description of the new agent's area of expertise. E.g., 'Financial Analyst' or 'Python Code Interpreter'."),
goal: z.string().describe("A clear, actionable goal for the new agent. E.g., 'Analyze quarterly earnings reports and extract key metrics.'"),
tools: z.array(z.string()).describe("A list of tool names the new agent should have access to from the central tool registry. E.g., \['tavily\_search\_results\_json', 'python\_repl'\]."),
});

This schema-driven approach allows the supervisor to declaratively specify the new agent's persona (specialty), its objective (goal), and its capabilities (tools).

### **3.2 Programmatic Graph Generation in TypeScript**

The create\_agent tool is backed by an async function, the "Agent Factory," which programmatically constructs and compiles a new LangGraph instance at runtime. This leverages a powerful but less commonly documented feature of LangGraph: the ability to design and compile graphs dynamically based on runtime inputs.40

TypeScript

import { StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool as createLangChainTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { MessagesAnnotation, END, START } from "@langchain/langgraph";

// A central registry of all possible tools the factory can assign
const toolRegistry \= {
tavily\_search\_results\_json: new TavilySearchResults({ maxResults: 2 }),
// python\_repl: new PythonREPL(), // Example of another tool
};

// The Agent Factory function
export async function createWorkerAgent(config: z.infer\<typeof agentCreationSchema\>) {
const { specialty, goal, tools: toolNames } \= config;

// 1\. Select tools from the registry
const selectedTools \= toolNames.map(name \=\> {
if (\!toolRegistry\[name\]) {
throw new Error(\`Tool "${name}" not found in registry.\`);
}
return toolRegistry\[name\];
});

// 2\. Configure the LLM for the new agent
const llm \= new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
const modelWithTools \= llm.bindTools(selectedTools);

// 3\. Define the agent's state and nodes
const agentState \= MessagesAnnotation;
const agentNode \= async (state) \=\> ({ messages: });
const toolNode \= new ToolNode(selectedTools);

// 4\. Define the routing logic
const shouldContinue \= (state) \=\> {
const lastMessage \= state.messages\[state.messages.length \- 1\];
return lastMessage.tool\_calls?.length? "tools" : END;
};

// 5\. Build and compile the new graph
const workflow \= new StateGraph({ channels: agentState })
.addNode("agent", agentNode)
.addNode("tools", toolNode);

workflow.addEdge(START, "agent");
workflow.addConditionalEdges("agent", shouldContinue, {
tools: "tools",
: END,
});
workflow.addEdge("tools", "agent");

const newAgentGraph \= workflow.compile();

// Return the compiled graph and its configuration
return {
graph: newAgentGraph,
name: specialty.toLowerCase().replace(/\\s+/g, '\_'),
description: goal,
};
}

This factory function is the heart of the system's dynamic nature. It takes a declarative configuration and translates it into a fully functional, compiled agent graph, ready for execution.

### **3.3 Persisting and Registering Dynamic Agents**

A significant challenge with programmatically generated graphs is persistence. A compiled LangGraph object is an in-memory entity containing functions and closures, which cannot be reliably serialized to a format like JSON for storage in a database.41 Attempting to do so would lose the function logic, rendering the deserialized object useless.

The solution is to **store the agent's configuration, not its compiled state**. The Agent Factory does not try to save the newAgentGraph object. Instead, its responsibilities after compilation are:

1. **Store Configuration:** It persists the agent's blueprint—its name, specialty, goal, and list of tool names—to a simple configuration store (for this guide, a local JSON file will suffice; in production, this would be a database). This blueprint contains all the information needed to _re-create_ the agent later.
2. **Register with MCP Server:** It makes an authenticated API call to a custom /register-agent endpoint on our MCP server. This informs the server that a new tool, representing the newly created agent, is now available for discovery by external clients.
3. **Update Supervisor's State:** It returns a success message to the supervisor, which then updates its own in-memory team registry. This makes the new agent immediately available for delegation within the current, ongoing workflow.

This approach ensures that while the compiled graph objects are ephemeral, their underlying definitions are durable and can be used to re-instantiate them whenever needed.

### **Table: Supervisor Routing & Creation Logic**

To make the supervisor's complex decision-making process transparent, the following table illustrates how different user queries can lead to either delegation or the creation of a new agent. This clarifies the expected behavior of the supervisor's LLM.

| User Query Example                                                                  | LLM's Reasoning (Chain of Thought)                                                                                                                                                                                                                                     | Supervisor's Structured Output (JSON)                                                                                                                                                | Resulting Action in Graph     |
| :---------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- |
| "What was the weather in New York yesterday?"                                       | The query is about a past event. The researcher agent is best suited for web searches. I will delegate this task to the researcher.                                                                                                                                    | { "action": "delegate", "agent": "researcher", "task": "Find the weather in New York for yesterday." }                                                                               | Route to researcher node.     |
| "Calculate the square root of 529."                                                 | This is a mathematical calculation. I have a calculator agent for this. I will delegate.                                                                                                                                                                               | { "action": "delegate", "agent": "calculator", "task": "Calculate sqrt(529)" }                                                                                                       | Route to calculator node.     |
| "Analyze the sentiment of our latest customer reviews and create a summary report." | This is a complex task. I don't have a 'Sentiment Analyst' or 'Report Writer'. I need to create a new agent for this. The specialty will be 'Sentiment Analysis' and the goal will be to process text and identify sentiment. It will need a web search tool to start. | { "action": "create\_agent", "specialty": "Sentiment Analyst", "goal": "Analyze text to determine sentiment and summarize findings.", "tools": \["tavily\_search\_results\_json"\] } | Route to agent\_factory node. |
| "Thank you, that's all I need."                                                     | The user's request is complete. The conversation can end.                                                                                                                                                                                                              | { "action": "FINISH" }                                                                                                                                                               | Route to END.                 |

This table serves as both a design specification and a debugging tool, clearly mapping user intent to the supervisor's programmatic actions.

## **Section 4: Engineering a Runtime-Mutable MCP Server**

With the agent creation logic defined, we now need a mechanism to expose these dynamically created agents as tools to the outside world. The Model Context Protocol (MCP) provides the standard for this, but a standard MCP server implementation with a static tool list is insufficient. Our architecture requires a server whose list of available tools can be modified _at runtime_. This section details the engineering of such a server using TypeScript, Express.js, and the @modelcontextprotocol/sdk.

### **4.1 Server Scaffolding with TypeScript, Express, and MCP SDK**

We begin by setting up a standard Node.js project with Express for handling HTTP requests. The @modelcontextprotocol/sdk provides the core McpServer class that we will use to handle the protocol-level communication.44

TypeScript

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { McpServer, HttpSseTransport } from '@modelcontextprotocol/sdk/server';

const app \= express();
app.use(express.json());

const server \= http.createServer(app);

// Initialize the MCP Server
const mcpServer \= new McpServer({
name: "DynamicAgentServer",
version: "1.0.0",
});

// Set up the SSE transport for remote clients
const sseTransport \= new HttpSseTransport({ server: app, path: "/mcp/sse" });
mcpServer.connect(sseTransport);

//... (API endpoints and tool handlers will be added here)

const PORT \= process.env.PORT |

| 8080;
server.listen(PORT, () \=\> {
console.log(\`MCP Server running on port ${PORT}\`);
});

This boilerplate establishes an Express server and connects an McpServer instance to an SSE (Server-Sent Events) endpoint, which is the standard transport mechanism for remote MCP clients.46

### **4.2 The Dynamic Tool Registry**

The critical innovation in our server is a dynamic tool registry. Standard examples often define a static list of tools when the server starts. Instead, we will create a ToolManager class that holds the list of available tools in memory, allowing it to be modified after the server has started. This concept is demonstrated effectively in the dynamic-mcp-server project, which showcases how to build a server where tools can be added, removed, and authorized at runtime.4

TypeScript

import { Tool } from '@modelcontextprotocol/sdk/server';

// A simple in-memory tool registry
class ToolManager {
private tools: Map\<string, Tool\> \= new Map();

// Method to register a new tool at runtime
registerTool(tool: Tool) {
this.tools.set(tool.name, tool);
console.log(\`Tool registered: ${tool.name}\`);
}

// Method to get the list of all currently registered tools
getTools(): Tool {
return Array.from(this.tools.values());
}
}

export const toolManager \= new ToolManager();

// Implement the MCP server's list\_tools handler to use the manager
mcpServer.on("tools/list", async () \=\> {
return { tools: toolManager.getTools() };
});

By implementing the tools/list handler to query our ToolManager, the list of tools advertised to clients is no longer static; it reflects the current state of our dynamic registry.

### **4.3 The Custom /register-agent Endpoint**

This custom API endpoint is the bridge between our Agent Factory (from Section 3\) and the MCP server. When the factory creates a new agent, it will call this endpoint to make the agent discoverable as a tool.

TypeScript

// A simple API key authentication middleware
const apiKeyAuth \= (req, res, next) \=\> {
const apiKey \= req.headers\['authorization'\]?.split(' ')\[1\];
if (apiKey && apiKey \=== process.env.MCP\_SERVER\_API\_KEY) {
return next();
}
res.status(401).send('Unauthorized');
};

// The custom endpoint for registering new agents as tools
app.post('/register-agent', apiKeyAuth, (req, res) \=\> {
const { name, description, inputSchema } \= req.body;

if (\!name ||\!description ||\!inputSchema) {
return res.status(400).send('Missing required fields: name, description, inputSchema');
}

// Create a tool definition compliant with the MCP SDK
const newTool: Tool \= {
name,
description,
inputSchema, // Zod schema should be converted to JSON Schema format
};

toolManager.registerTool(newTool);

// Optionally, notify connected clients of the change
mcpServer.notify("notifications/tools/list\_changed", {});

res.status(201).send({ message: \`Agent '${name}' registered successfully as a tool.\` });
});

This endpoint is protected by a simple API key middleware to prevent unauthorized modification of the tool list.47 It accepts the new agent's metadata, creates an MCP-compliant

Tool definition, and registers it with our ToolManager. The call to mcpServer.notify is a best practice that leverages a built-in MCP feature to inform connected clients that the tool list has been updated, enabling them to re-fetch the list without polling.32

### **4.4 The call\_tool Invocation Bridge**

This handler is the most complex piece of the server. It is responsible for receiving a tools/call request from a client and invoking the corresponding LangGraph agent.

TypeScript

import { MemorySaver } from "@langchain/langgraph";

// In-memory checkpointer for managing graph states
const checkpointer \= new MemorySaver();

// A map to hold our compiled agent graphs
const agentRegistry: Record\<string, CompiledStateGraph\> \= {};
// Note: In production, this would be populated by re-hydrating agents from the config DB.

mcpServer.on("tools/call", async (request) \=\> {
const { name, input, context } \= request;
const { thread\_id } \= context; // Assume client passes a thread\_id for statefulness

const agentGraph \= agentRegistry\[name\];
if (\!agentGraph) {
return { isError: true, content: };
}

try {
const config \= { configurable: { thread\_id } };

    // Invoke the LangGraph agent
    const result \= await agentGraph.invoke({ messages: }, config);

    const finalMessage \= result.messages\[result.messages.length \- 1\];

    return {
      content: \[{ type: "text", text: finalMessage.content as string }\],
    };

} catch (error) {
console.error(\`Error invoking agent ${name}:\`, error);
return { isError: true, content: \[{ type: "text", text: \`Error executing tool '${name}'.\` }\] };
}
});

This handler acts as the crucial link between the public-facing MCP protocol and the internal LangGraph runtime. It looks up the requested agent graph, uses the provided thread\_id to ensure stateful execution via the checkpointer, invokes the graph, and formats the final response back into the MCP-specified structure.49

### **4.5 Securing the Server**

While our example uses a simple API key for the registration endpoint, a production system would require more robust security.

- **Authentication:** The custom /register-agent endpoint must be secured. Our API key middleware is a basic first step.51
- **Authorization:** The MCP specification provides a comprehensive authorization framework based on OAuth 2.1.53 This allows for fine-grained control over which clients can access which tools. For more advanced scenarios, a centralized authorization layer like Cerbos can be used to dynamically control tool availability based on user roles and contextual data, preventing agents from even seeing tools they are not permitted to use.54

### **Table: MCP Server API Endpoints**

This table provides a clear reference for developers interacting with our custom MCP server.

| Endpoint        | HTTP Method | Description                                                         | Authentication         | Request Body Schema (JSON)                                       | Success Response                                      |
| :-------------- | :---------- | :------------------------------------------------------------------ | :--------------------- | :--------------------------------------------------------------- | :---------------------------------------------------- |
| /mcp/sse        | GET         | Establishes a Server-Sent Events connection for MCP communication.  | None                   | N/A                                                              | SSE stream of MCP messages.                           |
| /register-agent | POST        | Dynamically registers a new agent as a callable tool on the server. | Bearer Token (API Key) | { "name": string, "description": string, "inputSchema": object } | 201 Created with { "message": "Agent registered..." } |

This documentation clarifies the server's interface, separating the standard protocol endpoint from our custom administrative endpoint.

## **Section 5: Weaving It All Together: End-to-End Integration**

Having constructed the individual components—the supervisor graph, the agent factory, and the dynamic MCP server—we now integrate them into a single, cohesive system. This section traces the complete data and control flow, from an initial user query to the dynamic creation and subsequent invocation of a new agent, demonstrating the power of this self-expanding architecture.

### **5.1 The Full Registration and Invocation Workflow**

The end-to-end process showcases a remarkable level of autonomy. The system doesn't just execute predefined steps; it reasons about its own limitations and actively works to overcome them.

1. **User Request & Supervisor Decision:** A user interacts with a client connected to our MCP server. The query is forwarded to the supervisor agent. Let's assume the query is, "Please analyze the stock performance of TSLA and provide a summary." The supervisor, knowing it only has researcher and calculator agents, determines no existing agent can perform "stock performance analysis".56 Its LLM generates a structured output to call the
   create\_agent tool with a configuration like { specialty: 'Stock Analyst', goal: 'Analyze stock ticker data and provide summaries.', tools: \['tavily\_search\_results\_json'\] }.
2. **Agent Factory Execution:** The supervisor graph routes to the agent\_factory node. This node executes the createWorkerAgent function from Section 3.2. It programmatically generates the new "Stock Analyst" agent's graph and compiles it in memory.
3. **MCP Registration:** The agent\_factory then makes an authenticated POST request to the MCP server's /register-agent endpoint. The request body contains the new agent's name (stock\_analyst), its description, and its input schema (e.g., { "ticker": "string" }). The MCP server's ToolManager adds this new tool to its dynamic registry.
4. **Supervisor Update & Delegation:** The factory returns a success message to the supervisor. The supervisor's state is updated to reflect that stock\_analyst is now a member of the team. On its very next reasoning cycle, the supervisor sees the original request again. This time, it recognizes that the new stock\_analyst agent is perfectly suited for the task. It generates a new decision: { action: 'delegate', agent: 'stock\_analyst', task: 'Analyze TSLA' }.
5. **Invocation:** The graph now routes to the stock\_analyst node, which successfully executes the task.

This entire sequence—identifying a need, creating a solution, and applying that solution—happens within a single, continuous workflow, driven by the supervisor's reasoning. This is a profound leap beyond static agent teams, demonstrating a system that can modify its own capabilities at runtime.40 It is not merely a tool-user; it is a user of a

_meta-tool_ (the Agent Factory) whose purpose is to forge new tools, creating a powerful feedback loop where a capability gap triggers the creation of that very capability.

### **5.2 Stateful Invocation Across the System Boundary**

Statefulness is what transforms a series of disconnected API calls into a coherent conversation. The thread\_id is the "golden thread" that maintains this coherence across the entire distributed system.11

When an external client first initiates a conversation, it should generate a unique thread\_id (e.g., a UUID). This ID must be passed along with every subsequent tools/call request to the MCP server for that conversation. The MCP server's call\_tool handler (Section 4.4) receives this thread\_id and includes it in the configurable object when invoking the LangGraph agent: graph.invoke(..., { configurable: { thread\_id: '...' } }).49

This thread\_id is the key that the LangGraph checkpointer (e.g., AsyncSqliteSaver or MemorySaver) uses to load and save the correct conversation state from its persistence layer.57 This ensures that when the

stock\_analyst agent is invoked, it has access to the full history of the conversation that led to its creation and delegation. This mechanism enables durable, resumable execution, allowing workflows to be paused (e.g., for human-in-the-loop approval) and resumed later without losing context.59

### **5.3 Architectural Diagram: The Complete Picture**

The following diagram illustrates the complete, multi-layered architecture, tracing both the agent registration and invocation flows.

Code snippet

graph TD
subgraph Client
A\[External MCP Client\]
end

    subgraph "MCP Server (Express.js)"
        B
        C
        D
        E\[call\_tool Handler\]
        F\[API Key Auth\]
        C \-- "Updates" \--\> D
        B \-- "tools/list" \--\> D
        B \-- "tools/call" \--\> E
    end

    subgraph "LangGraph Runtime"
        G
        H
        I
        J\[Agent Factory Node\]
        K
        L
        M
    end

    subgraph "External Services"
        N\[LLM API\]
        O
        P
    end

    %% Invocation Flow
    A \-- "1. User Query (tools/call)" \--\> B
    E \-- "2. Invoke Supervisor Graph" \--\> G
    G \-- "3. State" \--\> M
    H \-- "4. LLM Call" \--\> N
    N \-- "5. Decision" \--\> H
    H \-- "6. Update State" \--\> G
    G \-- "7. Route" \--\> I
    I \-- "8a. Delegate to Worker" \--\> K
    K \-- "9a. Invoke Worker Graph" \--\> O
    O \-- "10a. Result" \--\> K
    K \-- "11a. Report to Supervisor" \--\> H

    %% Registration Flow
    I \-- "8b. Route to Factory" \--\> J
    J \-- "9b. Create & Compile Agent" \--\> L
    J \-- "10b. Save Agent Config" \--\> P
    J \-- "11b. Register via API" \--\> C
    F \-- "Authenticates" \--\> C
    J \-- "12b. Report to Supervisor" \--\> H

This diagram visually synthesizes the entire system. The **Invocation Flow** (blue arrows, not colored in mermaid) shows a standard delegation loop. The **Registration Flow** (red arrows, not colored in mermaid) illustrates the novel, self-expanding capability, where the system's own logic (Agent Factory) calls back into its public interface (/register-agent) to modify its set of available tools.

### **5.4 Complete Code Walkthrough**

A complete, runnable version of this project would be organized into a monorepo with distinct packages for the server and the graph logic.

- /packages/mcp-server: Contains the Express.js application, the ToolManager, the API endpoints, and the call\_tool bridge.
- /packages/supervisor-graph: Contains the LangGraph implementation, including the SupervisorState definition, the supervisor and worker node functions, the Agent Factory, and the initial agent configurations.
- docker-compose.yml: At the root, to orchestrate the services for local development.

The code would be heavily commented, linking implementation details back to the architectural concepts discussed in this report, providing a clear and replicable blueprint for developers.

## **Section 6: Production-Grade Considerations**

Transitioning this dynamic agentic system from a conceptual prototype to a robust, production-ready service requires addressing several critical operational challenges. The architecture's inherent dynamism, while powerful, introduces complexities in task management, observability, and deployment that must be systematically managed. A key challenge in this architecture is the management of distributed state. The overall "state" of the system is fragmented across multiple components: the LangGraph checkpointer database holds conversational state, the MCP server's ToolManager holds the list of active tools, and a separate configuration database holds the blueprints for creating agents. Ensuring transactional consistency across these stores—for instance, guaranteeing that an agent registered with the MCP server also has its configuration successfully saved—is paramount to prevent the system from entering a broken, inconsistent state. A production system would need to implement transactional logic or a two-phase commit pattern for the registration process to ensure atomicity.

### **6.1 Asynchronous Task Handling with a Job Queue**

Agentic tasks, particularly those involving chains of tool calls or complex reasoning, can be long-running, often exceeding the timeout limits of standard HTTP requests. Handling these invocations synchronously within the MCP server's call\_tool handler is not viable for production.62

A robust solution is to introduce an asynchronous job queue using a library like **BullMQ** for Node.js/TypeScript 62 or a similar system like

**Qyu**.64 The architecture would be modified as follows:

1. **Enqueuing Jobs:** The call\_tool handler in the Express.js MCP server no longer invokes the LangGraph graph directly. Instead, its sole responsibility is to validate the request and add a job to the queue. The job payload would contain all necessary information: agent\_name, task\_details, and the thread\_id. The handler would then immediately return a job\_id to the client.
2. **Queue Workers:** A separate pool of worker processes, running in their own containers, would listen for jobs on the queue. These workers are responsible for the computationally intensive task of invoking the LangGraph runtime. This decouples the long-running agent execution from the client-facing API, ensuring the server remains responsive.
3. **Result Retrieval:** The client can use the job\_id to poll a separate /job-status/:id endpoint to check for completion or, for a more sophisticated user experience, the server could use WebSockets to push a notification to the client when the job is done.65

### **6.2 Observability: Tracing and Debugging with LangSmith**

Debugging non-deterministic, multi-agent systems is notoriously difficult without specialized tooling.67 The complexity of nested agent calls and dynamic routing can make it nearly impossible to pinpoint the source of errors or performance bottlenecks using traditional logging alone.

LangSmith is a platform designed specifically for the observability of LLM applications and integrates seamlessly with LangGraph.68 By setting a few environment variables (

LANGCHAIN\_TRACING\_V2, LANGCHAIN\_API\_KEY), every invocation of our LangGraph graphs will be automatically traced.69

A detailed trace in LangSmith provides a hierarchical view of the entire execution, allowing us to inspect:

- The top-level run initiated by the MCP server's call\_tool handler.
- The supervisor node's LLM call, including the exact prompt sent and the structured JSON it received back.
- The invocation of a worker agent as a nested subgraph, clearly showing the delegation.
- The worker agent's own internal tool calls and reasoning steps.
- Crucially, LangSmith automatically tracks performance metrics like **latency** and **token usage** for every step.70 This is vital for identifying performance bottlenecks and managing the operational costs of the system, as unchecked conversational memory or inefficient tool use can lead to spiraling expenses.72

### **6.3 Deployment Strategy: Containerization with Docker**

A microservices architecture is well-suited for deploying this system, as it allows each component to be scaled and updated independently.74 We can use Docker to containerize each part of the system.

A production-ready deployment would consist of the following services, orchestrated with a tool like Docker Compose for local development or Kubernetes for production:

1. **MCP Server Service:** A Node.js container running the Express.js application that serves the MCP endpoints.
2. **LangGraph Worker Service:** One or more TypeScript/Node.js containers running the BullMQ workers that execute the agent graphs. This service can be scaled horizontally to handle increased job volume.
3. **Persistence Service:** A managed database instance (e.g., PostgreSQL or a cloud equivalent) to serve as the backend for LangGraph's checkpointer.
4. **Queue Service:** A Redis container to manage the BullMQ job queue.

A sample docker-compose.yml file would define these services, their dependencies, and networking, providing a one-command setup for local testing and development. Official Docker images for LangGraph and related components can serve as a starting point.75

## **Conclusion and Future Directions**

This report has detailed an architectural blueprint for a dynamic, self-expanding multi-agent system built with langgraph-typescript and a custom Model Context Protocol (MCP) server. By eschewing high-level, restrictive SDKs and instead composing the system from low-level, open, and interoperable primitives, we have designed a solution that is not only powerful but also transparent, controllable, and model-agnostic. The core patterns—a hierarchical supervisor for task delegation, an Agent Factory for dynamic capability expansion, and a runtime-mutable MCP server for open interoperability—form a robust foundation for the next generation of autonomous AI systems. We have demonstrated how the supervisor can reason about its own limitations and commission the creation of new agents, which are then seamlessly integrated into its team as callable tools.

The integration of LangGraph's stateful, cyclical execution with a persistent checkpointer ensures that these complex, long-running workflows are durable and resumable. Furthermore, we have outlined a clear path to production by addressing critical operational concerns such as asynchronous task handling with job queues, deep observability with LangSmith, and scalable deployment using a containerized microservices architecture. The resulting system represents a significant step beyond static agent teams, moving towards a model of true agentic autonomy where the system can adapt its own structure to meet the demands of novel challenges.

This architecture opens up several promising avenues for future research and development:

- **Decentralized Agent Registry:** The current ToolManager is a centralized, in-memory component. A future iteration could replace this with a distributed, persistent agent registry, allowing for greater scalability and fault tolerance.
- **Reflective Meta-Supervision:** The supervisor currently creates agents but does not evaluate their performance. A "meta-supervisor" could be developed to monitor the success rate, cost, and latency of its workers. It could autonomously decide to retire underperforming agents, fine-tune their prompts, or commission replacements with different toolsets, creating a self-optimizing system.
- **Advanced Communication Protocols:** While MCP's client-server model is effective, future systems could explore more decentralized communication patterns, such as a shared event bus (e.g., Apache Kafka) or peer-to-peer protocols, to enable more complex and resilient inter-agent collaboration.78
- **Automated Tool Composition:** The current Agent Factory relies on the supervisor to specify which pre-existing tools a new agent should have. A more advanced system could allow an agent to _compose_ new, complex tools from a set of simpler primitives, further enhancing its problem-solving capabilities.

By continuing to build upon these open and controllable foundations, the developer community can push the boundaries of what is possible with multi-agent systems, moving closer to the goal of creating truly intelligent and adaptive AI.

#### **Works cited**

1. LangGraph: Hierarchical Agent Teams \- Kaggle, accessed July 8, 2025, [https://www.kaggle.com/code/ksmooi/langgraph-hierarchical-agent-teams](https://www.kaggle.com/code/ksmooi/langgraph-hierarchical-agent-teams)
2. LangGraph \- LangChain, accessed July 8, 2025, [https://www.langchain.com/langgraph](https://www.langchain.com/langgraph)
3. langchain-ai/langgraphjs: Framework to build resilient language agents as graphs. \- GitHub, accessed July 8, 2025, [https://github.com/langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs)
4. scitara-cto/dynamic-mcp-server: A flexible and extensible ... \- GitHub, accessed July 8, 2025, [https://github.com/scitara-cto/dynamic-mcp-server](https://github.com/scitara-cto/dynamic-mcp-server)
5. My thoughts on the most popular frameworks today: crewAI, AutoGen, LangGraph, and OpenAI Swarm : r/LangChain \- Reddit, accessed July 8, 2025, [https://www.reddit.com/r/LangChain/comments/1g6i7cj/my\_thoughts\_on\_the\_most\_popular\_frameworks\_today/](https://www.reddit.com/r/LangChain/comments/1g6i7cj/my_thoughts_on_the_most_popular_frameworks_today/)
6. Guide to Google Agent Development Kit (ADK) \- Aalpha information systems, accessed July 8, 2025, [https://www.aalpha.net/blog/google-agent-development-kit-adk-for-multi-agent-applications/](https://www.aalpha.net/blog/google-agent-development-kit-adk-for-multi-agent-applications/)
7. Langgraph JS | Build your first AI Workflow | by Mustafa Elsayed \- Medium, accessed July 8, 2025, [https://medium.com/@mustafaskyer/langgraph-js-build-your-first-ai-workflow-188fdc7fb1e4](https://medium.com/@mustafaskyer/langgraph-js-build-your-first-ai-workflow-188fdc7fb1e4)
8. LangGraph is Not a True Agentic Framework | by Saeed Hajebi | Medium, accessed July 8, 2025, [https://medium.com/@saeedhajebi/langgraph-is-not-a-true-agentic-framework-3f010c780857](https://medium.com/@saeedhajebi/langgraph-is-not-a-true-agentic-framework-3f010c780857)
9. Introducing LangGraph: Build Dynamic Multi-Agent Workflows for LLMs | by Jimmy Wang | Jun, 2025 | Medium, accessed July 8, 2025, [https://medium.com/@jimmywanggenai/introducing-langgraph-build-dynamic-multi-agent-workflows-for-llms-8f0ef31be63c](https://medium.com/@jimmywanggenai/introducing-langgraph-build-dynamic-multi-agent-workflows-for-llms-8f0ef31be63c)
10. LangChain bad, I get it. What about LangGraph? : r/LocalLLaMA \- Reddit, accessed July 8, 2025, [https://www.reddit.com/r/LocalLLaMA/comments/1dxj1mo/langchain\_bad\_i\_get\_it\_what\_about\_langgraph/](https://www.reddit.com/r/LocalLLaMA/comments/1dxj1mo/langchain_bad_i_get_it_what_about_langgraph/)
11. LangGraph Memory & Flow Architecture: A Complete Guide | by KevinLuo | Medium, accessed July 8, 2025, [https://kilong31442.medium.com/langgraph-memory-flow-architecture-a-complete-guide-977fa25e9940](https://kilong31442.medium.com/langgraph-memory-flow-architecture-a-complete-guide-977fa25e9940)
12. Use the Graph API \- GitHub Pages, accessed July 8, 2025, [https://langchain-ai.github.io/langgraph/how-tos/graph-api/](https://langchain-ai.github.io/langgraph/how-tos/graph-api/)
13. Built with LangGraph\! \#4: Components | by Okan Yenigün | Jul, 2025 \- Medium, accessed July 8, 2025, [https://medium.com/@okanyenigun/built-with-langgraph-4-components-d26701f7d16d](https://medium.com/@okanyenigun/built-with-langgraph-4-components-d26701f7d16d)
14. LangGraph AI agents : Building a Dynamic Order Management System : A Step-by-Step Tutorial | by Kshitij Kutumbe | AI Advances, accessed July 8, 2025, [https://ai.gopubby.com/langgraph-building-a-dynamic-order-management-system-a-step-by-step-tutorial-0be56854fc91](https://ai.gopubby.com/langgraph-building-a-dynamic-order-management-system-a-step-by-step-tutorial-0be56854fc91)
15. LangGraph Tutorial: What Is LangGraph and How to Use It? \- DataCamp, accessed July 8, 2025, [https://www.datacamp.com/tutorial/langgraph-tutorial](https://www.datacamp.com/tutorial/langgraph-tutorial)
16. An Absolute Beginner's Guide to LangGraph.js \- Microsoft Community Hub, accessed July 8, 2025, [https://techcommunity.microsoft.com/blog/educatordeveloperblog/an-absolute-beginners-guide-to-langgraph-js/4212496](https://techcommunity.microsoft.com/blog/educatordeveloperblog/an-absolute-beginners-guide-to-langgraph-js/4212496)
17. Understanding LangGraph for LLM-Powered Workflows \- Phase 2, accessed July 8, 2025, [https://phase2online.com/2025/02/24/executive-overview-understanding-langgraph-for-llm-powered-workflows/](https://phase2online.com/2025/02/24/executive-overview-understanding-langgraph-for-llm-powered-workflows/)
18. Hierarchical AI Agents: Create a Supervisor AI Agent Using LangChain \- Vijaykumar Kartha, accessed July 8, 2025, [https://vijaykumarkartha.medium.com/hierarchical-ai-agents-create-a-supervisor-ai-agent-using-langchain-315abbbd4133](https://vijaykumarkartha.medium.com/hierarchical-ai-agents-create-a-supervisor-ai-agent-using-langchain-315abbbd4133)
19. langchain-ai/langgraph-supervisor-js: REPOSITORY MOVED \- new location: https://github.com/langchain-ai/langgraphjs/tree/main/libs/langgraph-supervisor \- GitHub, accessed July 8, 2025, [https://github.com/langchain-ai/langgraph-supervisor-js](https://github.com/langchain-ai/langgraph-supervisor-js)
20. Hierarchical Agent Teams \- GitHub Pages, accessed July 8, 2025, [https://langchain-ai.github.io/langgraph/tutorials/multi\_agent/hierarchical\_agent\_teams/](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/hierarchical_agent_teams/)
21. Building Multi-Agent Systems with LangGraph-Supervisor \- DEV Community, accessed July 8, 2025, [https://dev.to/sreeni5018/building-multi-agent-systems-with-langgraph-supervisor-138i](https://dev.to/sreeni5018/building-multi-agent-systems-with-langgraph-supervisor-138i)
22. langchain-ai/langgraph-supervisor-py \- GitHub, accessed July 8, 2025, [https://github.com/langchain-ai/langgraph-supervisor-py](https://github.com/langchain-ai/langgraph-supervisor-py)
23. Implementing Multi-agent Agentic Pattern From Scratch \- Daily Dose of Data Science, accessed July 8, 2025, [https://www.dailydoseofds.com/ai-agents-crash-course-part-12-with-implementation/](https://www.dailydoseofds.com/ai-agents-crash-course-part-12-with-implementation/)
24. OpenAI Agents SDK Tutorial: Building AI Systems That Take Action | DataCamp, accessed July 8, 2025, [https://www.datacamp.com/tutorial/openai-agents-sdk-tutorial](https://www.datacamp.com/tutorial/openai-agents-sdk-tutorial)
25. Build Multi-Agent Apps with OpenAI's Agent SDK | Towards Data Science, accessed July 8, 2025, [https://towardsdatascience.com/build-multi-agent-apps-with-openais-agent-sdk/](https://towardsdatascience.com/build-multi-agent-apps-with-openais-agent-sdk/)
26. Using LangChain With Model Context Protocol (MCP) | by Cobus ..., accessed July 8, 2025, [https://cobusgreyling.medium.com/using-langchain-with-model-context-protocol-mcp-e89b87ee3c4c](https://cobusgreyling.medium.com/using-langchain-with-model-context-protocol-mcp-e89b87ee3c4c)
27. Building ADK(v1.2.0+) agents using MCP tools | by Arjun Prabhulal \- Medium, accessed July 8, 2025, [https://medium.com/google-cloud/building-adk-v1-2-0-agents-using-mcp-tools-e97fb5e47961](https://medium.com/google-cloud/building-adk-v1-2-0-agents-using-mcp-tools-e97fb5e47961)
28. Understanding the Model Context Protocol (MCP) | by Akhshy Ganesh | May, 2025 \- Medium, accessed July 8, 2025, [https://medium.com/@akhshyganesh/understanding-the-model-context-protocol-mcp-6ba14a7bd411](https://medium.com/@akhshyganesh/understanding-the-model-context-protocol-mcp-6ba14a7bd411)
29. Model Context Protocol: Introduction, accessed July 8, 2025, [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)
30. MCP Explained: The New Standard Connecting AI to Everything | by Edwin Lisowski, accessed July 8, 2025, [https://medium.com/@elisowski/mcp-explained-the-new-standard-connecting-ai-to-everything-79c5a1c98288](https://medium.com/@elisowski/mcp-explained-the-new-standard-connecting-ai-to-everything-79c5a1c98288)
31. MCP tools \- Agent Development Kit \- Google, accessed July 8, 2025, [https://google.github.io/adk-docs/tools/mcp-tools/](https://google.github.io/adk-docs/tools/mcp-tools/)
32. Tools \- Model Context Protocol, accessed July 8, 2025, [https://modelcontextprotocol.io/docs/concepts/tools](https://modelcontextprotocol.io/docs/concepts/tools)
33. Use subgraphs, accessed July 8, 2025, [https://langchain-ai.github.io/langgraph/how-tos/subgraph/](https://langchain-ai.github.io/langgraph/how-tos/subgraph/)
34. LangGraph Studio: Subgraphs \- YouTube, accessed July 8, 2025, [https://www.youtube.com/watch?v=ZGnI9z8CGwI](https://www.youtube.com/watch?v=ZGnI9z8CGwI)
35. Mastering Structured Output in LLMs 2: Revisiting LangChain and JSON \- Medium, accessed July 8, 2025, [https://medium.com/@docherty/mastering-structured-output-in-llms-revisiting-langchain-and-json-structured-outputs-d95dfc286045](https://medium.com/@docherty/mastering-structured-output-in-llms-revisiting-langchain-and-json-structured-outputs-d95dfc286045)
36. OpenAI JSON Mode vs. Function Calling for Data Extraction \- LlamaIndex, accessed July 8, 2025, [https://docs.llamaindex.ai/en/stable/examples/llm/openai\_json\_vs\_function\_calling/](https://docs.llamaindex.ai/en/stable/examples/llm/openai_json_vs_function_calling/)
37. TypeScript-first schema validation with static type inference \- Zod, accessed July 8, 2025, [https://zod.dev/?ref=blog.langchain.dev\&id=merge](https://zod.dev/?ref=blog.langchain.dev&id=merge)
38. How can I add an "agent" to a "graph" in LangGraphJs? \- Stack Overflow, accessed July 8, 2025, [https://stackoverflow.com/questions/79459752/how-can-i-add-an-agent-to-a-graph-in-langgraphjs](https://stackoverflow.com/questions/79459752/how-can-i-add-an-agent-to-a-graph-in-langgraphjs)
39. Exploring Google's Agent Development Kit (ADK) | by Deven Joshi | May, 2025 | Medium, accessed July 8, 2025, [https://medium.com/@d3xvn/exploring-googles-agent-development-kit-adk-71a27a609920](https://medium.com/@d3xvn/exploring-googles-agent-development-kit-adk-71a27a609920)
40. Building Dynamic Agentic Workflows at Runtime · langchain-ai langgraph · Discussion \#2219 \- GitHub, accessed July 8, 2025, [https://github.com/langchain-ai/langgraph/discussions/2219](https://github.com/langchain-ai/langgraph/discussions/2219)
41. Your Guide to Implementing JSON Serialization in JavaScript \- Turing, accessed July 8, 2025, [https://www.turing.com/kb/implementing-json-serialization-in-js](https://www.turing.com/kb/implementing-json-serialization-in-js)
42. JSON.stringify() \- JavaScript \- MDN Web Docs, accessed July 8, 2025, [https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global\_Objects/JSON/stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
43. Serializing object methods using ES6 template strings and eval | by Adrian Oprea \- Medium, accessed July 8, 2025, [https://oprearocks.medium.com/serializing-object-methods-using-es6-template-strings-and-eval-c77c894651f0](https://oprearocks.medium.com/serializing-object-methods-using-es6-template-strings-and-eval-c77c894651f0)
44. Writing an MCP Server with Typescript | by Doğukan Akkaya \- Medium, accessed July 8, 2025, [https://medium.com/@dogukanakkaya/writing-an-mcp-server-with-typescript-b1caf1b2caf1](https://medium.com/@dogukanakkaya/writing-an-mcp-server-with-typescript-b1caf1b2caf1)
45. Building Your First MCP Server: A Beginners Tutorial \- DEV ..., accessed July 8, 2025, [https://dev.to/debs\_obrien/building-your-first-mcp-server-a-beginners-tutorial-5fag](https://dev.to/debs_obrien/building-your-first-mcp-server-a-beginners-tutorial-5fag)
46. MCP Client (TypeScript) \- Learn Microsoft, accessed July 8, 2025, [https://learn.microsoft.com/en-us/microsoftteams/platform/teams-ai-library/typescript/in-depth-guides/ai/mcp/mcp-client](https://learn.microsoft.com/en-us/microsoftteams/platform/teams-ai-library/typescript/in-depth-guides/ai/mcp/mcp-client)
47. wdi-sg/express-api-key-authentication \- GitHub, accessed July 8, 2025, [https://github.com/wdi-sg/express-api-key-authentication](https://github.com/wdi-sg/express-api-key-authentication)
48. How to secure Express.js APIs \- Escape.tech, accessed July 8, 2025, [https://escape.tech/blog/how-to-secure-express-js-api/](https://escape.tech/blog/how-to-secure-express-js-api/)
49. Trying to setup LangChain \+ LangGraph with Typescript / NextJS \- Reddit, accessed July 8, 2025, [https://www.reddit.com/r/LangChain/comments/1iecw1s/trying\_to\_setup\_langchain\_langgraph\_with/](https://www.reddit.com/r/LangChain/comments/1iecw1s/trying_to_setup_langchain_langgraph_with/)
50. How to evaluate a langgraph graph \- ️🛠️ LangSmith \- LangChain, accessed July 8, 2025, [https://docs.smith.langchain.com/evaluation/how\_to\_guides/langgraph](https://docs.smith.langchain.com/evaluation/how_to_guides/langgraph)
51. API Key Middleware for Express \- Codepunk \- Oneloop, accessed July 8, 2025, [https://www.oneloop.ai/blog/api-key-middleware-for-express](https://www.oneloop.ai/blog/api-key-middleware-for-express)
52. Implementing API Key Authentication in Express : r/node \- Reddit, accessed July 8, 2025, [https://www.reddit.com/r/node/comments/1az3cql/implementing\_api\_key\_authentication\_in\_express/](https://www.reddit.com/r/node/comments/1az3cql/implementing_api_key_authentication_in_express/)
53. Authorization \- Model Context Protocol, accessed July 8, 2025, [https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
54. Dynamic authorization for MCP servers \- Cerbos, accessed July 8, 2025, [https://www.cerbos.dev/features-benefits-and-use-cases/dynamic-authorization-for-MCP-servers](https://www.cerbos.dev/features-benefits-and-use-cases/dynamic-authorization-for-MCP-servers)
55. Dynamic authorization for AI agents. A guide to fine-grained permissions in MCP servers, accessed July 8, 2025, [https://www.cerbos.dev/blog/dynamic-authorization-for-ai-agents-guide-to-fine-grained-permissions-mcp-servers](https://www.cerbos.dev/blog/dynamic-authorization-for-ai-agents-guide-to-fine-grained-permissions-mcp-servers)
56. Build multi-agent systems with LangGraph and Amazon Bedrock | Artificial Intelligence, accessed July 8, 2025, [https://aws.amazon.com/blogs/machine-learning/build-multi-agent-systems-with-langgraph-and-amazon-bedrock/](https://aws.amazon.com/blogs/machine-learning/build-multi-agent-systems-with-langgraph-and-amazon-bedrock/)
57. Persistence \- LangGraph, accessed July 8, 2025, [https://www.baihezi.com/mirrors/langgraph/how-tos/persistence/index.html](https://www.baihezi.com/mirrors/langgraph/how-tos/persistence/index.html)
58. Tutorial \- Persist LangGraph State with Couchbase Checkpointer, accessed July 8, 2025, [https://developer.couchbase.com/tutorial-langgraph-persistence-checkpoint/](https://developer.couchbase.com/tutorial-langgraph-persistence-checkpoint/)
59. Durable execution \- Overview, accessed July 8, 2025, [https://langchain-ai.github.io/langgraph/concepts/durable\_execution/](https://langchain-ai.github.io/langgraph/concepts/durable_execution/)
60. Durable Execution for Building Crashproof AI Agents \- DBOS, accessed July 8, 2025, [https://www.dbos.dev/blog/durable-execution-crashproof-ai-agents](https://www.dbos.dev/blog/durable-execution-crashproof-ai-agents)
61. Persistence, accessed July 8, 2025, [https://langchain-ai.github.io/langgraphjs/concepts/persistence/](https://langchain-ai.github.io/langgraphjs/concepts/persistence/)
62. How to Handle Asynchronous Tasks with Node.js and BullMQ \- Hostman, accessed July 8, 2025, [https://hostman.com/tutorials/how-to-handle-asynchronous-tasks-with-node-js-and-bullmq/](https://hostman.com/tutorials/how-to-handle-asynchronous-tasks-with-node-js-and-bullmq/)
63. How To Handle Asynchronous Tasks with Node.js and BullMQ | DigitalOcean, accessed July 8, 2025, [https://www.digitalocean.com/community/tutorials/how-to-handle-asynchronous-tasks-with-node-js-and-bullmq](https://www.digitalocean.com/community/tutorials/how-to-handle-asynchronous-tasks-with-node-js-and-bullmq)
64. shtaif/Qyu: A general-purpose asynchronous job queue for Node.js. \- GitHub, accessed July 8, 2025, [https://github.com/shtaif/Qyu](https://github.com/shtaif/Qyu)
65. Up and running with WebSocket \- Thoughtbot, accessed July 8, 2025, [https://thoughtbot.com/blog/up-and-running-with-websocket](https://thoughtbot.com/blog/up-and-running-with-websocket)
66. WebSockets and Node.js \- testing WS and SockJS by building a web app \- Ably Realtime, accessed July 8, 2025, [https://ably.com/blog/web-app-websockets-nodejs](https://ably.com/blog/web-app-websockets-nodejs)
67. How LangGraph & LangSmith Saved Our AI Agent: Here's the Full Journey (Open Source \+ Video Walkthrough) : r/LangChain \- Reddit, accessed July 8, 2025, [https://www.reddit.com/r/LangChain/comments/1kpv07s/how\_langgraph\_langsmith\_saved\_our\_ai\_agent\_heres/](https://www.reddit.com/r/LangChain/comments/1kpv07s/how_langgraph_langsmith_saved_our_ai_agent_heres/)
68. LangSmith \- LangChain, accessed July 8, 2025, [https://www.langchain.com/langsmith](https://www.langchain.com/langsmith)
69. Trace with LangChain (Python and JS/TS), accessed July 8, 2025, [https://docs.smith.langchain.com/observability/how\_to\_guides/trace\_with\_langchain](https://docs.smith.langchain.com/observability/how_to_guides/trace_with_langchain)
70. How to fetch performance metrics for an experiment | 🦜️🛠️ LangSmith \- LangChain, accessed July 8, 2025, [https://docs.smith.langchain.com/evaluation/how\_to\_guides/fetch\_perf\_metrics\_experiment](https://docs.smith.langchain.com/evaluation/how_to_guides/fetch_perf_metrics_experiment)
71. LangSmith Tracing Deep Dive — Beyond the Docs | by aviad rozenhek | Medium, accessed July 8, 2025, [https://medium.com/@aviadr1/langsmith-tracing-deep-dive-beyond-the-docs-75016c91f747](https://medium.com/@aviadr1/langsmith-tracing-deep-dive-beyond-the-docs-75016c91f747)
72. LangChain & LangGraph: The Frameworks Powering Production AI Agents | Last9, accessed July 8, 2025, [https://last9.io/blog/langchain-langgraph-the-frameworks-powering-production-ai-agents/](https://last9.io/blog/langchain-langgraph-the-frameworks-powering-production-ai-agents/)
73. How do I handle token limits and optimize performance in LangChain? \- Milvus, accessed July 8, 2025, [https://milvus.io/ai-quick-reference/how-do-i-handle-token-limits-and-optimize-performance-in-langchain](https://milvus.io/ai-quick-reference/how-do-i-handle-token-limits-and-optimize-performance-in-langchain)
74. TypeScript Microservices: Build, deploy, and secure Microservices using TypeScript combined with Node.js 178883075X, 9781788830751 \- DOKUMEN.PUB, accessed July 8, 2025, [https://dokumen.pub/typescript-microservices-build-deploy-and-secure-microservices-using-typescript-combined-with-nodejs-178883075x-9781788830751.html](https://dokumen.pub/typescript-microservices-build-deploy-and-secure-microservices-using-typescript-combined-with-nodejs-178883075x-9781788830751.html)
75. bracesproul/langgraphjs-examples: Repository containing LangGraph.js 🕸️ examples, accessed July 8, 2025, [https://github.com/bracesproul/langgraphjs-examples](https://github.com/bracesproul/langgraphjs-examples)
76. langchain/langgraphjs-api \- Docker Image, accessed July 8, 2025, [https://hub.docker.com/r/langchain/langgraphjs-api](https://hub.docker.com/r/langchain/langgraphjs-api)
77. Self-hosting LangSmith with Docker \- LangChain, accessed July 8, 2025, [https://docs.smith.langchain.com/self\_hosting/installation/docker](https://docs.smith.langchain.com/self_hosting/installation/docker)
78. Four Design Patterns for Event-Driven, Multi-Agent Systems \- Confluent, accessed July 8, 2025, [https://www.confluent.io/blog/event-driven-multi-agent-systems/](https://www.confluent.io/blog/event-driven-multi-agent-systems/)
