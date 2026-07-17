# Gmail cheatsheet — `gog` CLI

> Comandos `gog gmail` que el SDK invoca al activar `google-workspace`. Todos con `--account=your-email@example.com` explícito.

## Buscar mensajes

```bash
# Threads (conversaciones)
gog gmail search "in:inbox newer_than:1d" --account=your-email@example.com --max 10 --json

# Mensajes individuales (granularidad mayor)
gog gmail messages search "in:inbox is:unread" --account=your-email@example.com --max 10 --json

# Por label
gog gmail search "label:PROMOTIONS newer_than:7d" --account=your-email@example.com --max 50

# Por sender
gog gmail messages search "from:contacto@cliente.com newer_than:30d" --account=your-email@example.com --json

# Con attachments
gog gmail messages search "has:attachment newer_than:7d" --account=your-email@example.com --json
```

## Listar labels

```bash
gog gmail labels list --account=your-email@example.com --json
```

## Modificar labels (archive, unarchive, custom labels)

```bash
# Archivar (remove INBOX label)
gog gmail messages modify <messageId> --remove-labels INBOX --account=your-email@example.com

# Marcar como leído
gog gmail messages modify <messageId> --remove-labels UNREAD --account=your-email@example.com

# Aplicar custom label
gog gmail messages modify <messageId> --add-labels Label_123 --account=your-email@example.com
```

## Enviar mensajes

```bash
# Plain text
gog gmail send --to recipient@example.com --subject "Subject" --body "Text" --account=your-email@example.com

# Multi-línea via stdin
gog gmail send --to recipient@example.com --subject "Subject" --body-file - --account=your-email@example.com <<'EOF'
Hola,

Cuerpo del mensaje aquí.

Saludos,
Juan
EOF

# HTML
gog gmail send --to recipient@example.com --subject "Subject" --body-html "<p>HTML content</p>" --account=your-email@example.com

# Con CC y BCC
gog gmail send --to recipient@example.com --cc cc@example.com --bcc bcc@example.com --subject "Subject" --body "Text" --account=your-email@example.com
```

## Reglas

- Confirmar el draft con el operador antes de cualquier `send` (mostrar to + subject + body cortado).
- Nunca usar `--add-labels` sin verificar antes que el label existe (`gog gmail labels list`).
- Para archive masivo, iterar por messageIds individuales con `xargs`/`for` — `gog` no soporta batch nativo.
