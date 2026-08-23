# AETHERSPACE ARCHITECTURAL MANIFESTO & SYSTEM OF RECORD (SOTA 2026)

## 1. CORE INVARIANTS
- **Repository**: https://github.com/laptoplenovoslim18-cyber/AetherSpace
- **Edge Deployment**: https://aetherspace.pages.dev
- **Budget**: $0 FOSS Invariant (Zero paid dependencies).
- **Compute Load**: 100% Zero Local KI Load (Client-Side BYOK Web Studio).

## 2. OPERATIONAL MODES
1. **Direct Chat**: High-speed streaming inference against a single selected model.
2. **Multi-Agent Mode**: Sequential Agent-to-Agent Debate (Architect generates, Reviewer critiques and hardens code).
3. **Supervisor Orchestration**: Supervisor breaks down tasks into a DAG, workers execute tasks, and Arbiter outputs verified synthesis.

## 3. KEY-AWARE AUTO-ROUTER & CASSETTE GOVERNOR
- Auto-Router analyzes prompt complexity but ONLY selects providers with configured keys in the user's Key Vault.
- Proactive 80% Rate-Limit Governor prevents HTTP 429 locks by rotating keys at 80% quota usage.
- Fallback chain automatically shifts across models on HTTP 503 (High Demand).

## 4. MCP (MODEL CONTEXT PROTOCOL) INTEGRATION
- Model Context Protocol compliant tool calling for:
  - Live Web Retrieval (Google Search Grounding & DuckDuckGo Tool).
  - GitHub REST API Tool (Live repository reading).
  - YouTube Data API Tool (Video metadata & transcript processing).
  - Custom Remote MCP Servers via SSE/REST.