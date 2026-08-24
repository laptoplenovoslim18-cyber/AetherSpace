# AETHERSPACE ARCHITECTURAL MANIFESTO & SYSTEM OF RECORD (SOTA 2026)

## 1. CORE INVARIANTS
- **Repository**: https://github.com/laptoplenovoslim18-cyber/AetherSpace
- **Edge Deployment**: https://aetherspace.pages.dev
- **Budget Constraint**: $0 FOSS Invariant (Zero paid dependencies).
- **Compute Load Constraint**: 100% Zero Local KI Load (Client-Side BYOK Web Studio).

## 2. MCP (MODEL CONTEXT PROTOCOL) ARCHITECTURE
- **Base Servers**:
  - `Web Search (Exa / Grounding)`: `https://mcp.exa.ai/mcp?tools=web_search`
  - `Hugging Face Hub MCP`: `https://hf.co/mcp?login`
  - `GitHub MCP`: `https://mcp.github.com/v1`
  - `YouTube Transcript MCP`: Realtime caption stream extraction.
- **Custom MCP Server Registry**: Users can connect arbitrary SSE/JSON-RPC endpoints with custom auth headers.

## 3. SOTA INFERENCE ROUTER & RESILIENT CASCADE
- **Hugging Face Inference Router**: `https://router.huggingface.co/v1/chat/completions`
- **Google AI Studio REST v1beta**: `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.1-pro-preview`.
- **Groq Cloud LPU**: `llama-3.3-70b-versatile`, `deepseek-r1-distill-llama-70b`.
- **OpenRouter Free Router**: `openrouter/free`.