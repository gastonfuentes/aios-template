# Política Git de la memoria

> Auto-commit + auto-push tras cada escritura, fail-soft cuando push falla. Razón: la memoria es portable solo si llega al remoto sin fricción humana.

---

## Trigger del auto-commit

Después de cada `Write` o `Edit` exitoso a un archivo bajo `.claude/memory/`, la skill ejecuta:

```bash
bash .claude/skills/memory-manager/scripts/memory-commit.sh "<mensaje>"
```

Sin excepciones para el caso normal. El operador no aprueba commit por commit — confía en la política.

---

## Formato del mensaje de commit

Estructura canónica: `memoria: <accion> <archivo>`

| Acción | Cuándo | Ejemplos |
|--------|--------|----------|
| `append` | Bloque nuevo al final de un append-only (`decisiones.md`, `errores-aprendidos.md`, `historial/*`). | `memoria: append decisiones.md` |
| `actualizar` | Edit/rewrite de un archivo nominativo existente (`business-context.md`, `tech-stack.md`, `people.md`, `preferencias.md`, `proyectos-activos/<existente>.md`). | `memoria: actualizar tech-stack.md` |
| `nuevo` | Archivo creado por primera vez (en cualquier carpeta). | `memoria: nuevo proyectos-activos/cutflow.md`, `memoria: nuevo user/juan-vive-guadalajara.md` |
| `snapshot mensual` | Disparado por el cron `monthly-memory-snapshot`. | `memoria: snapshot mensual 2026-05` |
| `bootstrap` | Primera ejecución de `init-memory.sh` que crea la estructura. | `memoria: bootstrap estructura` |

Si una operación toca varios archivos (ej. snapshot + cleanup), un solo commit con mensaje compuesto: `memoria: snapshot mensual 2026-05 + actualizar MEMORY.md`.

Razón del prefijo `memoria:`: permite filtrar el log con `git log --oneline --grep="^memoria:"` para auditoría rápida.

---

## Risk-classifier

Antes de escribir, la skill clasifica el riesgo:

### Bajo riesgo (procede sin preguntar)

- Append a `decisiones.md` o `errores-aprendidos.md` (siempre se agrega bloque al final, no pisa nada).
- Crear archivo nuevo en `user/`, `feedback/`, `project/`, `reference/`.
- Crear archivo nuevo en `proyectos-activos/`.
- Append a archivo en `historial/` (no debería pasar — el cron es quien escribe ahí).

### Alto riesgo (mostrar diff y pedir confirmación 1-vez)

- Sobreescribir un archivo nominativo existente (`business-context.md`, `preferencias.md`, `tech-stack.md`, `people.md`).
- Sobreescribir un archivo existente en `proyectos-activos/`.
- Editar un bloque pasado de `decisiones.md` o `errores-aprendidos.md` (excepción al append-only — ver `append-only-policy.md`).
- Borrar cualquier archivo bajo `.claude/memory/`.

Patrón de confirmación alto riesgo:

```
Voy a actualizar `tech-stack.md`. El cambio:

  --- antes
  +++ después
  @@ ...

  - Stack heredado: better-sqlite3 ^9.4.3
  + Stack heredado: better-sqlite3 ^12.9.0

¿Aplico? (sí / no — si no, pegame qué cambiar.)
```

---

## Fail-soft cuando push falla

`memory-commit.sh` termina con `git push origin main || true`. Si el push falla por:

- **Offline / sin red**: commit local persiste, log WARN visible. Próximo `git push` manual del operador o del próximo write con éxito sincroniza.
- **Divergencia con remoto** (alguien pusheó entre el último pull y este push): mismo fail-soft. Operador resuelve con `git pull --rebase && git push`. La skill NO ejecuta `git pull` automático — riesgo de pisar trabajo en curso del operador en otra rama o archivo.
- **Permission denied** (credenciales caducadas o SSH key no cargada): mismo fail-soft, log WARN sugiere `gh auth setup-git` o `ssh-add`.

El operador puede inspeccionar el estado real con:

```bash
git status                                       # ¿hay diff sin commitear?
git log origin/main..HEAD --oneline              # ¿hay commits locales sin pushear?
```

---

## Pre-checks defensivos del script

`memory-commit.sh` valida antes de operar:

1. `git rev-parse --is-inside-work-tree` — si falla, el script loguea WARN ("no estás en un repo git") y retorna 0.
2. `git config user.email` — si vacío, log WARN ("git user.email no configurado, no commiteo").
3. `git diff --quiet --cached -- .claude/memory && git diff --quiet -- .claude/memory` — si no hay cambios, log info ("nada que commitear") y retorna 0 silente.

Cualquiera de estos casos no aborta el flujo de la skill — el commit fallaría limpiamente.

---

## Comportamiento ante divergencia con remoto

La skill NO resuelve conflictos. Si push falla y el operador hace `git pull --rebase` y aparece un conflicto en `.claude/memory/decisiones.md` (caso típico: editó la misma línea en dos máquinas), el operador resuelve a mano. Razón: pisar el trabajo del operador con resolución automática es peor que pedirle 30 segundos de atención.

Documentado en `references/append-only-policy.md`: las decisiones se agregan al final, no se editan en medio — esto reduce la probabilidad de conflictos cuando se trabaja en dos máquinas.

---

## `--no-verify` y `--no-gpg-sign`

`memory-commit.sh` usa `--no-gpg-sign` por default — los commits del agente no necesitan firma GPG (la atribución viene del git config user.email + Co-Authored-By en el body del commit si se desea).

`memory-commit.sh` **NO usa `--no-verify`** por default. Si el repo agrega hooks pre-commit (no es el caso día 1), el agente respeta — pre-commit hooks fallidos abortan el commit, lo cual es correcto. Si en el futuro un hook bloquea el flujo automático y la decisión consciente es saltarlo, agregar `--no-verify` con comentario explicando por qué.

---

## Anti-patrones

- **No correr `git pull` automático** desde la skill. Riesgo de pisar trabajo en curso.
- **No pushear a una rama distinta de `main`**. Si el operador trabajó en una feature branch, el push falla limpiamente y el operador resuelve. Día 1 AIOS opera en `main`.
- **No commitear con `git commit -a`**. La skill explícitamente hace `git add .claude/memory && git commit` para no arrastrar archivos del operador en otras carpetas.
- **No hacer `git push --force`** desde la skill. Jamás. Anti-patrón cardinal.
- **No commitear secretos**. Si el operador escribe un secreto por error en un archivo de memoria, debe rotarlo (no basta con borrar el commit — el archivo ya está en GitHub, aunque privado). Documentar en `errores-aprendidos.md` cuando pase.
