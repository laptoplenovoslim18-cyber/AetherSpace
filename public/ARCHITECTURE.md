# AETHERSPACE ARCHITECTURAL MANIFESTO & SYSTEM OF RECORD (SOTA 2026)

## 1. CORE INVARIANTS
- **Repository**: https://github.com/laptoplenovoslim18-cyber/AetherSpace
- **Edge Deployment**: https://aetherspace.pages.dev
- **Budget Constraint**: $0 FOSS Invariant (Zero paid dependencies).
- **Compute Load Constraint**: 100% Zero Local KI Load (Client-Side BYOK Web Studio).

## 2. STRICTLY PRUNED SOTA ROSTER (NO WEAK / OBSOLETE MODELS)
- **Gemini SOTA Tier**: `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.1-pro-preview` (All `3.5-flash-lite` models purged).
- **Hugging Face SOTA Tier**: `Qwen/Qwen2.5-Coder-32B-Instruct`, `deepseek-ai/DeepSeek-R1`, `mistralai/Mistral-7B-Instruct-v0.3`.
- **Groq LPU Tier**: `llama-3.3-70b-versatile`, `deepseek-r1-distill-llama-70b`.

## 3. UNIFIED INLINE CONTROL & MCP SUITE
- Bottom prompt bar contains nested tool drawers for Mode Switching, Live Web Search, URL Context Resolution, and Slash Commands (`/`).
- Anti-Loop Watchdog prevents runaway token consumption by capping loops at 3 iterations with emergency interruption and resume capabilities.