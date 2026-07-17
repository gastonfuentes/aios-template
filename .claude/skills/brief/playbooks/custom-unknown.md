# Playbook: custom-unknown

## Targets obligatorios (minimo 5 busquedas cuando es fallback)

La skill debe investigar **mas profundo** de lo normal porque no hay receta predefinida.

- **¿Que es esto exactamente?** busqueda de terminos clave que use el usuario.
- **Ejemplos reales**: identificar 2-3 proyectos OSS o articulos que hagan algo parecido.
- **Stack dominante** del nicho: ¿que esta usando la gente que hace esto hoy?
- **Diferenciador tecnico**: ¿hay alguna razon tecnica dura (performance, hardware, regulation) que fije el stack?
- **Toolchain externo**: IDE, compiladores, certs, dev accounts que se necesiten.

## Targets opcionales
- **Analisis de comunidad**: ¿hay Discord/Reddit/Forum activo? Si no → posible riesgo de dependencias abandonadas.
- **Ecosistema de deploy**: ¿donde vive esto en prod?

## Busquedas sugeridas (ajustar al caso)
- "<idea del usuario> stack 2026"
- "best way to build <nicho> 2026"
- "<idea> open source examples github"
- "<idea> tutorial from scratch"

## Fuentes primarias
- Buscar repos en GitHub con >1k stars que coincidan.
- Articulos en blogs tecnicos recientes (max 12 meses viejos).
- Docs oficiales de las tecnologias identificadas.

## Riesgos a investigar activamente
- **Stack en declive**: si todos los articulos son de 2022-2023 y nada reciente, posible red flag.
- **Dependencias exoticas**: evitar libs con <100 stars, <1 commit al mes, sin tests.
- **Regulaciones especificas**: HIPAA (health), PCI (pagos), GDPR/CCPA (data), COPPA (menores).

## Regla final

Si despues de 5+ busquedas no hay claridad, **preguntar al usuario**. No adivinar.
