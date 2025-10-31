import express, { Request, Response } from "express";
import cors from "cors";
import { Agent } from "../agent";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Store active agents in memory (For now It is using machine's memory, but for production we should use Redis)
const agents = new Map<string, Agent>();

interface ModelConfig {
  provider: "anthropic" | "gemini";
  modelName: string;
  apiKey: string;
  temperature?: number;
}

interface CreateAgentRequest {
  threadId: string;
  modelConfig: ModelConfig;
  params: {
    name: string;
    instruction: string;
    toolKnowledge?: string[];
  };
  toolNumbers?: number[];
  clients?: any[];
  allRegistry?: any[];
  checkPointer?: "local" | "mongo";
  mongoUri?: string;
}

// Helper function to create model from config
function createModelFromConfig(config: ModelConfig): BaseChatModel {
  switch (config.provider) {
    case "anthropic":
      return new ChatAnthropic({
        modelName: config.modelName,
        apiKey: config.apiKey,
        temperature: config.temperature,
      });
    case "gemini":
      return new ChatGoogleGenerativeAI({
        modelName: config.modelName,
        apiKey: config.apiKey,
        temperature: config.temperature,
      });
    default:
      throw new Error(`Unsupported model provider: ${config.provider}`);
  }
}

interface SendMessageRequest {
  threadId: string;
  message: string;
}

// POST /agent/create - Create and configure an agent
app.post("/agent/create", async (req: Request, res: Response) => {
  try {
    const {
      threadId,
      modelConfig,
      params,
      toolNumbers = [],
      clients = [],
      allRegistry = [],
      checkPointer = "local",
      mongoUri,
    } = req.body as CreateAgentRequest;

    // Validation
    if (!threadId) {
      return res.status(400).json({
        success: false,
        error: "threadId is required",
      });
    }
    if (
      !modelConfig ||
      !modelConfig.provider ||
      !modelConfig.modelName ||
      !modelConfig.apiKey
    ) {
      return res.status(400).json({
        success: false,
        error: "modelConfig with provider, modelName, and apiKey is required",
      });
    }
    if (!params || !params.name || !params.instruction) {
      return res.status(400).json({
        success: false,
        error: "params with name and instruction are required",
      });
    }

    // Check if agent already exists
    if (agents.has(threadId)) {
      return res.status(409).json({
        success: false,
        error:
          "Agent with this threadId already exists. Use DELETE /agent/:threadId first.",
      });
    }

    // Create model from config
    const model = createModelFromConfig(modelConfig);

    // Create new agent
    const agent = new Agent({
      threadId,
      params,
      model,
    });

    // Initialize agent
    await agent.initialize({
      toolNumbers,
      clients,
      allRegistry,
      checkPointer,
      mongoUri,
    });

    // Store agent
    agents.set(threadId, agent);

    res.status(201).json({
      success: true,
      message: "Agent created successfully",
      threadId,
      agentName: params.name,
    });
  } catch (error: any) {
    console.error("Error creating agent:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create agent",
    });
  }
});

// POST /send - Send message to existing agent
app.post("/send", async (req: Request, res: Response) => {
  try {
    const { threadId, message } = req.body as SendMessageRequest;

    // Validation
    if (!threadId) {
      return res.status(400).json({
        success: false,
        error: "threadId is required",
      });
    }
    if (!message) {
      return res.status(400).json({
        success: false,
        error: "message is required",
      });
    }

    // Check if agent exists
    const agent = agents.get(threadId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error:
          "Agent not found. Please create an agent first using POST /agent/create",
      });
    }

    // Send message to agent
    const agentExecutor = await agent.messageAgent(message);

    // Stream the response
    const stream = await agentExecutor.stream(
      { messages: [{ role: "user", content: message }] },
      agent.config
    );

    let finalResponse = "";
    let toolCalls: any[] = [];

    for await (const chunk of stream) {
      if (chunk.agent?.messages) {
        const lastMessage =
          chunk.agent.messages[chunk.agent.messages.length - 1];
        if (lastMessage.content) {
          // Handle content that might be string, array, or object
          if (typeof lastMessage.content === "string") {
            finalResponse = lastMessage.content;
          } else if (Array.isArray(lastMessage.content)) {
            // If content is an array, extract text from each item
            finalResponse = lastMessage.content
              .map((item: any) =>
                typeof item === "string" ? item : item.text || ""
              )
              .join("");
          } else if (
            typeof lastMessage.content === "object" &&
            lastMessage.content.text
          ) {
            finalResponse = lastMessage.content.text;
          }
        }
        // Capture tool calls if any
        if (lastMessage.tool_calls) {
          toolCalls = lastMessage.tool_calls;
        }
      }
    }

    res.json({
      success: true,
      threadId,
      response: finalResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });
  } catch (error: any) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process message",
    });
  }
});

// GET /agent/:threadId - Get agent info
app.get("/agent/:threadId", (req: Request, res: Response) => {
  const { threadId } = req.params;

  const agent = agents.get(threadId);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: "Agent not found",
    });
  }

  res.json({
    success: true,
    threadId: agent.threadId,
    agentName: agent.params.name,
    toolCount: Object.keys(agent.tools).length,
    tools: Object.keys(agent.tools),
  });
});

// GET /agents - Getting all agents
app.get("/agents", (req: Request, res: Response) => {
  const agentList = Array.from(agents.entries()).map(([threadId, agent]) => ({
    threadId,
    agentName: agent.params.name,
    toolCount: Object.keys(agent.tools).length,
  }));

  res.json({
    success: true,
    count: agentList.length,
    agents: agentList,
  });
});

// DELETE /agent/:threadId - Delete an agent
app.delete("/agent/:threadId", async (req: Request, res: Response) => {
  const { threadId } = req.params;

  const agent = agents.get(threadId);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: "Agent not found",
    });
  }

  // Clean up MongoDB connection if exists
  if (agent.mongoClient) {
    try {
      await agent.mongoClient.close();
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
    }
  }

  agents.delete(threadId);

  res.json({
    success: true,
    message: "Agent deleted successfully",
    threadId,
  });
});

// GET /health - Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "healthy",
    activeAgents: agents.size,
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Axicov SDK Server running on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`POST /agent/create - Create a new agent`);
  console.log(`POST /send - Send message to agent`);
  console.log(`GET /agent/:threadId - Get agent info`);
  console.log(`GET /agents - List all agents`);
  console.log(`DELETE /agent/:threadId - Delete agent`);
  console.log(`GET /health - Health check`);
});

export default app;
