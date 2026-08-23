# AETHERSPACE ARCHITECTURAL MANIFESTO & SYSTEM OF RECORD (SOTA 2026)

## 1. CORE INVARIANTS
- **Repository**: https://github.com/laptoplenovoslim18-cyber/AetherSpace
- **Edge Deployment**: https://aetherspace.pages.dev
- **Budget Constraint**: $0 FOSS Invariant (Zero paid dependencies, zero server subscriptions).
- **Compute Load Constraint**: 100% Zero Local KI Load (Client-Side BYOK Web Studio).

## 2. RESILIENT MULTI-PROVIDER CASCADE
- **Google AI Studio REST v1beta**: Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.1 Pro Preview, Gemini 3.5 Flash Lite.
- **Hugging Face Serverless Inference**: Direct REST via `hf_...` token (`Qwen/Qwen2.5-Coder-32B-Instruct`, `deepseek-ai/DeepSeek-R1`, `deepseek-ai/DeepSeek-V3`, `mistralai/Mistral-7B-Instruct-v0.3`).
- **Groq Cloud API**: Llama 3.3 70B Versatile, DeepSeek R1 Distill 70B, Llama 3.1 8B Instant.
- **OpenRouter Free Tier**: `openrouter/free`, `meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`.
- **429/503 Global Cascade**: Transparently shifts between models and providers when limits or high demand occur.

## 3. MULTI-AGENT & ORCHESTRATION PIPELINES
1. **Direct Chat**: 1:1 rapid stream.
2. **Multi-Agent Consensus (3-Step Pipeline)**:
   - Step 1: Architect Model drafts the solution.
   - Step 2: Auditor / Security Model reviews and identifies edge cases.
   - Step 3: Arbiter synthesizes audit feedback into production code.
3. **Supervisor Orchestration**: Generates an architectural task plan, executes tasks across specialized workers, and verifies results.

## 4. MCP (MODEL CONTEXT PROTOCOL) & PRIVACY
- Universal Tool Calling schema for Web Search Grounding, GitHub repository reading, and YouTube data extraction.
- 100% Client-Side Privacy: All keys remain isolated in the browser `localStorage`.