# @dynamic-agency/supervisor-graph

Supervisor and worker agents using LangGraph-TypeScript.

## Features

- Hierarchical supervisor pattern with LangGraph
- Static worker agents (Phase 1)
- Dynamic agent creation (Phase 3)
- Stateful conversation management

## Architecture

- **Supervisor Node**: Central decision-making agent
- **Worker Agents**: Specialized task executors
- **Agent Factory**: Dynamic agent creation (coming in Phase 3)

## Development

```bash
# Development
deno task dev

# Test
deno task test

# Check types
deno task check
```

## Usage

```typescript
import { createSupervisorGraph } from '@dynamic-agency/supervisor-graph';

const graph = await createSupervisorGraph();
const result = await graph.invoke({
  messages: [{ role: 'user', content: 'Research latest AI trends' }],
});
```
