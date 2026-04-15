#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Together AI Demo — REST API Test
#
# Tests the /api/chat endpoint with multiple models via curl.
# Requires the Next.js dev server running on port 3035.
#
# Usage:  ./test-rest.sh
# ─────────────────────────────────────────────────────────────────

BASE="http://localhost:3035/api/chat"
PASS=0
FAIL=0

test_model() {
  local model="$1"
  local label="$2"
  printf "  %-35s " "$label"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${BASE}?model=${model}" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Say hello in one sentence."}],"streaming":false}' \
    2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    # Extract content from JSON or SSE
    CONTENT=$(echo "$BODY" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')
    if [ -n "$CONTENT" ]; then
      printf "✅ %s\n" "$(echo "$CONTENT" | head -c 60)"
      PASS=$((PASS + 1))
    else
      printf "✅ (200 OK, streamed)\n"
      PASS=$((PASS + 1))
    fi
  else
    ERROR=$(echo "$BODY" | grep -o '"error":"[^"]*"' | head -1 | sed 's/"error":"//;s/"$//')
    printf "❌ %s %s\n" "$HTTP_CODE" "$(echo "$ERROR" | head -c 50)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "🔬 Together AI REST API Tests"
echo "   Endpoint: $BASE"
echo ""

# Health check
printf "  %-35s " "GET /api/chat"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE")
if [ "$STATUS" = "200" ]; then
  printf "✅ %s\n" "$STATUS"
  PASS=$((PASS + 1))
else
  printf "❌ %s\n" "$STATUS"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "  POST /api/chat — models:"
echo ""

# Test models
test_model "meta-llama/Llama-3.3-70B-Instruct-Turbo"  "Llama 3.3 70B Turbo"
test_model "deepseek-ai/DeepSeek-V3"                   "DeepSeek V3"
test_model "deepseek-ai/DeepSeek-V3.1"                 "DeepSeek V3.1"
test_model "Qwen/Qwen3.5-9B"                           "Qwen 3.5 9B"
test_model "google/gemma-4-31B-it"                      "Gemma 4 31B"
test_model "openai/gpt-oss-120b"                        "GPT OSS 120B"
test_model "MiniMaxAI/MiniMax-M2.5"                     "MiniMax M2.5"
test_model "moonshotai/Kimi-K2.5"                       "Kimi K2.5"
test_model "zai-org/GLM-5.1"                            "GLM-5.1"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Passed: $PASS  ❌ Failed: $FAIL"
echo "═══════════════════════════════════════════════════════"
echo ""
