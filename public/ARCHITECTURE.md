# AETHERSPACE ARCHITECTURAL MANIFESTO & SYSTEM OF RECORD (SOTA 2026)

## 1. CORE INVARIANTS & REPOSITORIES (SOURCE OF TRUTH)
- **Repository**: https://github.com/laptoplenovoslim18-cyber/AetherSpace
- **Edge Deployment (Cloudflare Pages)**: https://aetherspace.pages.dev
- **GitHub Pages Distribution**: https://laptoplenovoslim18-cyber.github.io/AetherSpace/public/
- **Budget Constraint**: $0 FOSS Invariant (Zero paid dependencies, zero server subscriptions).
- **Compute Load Constraint**: 100% Zero Local KI Load (Client-Side BYOK Web Studio, zero GPU/RAM consumption on user laptops).

## 2. OPERATIONAL MODES & ORCHESTRATION PATTERNS
1. **Direct Chat (1:1)**: High-speed streaming inference against single selected model.
2. **Multi-Agent Chat (Peer-to-Peer)**: Multi-persona debate and collaborative code synthesis.
3. **Supervisor Orchestration (Leader-Worker Pattern)**:
   - **Chief / Supervisor Agent**: Breaks down architectural objectives, generates task DAG.
   - **Specialized Worker Agents**: Execute tasks across separate API keys and models in parallel.
   - **Arbiter Synthesis**: Validates output, resolves logic contradictions, outputs unified code.

## 3. MULTI-PROVIDER AI GATEWAY & RESILIENT CASCADE
- **Google AI Studio REST v1beta**: Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.1 Pro Preview, Gemini 3.5 Flash Lite.
- **Groq Cloud API**: Llama 3.3 70B Versatile, DeepSeek R1 Distill Llama 70B, Llama 3.1 8B Instant.
- **OpenRouter Free Tier**: `openrouter/free` auto-router, `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`.
- **Hugging Face Serverless Inference**: Direct REST access via `hf_...` User Access Token (`Qwen/Qwen2.5-Coder-32B-Instruct`, `deepseek-ai/DeepSeek-R1`, `mistralai/Mistral-7B-Instruct-v0.3`).
- **80% Anti-Block Governor**: Proactive sliding-window rate-limiter that shifts traffic at 80% quota utilization to prevent HTTP 429 and provider bans.
- **503 / 429 Cascade Failover**: Transparent automatic re-routing down the fallback chain.

## 4. MCP & TOOL ABSTRACTION PROTOCOL
- Universal Tool Calling interface supporting:
  - YouTube Data API v3 (Transcript & metadata extraction).
  - GitHub REST API (Live repository file read/write).
  - Custom REST & Localhost CORS Endpoints (Ollama `http://127.0.0.1:11434`, LM Studio `http://127.0.0.1:1234`).
  - Hugging Face Spaces (Custom Space URL integration via SSE/REST).

## 5. CLIENT-SIDE DATA PRIVACY & ISOLATION
- All API keys, bearer secrets, and custom endpoints reside strictly in the user's browser `localStorage`.
- Zero tokens or prompts are stored on intermediate servers.
- Cloudflare Pages serves purely static assets with zero backend proxy liability.