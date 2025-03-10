# Axicov SDK

A powerful SDK for creating and managing AI agents with tools using LangChain.

## Installation

```bash
npm install axicov-sdk
```

## Requirements

- Node.js 16 or higher
- API keys for one of the supported AI models (Anthropic or Google Gemini)
- MongoDB (optional, for persistent state)

## Environment Variables

Create a `.env` file with the following variables:

```
# Choose one of these API keys
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key

# Optional for MongoDB checkpoint storage
MONGO_URI=your_mongodb_connection_string
```

## Basic Usage

```typescript
import { Agent } from "axicov-sdk";

// Define your tools
const myTools = [
  // Tool definitions here
];

const coreRegistry = [
  // Core tool registry functions
];

const allRegistry = [
  // All available tool registry functions
];

// Create agent
const agent = new Agent({
  threadId: "unique-thread-id",
  params: {
    name: "MyAssistant",
    instruction: "Help the user with their tasks",
    publicKey: "optional-public-key",
    // Add any persistent parameters that should be stored in DB
  },
});

// Initialize agent with tools
await agent.initialize({
  toolNumbers: [0, 1, 2], // Indexes of tools to use
  coreRegistry,
  allRegistry,
  checkPointer: "local", // or 'mongo' for MongoDB storage
});

// Runtime parameters can be set after initialization
agent.runtimeParams = {
  currentSession: "session-123",
  temporaryData: {
    /* any session-specific data */
  },
  // Add any runtime-generated data that doesn't need persistence
};

// Send messages to the agent
const response = await agent.messageAgent("Hello, can you help me?");
console.log(response);
```

## Agent Parameters

The Agent class uses two different parameter objects:

1. **`params`**: Used for persistent data that should be stored in a database and retrieved when recreating the agent.

   - Set during agent creation
   - Contains configuration like name, instructions, public keys
   - Should include any data needed to reconstruct the agent's state

2. **`runtimeParams`**: Used for temporary data generated during execution.
   - Set during runtime
   - Contains session-specific information
   - Not meant for persistent storage
   - Useful for passing context between tool calls

### Example Use Case

```typescript
// Persistent parameters (stored in DB)
const agent = new Agent({
  threadId: 'user-123',
  params: {
    name: 'Finance Assistant',
    instruction: 'Help with financial tasks',
    userId: 'user-123',
    preferences: {
      language: 'en',
      currency: 'USD',
      timezone: 'America/New_York'
    }
  }
});

// Runtime parameters (generated during execution)
agent.runtimeParams = {
  sessionStartTime: Date.now(),
  lastActivity: Date.now(),
  currentOperation: 'portfolio-analysis',
  tempData: {
    calculationResults: {...},
    userInputCache: {...}
  }
};
```

## Creating Custom Tools

You can create custom tools for your agent using the following pattern:

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Agent, Tools } from "axicov-sdk";

export const customToolRegistry = async (agent: Agent) => {
  const tools: any = [];
  const schema: Tools = {};

  // Define your tool schema first
  schema.yourToolKey = {
    name: "toolName",
    description: "Description of what your tool does",
    schema: z.object({
      paramName: z.string().describe("Description of this parameter"),
      // Add more parameters as needed
    }),
    requiresApproval: false, // Set to true if the tool needs approval before use
  };

  // Create the tool using the schema
  const customTool = new DynamicStructuredTool({
    name: schema.yourToolKey.name,
    description: schema.yourToolKey.description,
    schema: schema.yourToolKey.schema,
    func: async ({ paramName }) => {
      // Implement your tool's functionality here
      console.log(`Processing: ${paramName}`);

      // Return the result
      return "Tool result";
    },
  });

  // Add the tool to the tools array
  tools.push(customTool);

  // Return both the tools array and schema
  return {
    tools,
    schema,
  };
};
```

### Example: Price Lookup Tool

Here's a practical example of a tool that fetches prices for different countries:

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { Agent, Tools } from "axicov-sdk";

export const priceToolRegistry = async (agent: Agent) => {
  const tools: any = [];
  const schema: Tools = {};

  // Sample data
  const prices: { [key: string]: number } = {
    USA: 3.99,
    Japan: 450,
    Germany: 2.5,
    Brazil: 8.75,
  };

  // Define the tool schema
  schema.priceInfo = {
    name: "getPrices",
    description: "A tool that fetches price of products in different countries",
    schema: z.object({
      country: z.string().describe("The country to get prices for"),
      product: z
        .string()
        .optional()
        .describe("Optional specific product to check"),
    }),
    requiresApproval: false,
  };

  // Create the tool
  const priceTool = new DynamicStructuredTool({
    name: schema.priceInfo.name,
    description: schema.priceInfo.description,
    schema: schema.priceInfo.schema,
    func: async ({ country, product }) => {
      console.log(
        `Looking up prices for ${product || "all products"} in ${country}`
      );

      if (prices[country]) {
        return `Price in ${country}: ${prices[country]}`;
      } else {
        return `Price information for ${country} is not available.`;
      }
    },
  });

  tools.push(priceTool);

  return {
    tools,
    schema,
  };
};
```

## Thread Context

The SDK uses a thread context system to manage conversation state:

```typescript
import { setThreadContext, clearThreadContext } from "axicov-sdk";

// Set current thread context
setThreadContext("my-thread-id");

// Clear current thread context
clearThreadContext();
```

## License

ISC
