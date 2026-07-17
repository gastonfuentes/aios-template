#!/bin/sh
# The daemon reads its configuration from agent-server/.env (never process.env,
# by design — see src/env.ts). Coolify injects config as environment variables,
# so materialize the allowlisted keys into .env before starting the process.
set -e

ENV_FILE=/app/agent-server/.env
: > "$ENV_FILE"

for key in \
  MC_SUPABASE_URL MC_SUPABASE_KEY \
  OPENCLAW_GATEWAY_TOKEN MISSION_CONTROL_ORIGIN MISSION_CONTROL_URL MISSION_CONTROL_TOKEN \
  LLM_PROVIDER ANTHROPIC_API_KEY OPENROUTER_API_KEY \
  MC_SERVER_PORT MC_SERVER_HOST LOG_LEVEL SCHEDULER_TZ \
  TELEGRAM_BOT_TOKEN ALLOWED_CHAT_ID GROQ_API_KEY ELEVENLABS_API_KEY ELEVENLABS_VOICE_ID
do
  eval "val=\${$key:-}"
  if [ -n "$val" ]; then
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
done

exec "$@"
