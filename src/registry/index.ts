import { any } from "zod";
import { Agent } from "../agent";
import { Tools, toolType } from "../types";

/**
 *
 * @param agent
 * @param toolNumbers
 * @returns filtered set of tools
 */
export const exportToolsAndSetMetadata = async (
  agent: Agent,
  toolNumbers: number[],
  coreRegistry: any,
  allRegistry: any
) => {
  try {
    let toolMetadata: string[] = [];

    const filteredToolBunches = allRegistry.filter((_: any, idx: number) =>
      toolNumbers.includes(idx)
    );

    const toolPromises = coreRegistry.concat(filteredToolBunches).map(
      async (
        item: (agent: Agent) => Promise<{
          tools: toolType[];
          schema: Tools;
        }>
      ) => {
        try {
          const toolItem = await item(agent);

          toolItem.tools.map((tool) => {
            console.log(tool.name);
          });

          agent.tools.push(...toolItem.tools);

          Object.values(toolItem.schema).forEach((item: any) => {
            toolMetadata.push(`
  - Tool Name: ${item.name}
  - Tool Description: ${item.description}
  - Requires Approval: ${item?.requiresApproval || false}
            `);
          });

          return toolItem;
        } catch (error: any) {
          console.error(`Error loading tool:`, error);
          return null; // Add return statement for this catch block
        }
      }
    );

    // Wait for all tools to be loaded or fail gracefully
    const results = await Promise.allSettled(toolPromises);

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Tool at index ${index} failed to load:`, result.reason);
      }
    });

    agent.toolMetadata = toolMetadata.join("\n\n");

    // Check for any failed tools and throw detailed error
    const failedTools = results.filter(
      (result) => result.status === "rejected"
    );
    if (failedTools.length > 0) {
      const failureMessages = failedTools
        .map((result, index) => {
          if (result.status === "rejected") {
            return `Tool ${index}: ${result.reason.message || "Unknown error"}`;
          }
          return null;
        })
        .filter(Boolean)
        .join("; ");

      console.error("Failed to initialize one or more tools", failureMessages);
    }

    // If no tools were loaded successfully, throw an error
    if (agent.tools.length === 0) {
      console.error("No tools were loaded successfully");
    }

    return results; // This is already here
  } catch (error: any) {
    console.error("Error in exportToolsAndSetMetadata:", error);
    return []; // Add a return statement in the catch block
  }
};
