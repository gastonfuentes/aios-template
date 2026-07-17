#!/usr/bin/env bash
# Crea 2 usuarios de prueba (admin + student) usando la Supabase Admin API.
# Uso: ./scripts/seed-test-users.sh

set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno."
  echo "Cargalas: source .env.local && export \$(cat .env.local | xargs)"
  exit 1
fi

ADMIN_EMAIL="admin@test.local"
STUDENT_EMAIL="student@test.local"

echo "Creando admin: $ADMIN_EMAIL"
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"adminpass123\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Admin Test\"}}"

echo ""
echo "Creando student: $STUDENT_EMAIL"
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$STUDENT_EMAIL\",\"password\":\"studentpass123\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Student Test\"}}"

echo ""
echo "Promoviendo $ADMIN_EMAIL a role=admin (manual)"
echo "Ejecuta en SQL Editor:"
echo "  update public.profiles set role='admin' where email='$ADMIN_EMAIL';"
