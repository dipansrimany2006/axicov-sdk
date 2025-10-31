import dotenv from "dotenv";

dotenv.config();

const API_BASE = "http://localhost:3000";

async function testServerEndpoints() {
  console.log("🧪 Testing Axicov SDK Server Endpoints\n");

  try {
    // 1. Health Check
    console.log("Testing Health Check");
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log("Health:", healthData);
    console.log();

    // 2. Create Agent with Gemini
    console.log("Creating Agent with Gemini");
    const threadId = `test-${Date.now()}`;

    const createAgentPayload = {
      threadId,
      modelConfig: {
        provider: "gemini",
        modelName: "gemini-2.5-flash",
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.7,
      },
      params: {
        name: "Test Assistant",
        instruction:
          "You are a helpful AI assistant. Answer questions clearly and concisely.",
        toolKnowledge: [],
      },
      toolNumbers: [], // No tools for simple test
      clients: [],
      allRegistry: [],
      checkPointer: "local",
    };

    const createResponse = await fetch(`${API_BASE}/agent/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createAgentPayload),
    });
    const createData = await createResponse.json();
    console.log("✅ Agent Created:", createData);
    console.log();

    // 3. Get Agent Info
    console.log("3️⃣ Getting Agent Info...");
    const agentInfoResponse = await fetch(`${API_BASE}/agent/${threadId}`);
    const agentInfoData = await agentInfoResponse.json();
    console.log("✅ Agent Info:", agentInfoData);
    console.log();

    // 4. List All Agents
    console.log("4️⃣ Listing All Agents...");
    const agentsResponse = await fetch(`${API_BASE}/agents`);
    const agentsData = await agentsResponse.json();
    console.log("✅ All Agents:", agentsData);
    console.log();

    // 5. Send Message to Agent
    console.log("5️⃣ Sending Message to Agent...");
    const messagePayload = {
      threadId,
      message: "Hello! What is 2 + 2? Please answer briefly.",
    };

    const sendResponse = await fetch(`${API_BASE}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload),
    });
    const sendData = await sendResponse.json();
    console.log("✅ Agent Response:");
    console.log(`   Message: "${messagePayload.message}"`);
    console.log(`   Response: "${sendData.response}"`);
    console.log();

    // 6. Send Another Message (to test conversation continuity)
    console.log("6️⃣ Sending Follow-up Message...");
    const followUpPayload = {
      threadId,
      message: "What was the answer I just asked about?",
    };

    const followUpResponse = await fetch(`${API_BASE}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(followUpPayload),
    });
    const followUpData = await followUpResponse.json();
    console.log("✅ Follow-up Response:");
    console.log(`   Message: "${followUpPayload.message}"`);
    console.log(`   Response: "${followUpData.response}"`);
    console.log();

    // 7. Delete Agent
    console.log("7️⃣ Deleting Agent...");
    const deleteResponse = await fetch(`${API_BASE}/agent/${threadId}`, {
      method: "DELETE",
    });
    const deleteData = await deleteResponse.json();
    console.log("✅ Agent Deleted:", deleteData);
    console.log();

    console.log("🎉 All tests completed successfully!");
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
  }
}

// Run tests
testServerEndpoints();
