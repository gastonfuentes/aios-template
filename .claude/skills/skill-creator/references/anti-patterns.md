# Anti-patterns al crear skills

## Frontmatter

❌ **Description vaga**:

```yaml
description: "Skill para emails."
```

Falla porque no tiene WHEN. Claude no sabe en que casos triggerear.

✅ **Description pushy con WHAT + WHEN**:

```yaml
description: "Configura Resend + React Email para correos transaccionales en Next.js. Activar cuando el usuario menciona welcome email, broadcast a comunidad, recuperar password, notificar membresia expirando."
```

❌ **Description en primera persona**:

```yaml
description: "Yo te ayudo a integrar Resend en tu proyecto."
```

Falla porque el system prompt mezcla pronombres. Discovery se rompe.

❌ **`name` con uppercase o symbols**:

```yaml
name: AuthStack          # rota regex
name: auth_stack         # underscores no permitidos
name: claude-helper      # contiene reserved word
```

## Body

❌ **MUSTs/NEVERs en mayusculas excesivos**:

```markdown
ALWAYS enable RLS FIRST!!!
NEVER write before applying migration!!!
MUST check user.id matches!!!
```

Falla porque el agente cumple por orden, no por entendimiento. Cuando llega a un edge case, no sabe si la regla aplica.

✅ **Imperativa con why**:

```markdown
Habilita RLS antes del primer write. Razon: Supabase no permite re-aplicar
RLS retroactivamente sin migracion compleja.
```

❌ **Body de 800+ lineas con codigo embed**:

Un SKILL.md gigante con 20 ejemplos de codigo inline excede el cap de 500 lineas y degrada performance del agente al cargarlo.

✅ **Body < 500 lineas + split a references/scripts/assets**:

SKILL.md tiene quick-start + index. Detalles van a `references/<topic>.md`. Codigo ejecutable a `scripts/`. Plantillas copy-paste a `assets/`.

❌ **Multiple opciones equivalentes sin default**:

```markdown
Puedes usar pdfplumber, pdf2image, pypdf o pdfminer.
```

Genera paralisis de decision.

✅ **Default + escape hatch**:

```markdown
Use pdfplumber. Para scanned PDFs (fotos), use pdf2image en su lugar.
```

❌ **Time-sensitive info en flujo principal**:

```markdown
Despues de agosto 2025, OpenAI cambio el modelo, asi que ahora usar...
```

Falla porque la info envejece y el agente lee el flujo principal sin contexto historico.

✅ **Flujo principal evergreen + seccion "Old patterns" colapsada**:

```markdown
## Flujo principal
[evergreen instructions]

## Old patterns (pre-2025-08)
[historical, only relevant cuando se mantiene legacy code]
```

## References

❌ **References anidadas mas de un nivel**:

```
references/
├── topic-a.md
└── deep/
    └── nested.md   # NO — Claude usa head -100 y pierde info
```

✅ **One-level-deep maximo**:

```
references/
├── topic-a.md
├── topic-b.md
└── extras/
    └── advanced-X.md  # solo si "extras" es un sub-modulo opcional clarisimo
```

❌ **Files >300 lineas sin TOC**:

Claude lee `head -100` por default cuando ve un archivo grande. Sin TOC, pierde el indice de que contiene.

✅ **Files >300 lineas con TOC al inicio**:

```markdown
# Topic A — guia completa

## Tabla de contenidos
- [Setup inicial](#setup-inicial)
- [Casos avanzados](#casos-avanzados)
- [Troubleshooting](#troubleshooting)
```

## Bundle structure

❌ **Carpetas custom**:

```
skill-name/
├── SKILL.md
├── templates/      # NO — usar assets/
├── data/           # NO — usar references/ si es markdown, assets/ si es binario
├── examples/       # NO — los examples van a references/<topic>.md o scripts/
```

✅ **Tres carpetas canonicas**:

```
skill-name/
├── SKILL.md
├── references/     # markdown lazy-loaded
├── scripts/        # codigo ejecutable
└── assets/         # plantillas, icons, fonts
```

## Cross-references

❌ **Generico**:

```markdown
Usa otras skills cuando sea relevante.
```

✅ **Concreto con hand-off**:

```markdown
@.claude/skills/emails-transactional/SKILL.md — encadenar despues de signup.
Hand-off: el trigger handle_new_user llama una Edge Function que despacha
sendEmail({ template: 'welcome', to: new.email }).
```

## Naming

❌ **Generico** (`helper`, `utils`, `tools`).
❌ **Singular cuando deberia ser noun phrase** (`auth` vs `auth-stack`).
❌ **Verbose** (`comprehensive-authentication-system`).

✅ **Noun phrase corta o gerundio**:
- `auth-stack`
- `processing-pdfs`
- `image-kit`
- `supabase-admin`

## Validation al cerrar

❌ **Vagueness**:

```markdown
- [ ] Verifica que funciona.
```

✅ **Comandos concretos**:

```markdown
- [ ] npm test retorna 0
- [ ] npx playwright test retorna 0
- [ ] Lighthouse >= 90 en /signin
```
