#!/usr/bin/env bash
# Envia un push de prueba a un user-id especifico via tu API.
# Uso: ./scripts/test-push.sh <user-uuid>
# Requiere endpoint /api/push/send protegido (admin only).

set -euo pipefail

USER_ID="${1:-}"
if [ -z "$USER_ID" ]; then
  echo "Uso: $0 <user-uuid>"
  exit 1
fi

if [ -z "${ADMIN_BEARER:-}" ]; then
  echo "Falta ADMIN_BEARER. Conseguilo: login admin → DevTools → cookie 'sb-access-token'"
  exit 1
fi

curl -X POST http://localhost:3000/api/push/send \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H 'Content-Type: application/json' \
  -d "{
    \"userId\": \"$USER_ID\",
    \"title\": \"Test push\",
    \"body\": \"Si ves esto, tu setup funciona.\",
    \"url\": \"/dashboard\"
  }"

echo ""
echo "Push enviado. Si el user esta suscripto, le llega en segundos."
