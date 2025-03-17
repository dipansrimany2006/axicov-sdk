import { MongoClient } from "mongodb";
import chalk from "chalk";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { exportToolsAndSetMetadata } from "../registry";
import { Tools, toolType } from "../types";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export class Agent {
  public tools: { [key: string]: toolType };
  public threadId: string;
  toolMetadata: string;
  public model: BaseChatModel;
  public systemPrompt?: SystemMessage;
  public mongoClient: any;
  public checkPointSaver: any;
  public config;
  public agent: any;
  public params: any;
  public runtimeParams: any;
  registry: any;
  public toolKnowledge: any;

  constructor({ threadId, params }: { threadId: string; params: any }) {
    this.threadId = threadId;
    this.params = params;
    this.tools = {};
    this.toolMetadata = "";
    this.runtimeParams = {};

    try {
      if (process.env.ANTHROPIC_API_KEY) {
        this.model = new ChatAnthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: "claude-3-haiku-20240307",
        });
        console.log(chalk.red("Model Initilaized"));
      } else if (process.env.GEMINI_API_KEY) {
        this.model = new ChatGoogleGenerativeAI({
          apiKey: process.env.GEMINI_API_KEY,
        });
      } else {
        throw new Error("No valid API key found for AI models");
      }
    } catch (error: any) {
      console.error("Error initializing model:", error);
      throw new Error(`Failed to initialize model: ${error.message}`);
    }

    this.config = {
      configurable: {
        thread_id: threadId,
      },
    };
  }

  async initialize({
    toolNumbers,
    clients,
    allRegistry,
    checkPointer = "local",
  }: {
    toolNumbers: number[];
    clients: ((agent: Agent) =>
      | Promise<{
          tools: any[];
          schema: Tools;
        }>
      | any)[];
    allRegistry: ((agent: Agent) =>
      | Promise<{
          tools: any[];
          schema: Tools;
        }>
      | any)[];
    checkPointer?: "local" | "mongo";
  }) {
    try {
      try {
        await exportToolsAndSetMetadata(
          this,
          toolNumbers,
          clients,
          allRegistry
        );
      } catch (error: any) {
        console.error("Failed to load tools:", error);
        throw new Error(`Agent initialization failed: ${error.message}`);
      }

      this.systemPrompt = new SystemMessage(`
        Your name is ${this.params.name} (Agent).
        
        INSTRUCTIONS:
        ${this.params.instruction}
        
        - Behavioral Guidelines:
          1. NEVER be rude to user
          2. NEVER try to be over professional
          3. ALWAYS be friendly to the user
          4. NEVER act over politely
          4. ALWAYS be concise and to the point
        
        Response Formatting:
        - Use proper line breaks between different sections of your response for better readability
        - Utilize markdown features effectively to enhance the structure of your response
        - Keep responses concise and well-organized
        - Use emojis sparingly and only when appropriate for the context
        - Use an abbreviated format for transaction signatures
        
        Common knowledge:
        - Your are hyperoptimized for sonic blockchain
        - Chain currently Operating on: Sonic
        - Short Description about sonic: Sonic is a high-speed, low-fee blockchain built on top of solana.
        
        Realtime knowledge:
        - { approximateCurrentTime: ${new Date().toISOString()}}
        
        Your Available Tools:
        ${this.toolMetadata}
        
        IMPORTANT POINTS:
        - You are in your developement phase
        - The development team will update you with more features
        - Don't use tools when it is not necessary
        - **Always try to provide short, clear and concise responses**

        ADDITIONAL KNOWLEDGE FROM TOOLS:
        ${
          this.params.toolKnowledge &&
          this.params.toolKnowledge.length > 0 &&
          this.params.toolKnowledge
            .filter((item: string) => item !== "")
            .map((item: string) => `- ${item}`)
            .join("\n")
        }
        `);

      if (checkPointer === "mongo") {
        try {
          this.mongoClient = new MongoClient(process.env.MONGO_URI!);
          await this.mongoClient.connect(); // Test connection
          this.checkPointSaver = new MongoDBSaver({ client: this.mongoClient });
        } catch (error: any) {
          console.error("MongoDB connection error:", error);
          throw new Error(`MongoDB connection failed: ${error.message}`);
        }
      } else {
        this.checkPointSaver = new MemorySaver();
      }

      this.agent = "";
      this.orchestrate("Fetch price of apples in russia");

      console.log(chalk.green("Agent initialized successfully"));
    } catch (error: any) {
      console.error("Agent initialization error:", error);
    }
  }

  async messageAgent(msg: string) {
    try {
      const agent = await this.orchestrate(msg);

      if (!agent) {
        throw new Error("Agent failed");
      }

      let response;
      try {
        const read = await this.checkPointSaver.get(this.config);

        if (!read) {
          response = await agent.invoke(
            {
              messages: [
                this.systemPrompt as SystemMessage,
                new HumanMessage(msg.toString()),
              ],
            },
            {
              configurable: {
                thread_id: this.threadId,
              },
            }
          );
        } else {
          response = await this.agent.invoke(
            {
              messages: [new HumanMessage(msg.toString())],
            },
            {
              configurable: {
                thread_id: this.threadId,
              },
            }
          );
        }
      } catch (error: any) {
        console.error("Error invoking agent:", error);
      }

      return response.messages[response.messages.length - 1].content;
    } catch (error: any) {
      console.error("Message agent error:", error);
    }
  }

  async orchestrate(msg: string) {
    try {
      // Find out the tools that are required to complete the flow of the message
      const orchestrationPrompt = new SystemMessage(`
      You are Axicov Orchestrator, an AI assistant specialized in Sonic blockchain and DeFi operations.

      Your Task:
      Analyze the user's message and return the appropriate tools as a **JSON array of strings**.  

      Rules:
      - Only include the askForConfirmation tool if the user's message requires a transaction signature or if they are creating an action.
      - Only return the tools in the format: ["tool1", "tool2", ...].  
      - Do not add any text, explanations, or comments outside the array.
      - Be complete — include all necessary tools to handle the request, if you're unsure, it's better to include the tool than to leave it out.
      - If the request cannot be completed with the available toolsets, return an array describing the unknown tools ["INVALID_TOOL:\${INVALID_TOOL_NAME}"].

      Available Tools:
      ${Object.keys(this.tools)
        .map((toolName) => `${toolName}: ${this.tools[toolName].description}`)
        .join("\n")}
      `);

      const orchestrationResponse = await this.model.invoke([
        orchestrationPrompt,
        new HumanMessage(msg.toString()),
      ]);

      const toolNames: string[] = JSON.parse(
        orchestrationResponse.content.toString()
      );

      console.log(chalk.bgRed(toolNames));

      const agent = createReactAgent({
        llm: this.model,
        tools: toolNames.map((name) => this.tools[name]),
        checkpointSaver: this.checkPointSaver,
      });

      return agent;
    } catch (err) {
      console.error("Error in orchestration:", err);
      return false;
    }
  }
}
