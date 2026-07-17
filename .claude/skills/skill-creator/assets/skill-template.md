---
name: <id-canonico>
description: "<WHAT en una frase>. Activar cuando el usuario menciona <trigger 1>, <trigger 2>, <trigger 3>, <trigger 4>, <trigger 5>."
---

# <Nombre legible>

> Una frase ejecutiva sobre que resuelve esta skill y a quien le sirve.

---

## Cuando activar

- "<trigger 1 reformulado como frase del usuario>"
- "<trigger 2>"
- "<trigger 3>"
- "<trigger 4>"

## Cuando NO activar

- <caso 1 donde otra skill o ningun workflow es mejor + cita la skill correcta si aplica>.
- <caso 2>.

## Antes de empezar — verifica empiricamente

Ejecuta los chequeos en orden y resuelve cada faltante autonomamente (Regla 6 PRP-029):

- [ ] <pre-requisito 1: archivo / variable / dependencia>.
- [ ] <pre-requisito 2>.
- [ ] <pre-requisito 3>.

## Flujo principal

### Paso 1: <nombre>

<imperativa> + Razon: <why explicito>.

```ts
// codigo si aplica
```

### Paso 2: <nombre>

<imperativa> + Razon: <why>.

### Paso N: <nombre>

<imperativa> + Razon: <why>.

## Si tu Directiva no es Next.js/Supabase

Ver `references/<framework>-non-next.md` (flat one-level — Skills 2.0).

(Esta seccion solo si la skill es de stack — NO en skills de meta-doctrina o tooling cross-stack.)

## Cross-references con skills hermanas

- `@.claude/skills/<hermana-1>/SKILL.md` — <cuando encadenar>. Hand-off: <que pasa la una a la otra concretamente>.
- `@.claude/skills/<hermana-2>/SKILL.md` — <cuando encadenar>. Hand-off: <concreto>.
- `@.claude/skills/<hermana-3>/SKILL.md` — <cuando encadenar>. Hand-off: <concreto>.

## Archivos lazy-loaded

- `references/<topic-1>.md` — <que contiene, cuando leerlo>.
- `references/<topic-2>.md` — <que contiene, cuando leerlo>.
- `scripts/<helper>.sh` — <que hace, cuando ejecutarlo>.
- `assets/<template>` — <que genera, cuando usarlo>.

## Validacion al cerrar

```bash
<comando 1 que verifica que el resultado funciona>
<comando 2>
```

- [ ] <check 1 concreto>.
- [ ] <check 2>.
