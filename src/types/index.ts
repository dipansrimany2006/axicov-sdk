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
