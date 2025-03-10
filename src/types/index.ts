import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";

export type toolType = DynamicStructuredTool<any> | DynamicTool;

export type ToolSchema = {
  name: string;
  description: string;
  schema: any;
  requiresApproval?: boolean | undefined;
};

export type Tools = {
  [key: string]: ToolSchema;
};

// Types for different message formats
interface BaseMessage {
  type: string;
  threadId: string;
  timestamp?: string;
}

interface ChatMessage extends BaseMessage {
  type: "message";
  messageType: "userMessage" | "agentResponse";
  content: string;
}

interface ToolEvent extends BaseMessage {
  type: "toolEvent";
  tool: string;
  status: string;
  message: string;
}

interface ErrorMessage extends BaseMessage {
  type: "error";
  error: string;
}

type WebSocketMessage = ChatMessage | ToolEvent | ErrorMessage;

export { BaseMessage, ChatMessage, ToolEvent, ErrorMessage };
