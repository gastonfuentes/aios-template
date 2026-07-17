# Dependencies graph — extraer del brief

## Formato esperado en el brief

Cada fase declara `Depende de:` con la lista de fases prerequisito:

```
### Fase 1: Auth base
- Depende de: —

### Fase 2: BD core
- Depende de: —

### Fase 3: Dashboard
- Depende de: Fase 1, Fase 2

### Fase 4: Pagos
- Depende de: Fase 1, Fase 2

### Fase 5: Tests E2E
- Depende de: Fase 1, Fase 2, Fase 3, Fase 4
```

## Construir el grafo

```ts
type Phase = { id: string; depends_on: string[] };

function buildLayers(phases: Phase[]): string[][] {
  const layers: string[][] = [];
  const remaining = new Set(phases.map((p) => p.id));
  const completed = new Set<string>();

  while (remaining.size > 0) {
    const layer = phases.filter(
      (p) => remaining.has(p.id) && p.depends_on.every((d) => completed.has(d)),
    );
    if (layer.length === 0) {
      throw new Error('Dependencia circular detectada');
    }
    layer.forEach((p) => {
      remaining.delete(p.id);
      completed.add(p.id);
    });
    layers.push(layer.map((p) => p.id));
  }

  return layers;
}
```

Output del ejemplo:

```
Layer 0: [Fase 1, Fase 2]   ← paralelizable
Layer 1: [Fase 3, Fase 4]   ← paralelizable, espera 0
Layer 2: [Fase 5]            ← serial, espera 1
```

## Validar no-circulares

Si el algoritmo no avanza (ningun nodo tiene todas sus deps satisfechas), hay ciclo. Ejemplo:

```
Fase A → depende de B
Fase B → depende de A
```

Solucion: re-leer el brief, identificar cual deberia ir primero realmente. Casi siempre uno de los dos `Depende de` esta mal escrito.

## Validar deps realistas

Aun sin ciclo, una dependencia puede ser equivocada. Ej: el alumno declaro "Fase 5 depende de Fase 4" pero realmente solo depende de Fase 2. Resultado: Fase 5 espera innecesariamente.

Optimizacion: cuestionar cada dependencia. ¿Es por codigo (Fase 5 importa de Fase 4) o por logica (test E2E necesita el flow real)? Si es por logica, podria aplicar parcialmente.

## Sweet spot de paralelizacion

- Layer con 2-4 fases: optimo.
- Layer con 1 fase: serial, sin team.
- Layer con 5+ fases: posible, pero sync checkpoint complejo.

Si una capa tiene 5+ fases, considerar particionar el brief en dos briefs separados con dependencia entre ellos.

## Output esperado al usuario

```
Plan de paralelizacion del brief:

Capa 0: 2 agentes en paralelo
  - auth-engineer (Fase 1: Auth base)
  - db-engineer (Fase 2: BD core)

Capa 1: 2 agentes en paralelo
  - frontend-engineer (Fase 3: Dashboard)
  - payments-engineer (Fase 4: Pagos)

Capa 2: 1 agente
  - qa-engineer (Fase 5: Tests E2E)

Tiempo estimado: 3 capas × ~30min = ~90min total (vs ~5h secuencial).
```

Esto se anuncia (no se pregunta — Regla 6 sub-regla a) y se ejecuta.
