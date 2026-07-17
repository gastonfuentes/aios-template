# Política Append-Only

> `decisiones.md` y `errores-aprendidos.md` son inviolables al pisado. Solo se agrega bloque al final. Razón: estos archivos son la línea de tiempo del operador — perder un bloque pasado por sobreescritura accidental destruye contexto irrecuperable.

---

## Archivos sujetos a append-only

- `.claude/memory/decisiones.md`
- `.claude/memory/errores-aprendidos.md`
- `.claude/memory/historial/<YYYY-MM>.md` (escritos por el cron — el operador los puede leer pero no debería editarlos a mano)

---

## Operación permitida: append

La skill **siempre** usa `Edit` para agregar al final, **nunca** `Write` (que pisa el archivo entero).

Patrón canónico:

1. Leer el archivo con `Read` para obtener el contenido actual.
2. Construir el bloque nuevo:
   ```markdown


   ## YYYY-MM-DD: <título corto del bloque>

   <contenido del bloque>
   ```
3. Llamar `Edit` con `old_string` = la última línea del archivo + `new_string` = la última línea + el bloque nuevo.
4. Disparar `memory-commit.sh "memoria: append <archivo>"`.

Si el archivo está vacío de bloques (solo frontmatter + placeholder `<!-- nuevo bloque va aquí -->`), reemplazar el placeholder por el bloque + un nuevo placeholder. Razón: mantiene la convención visual.

---

## Operación NO permitida: pisar

La skill rechaza:

- `Write` sobre `decisiones.md` o `errores-aprendidos.md`. Si el SDK intenta, la skill detecta y devuelve un mensaje al operador explicando la regla.
- `Edit` que reemplace un bloque pasado **sin pedir confirmación al operador**.

---

## Excepción: editar un bloque pasado (alto riesgo)

A veces el operador descubre un error en una decisión registrada hace meses (typo, dato incorrecto, decisión revertida). En ese caso:

1. La skill muestra el bloque actual y la edición propuesta como diff.
2. Pide confirmación 1-vez al operador con voz del operador.
3. Solo tras confirmación explícita, ejecuta `Edit` reemplazando el bloque.
4. El commit message refleja la naturaleza: `memoria: corregir bloque YYYY-MM-DD en decisiones.md`.

Patrón de confirmación:

```
Encontré un bloque del 2026-03-12 en `decisiones.md` que dice "lifetime $500".
Querías corregirlo a "$497"?

  - Si SÍ: edito ese bloque y dejo el resto intacto.
  - Si NO: agrego un bloque nuevo al final con la corrección y nota de que reemplaza al anterior.
```

Default si el operador no responde claramente: agregar bloque nuevo al final que cita "este bloque corrige el del YYYY-MM-DD". Razón: append-only por defecto, edición solo con luz verde.

---

## Estructura interna del bloque

### `decisiones.md`

```markdown
## YYYY-MM-DD: <título corto en imperativo o sustantivo>

**Decisión**: <una frase clara con la decisión>.

**Por qué**: <2-3 líneas con la razón / contexto / data que la justifica>.

**Implicaciones**: <qué cambia operativa o técnicamente, si aplica>.

**Vigente hasta**: <indefinido / fecha / "hasta que reviewee X" — si aplica>.
```

### `errores-aprendidos.md`

```markdown
## YYYY-MM-DD: <título corto del error>

**Error**: <una línea de qué falló>.

**Fix**: <cómo se arregló>.

**Aplicar en**: <dónde más aplica esto>.
```

Análogo al formato de la sección `## Aprendizajes` de los PRPs y de `CLAUDE.md`. Razón: consistencia. Si un aprendizaje del PRP también merece vivir en `errores-aprendidos.md` como info operativa del operador (no técnica del PRP), copiarlo verbatim aquí.

---

## Frontmatter en archivos append-only

`last_updated` puede actualizarse al hacer cada append, pero no es obligatorio — la fecha de cada bloque ya marca el tiempo. `update_frequency: high`. `volatility: snapshot`.

---

## Por qué append-only y no edición libre

- **Línea de tiempo intacta**: el yo de dentro de 6 meses puede leer en orden cronológico y entender la evolución del pensamiento.
- **Auditoría git trivial**: `git log -p .claude/memory/decisiones.md` muestra una historia limpia de aditivos, no un caos de ediciones.
- **Conflictos casi nulos al sincronizar**: si el operador edita en máquina principal del operador y segunda máquina del operador en paralelo, ambos appends se mezclan limpiamente con un merge trivial. Si fuera edición libre, cada conflicto tocaría líneas en medio del archivo.
- **Espejo de cómo funciona `CLAUDE.md`**: la sección Aprendizajes del CLAUDE.md raíz también es append-only por la misma razón. Coherencia transversal del proyecto.
