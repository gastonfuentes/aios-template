# Gannet OS — Guía de preguntas y respuestas para el congreso

> Documento de preparación para el stand. Última actualización: 2026-07-22.
> Verificado contra el estado real del código y del preview, no contra el plan.

---

## 0. Cómo usar esta guía

No la leas de corrido en el stand. Leela entera **hoy**, marcá las cinco
respuestas que más te cuesten, y practicá esas en voz alta. En el stand solo
vas a tener tiempo de mirar el anexo de números.

### Las 5 reglas de oro

1. **Nunca presentes a Andes Servicios Integrales como un cliente real.**
   Es la única mentira que puede costarte la venta entera. Si un visitante
   descubre solo que le mentiste en eso, va a asumir que le mentiste en todo
   lo demás. La respuesta honesta además vende mejor: *"Es una empresa modelo
   que armamos justamente para que vos te veas reflejado."*

2. **Nunca cites un número de memoria.** Los montos de cobranza vencida se
   calculan contra la fecha de hoy, así que cambian de un día para el otro.
   Señalá el número **en la pantalla**, no el que recordás del ensayo.

3. **"No lo tenemos todavía" es una respuesta profesional.** "Sí, eso también
   lo hace" cuando no lo hace es una promesa que alguien te va a cobrar en la
   implementación. Decí: *"Hoy no. Está en el roadmap / se puede construir."*

4. **Preguntá antes de responder.** Cuando alguien pregunta "¿maneja X?",
   preguntale cómo lo hace hoy. Su respuesta te da el pitch y te da el lead.

5. **Si algo falla en vivo, no lo escondas.** Cerrás, reabrís, seguís
   hablando. La sección 13 tiene los guiones.

---

## 1. La respuesta de 30 segundos

**"¿Qué es esto?"**

> Gannet OS es el sistema operativo para empresas proveedoras de la minería.
> Todo lo que hoy tenés en diez planillas de Excel y tres sistemas que no se
> hablan entre sí — clientes, cotizaciones, proyectos, órdenes de trabajo,
> compras, stock, equipos, flota, personal, facturación y documentación — en un
> solo lugar, y con una IA arriba a la que le preguntás en castellano lo que
> necesitás saber.

Después de eso, **callate y preguntá**: *"¿Vos de qué rubro sos?"* — y abrí el
módulo que le toque.

**Versión de una frase, para pasillo:**
> Es el sistema para el proveedor minero, no para la minera.

---

## 2. Preguntas sobre el producto

**¿Para quién es esto exactamente?**
> Para la empresa que le presta servicios a la minera. Mantenimiento, obra
> civil, eléctrica, instrumentación, soldadura, transporte, alquiler de
> equipos, movimiento de suelos, campamento, limpieza industrial. Si facturás
> a una minera, es para vos.

**¿Y si yo hago solo una cosa, solo transporte?**
> Mejor todavía. La demo muestra diez servicios porque en el stand pasa gente
> de todos los rubros. Tu instalación arranca con los módulos que usás. Nadie
> paga por módulos que no abre.

**¿Cuántos módulos tiene?**
> Trece. Dashboard ejecutivo, clientes, cotizaciones, proyectos, órdenes de
> trabajo, compras, stock, equipos, flota, RRHH, facturación, documentación, y
> el agente de IA que atraviesa todo.

**¿Esto reemplaza mi sistema contable?**
> No, y no queremos. El contable factura y liquida impuestos; eso ya lo tenés
> resuelto. Gannet OS es la capa operativa: qué se está ejecutando, con qué
> gente, con qué equipos, qué se cotizó, qué se cobró y qué no. Se integra con
> tu facturación, no la reemplaza.

**¿Funciona en el celular?**
> La interfaz es responsive y se instala como aplicación en el teléfono. Para
> el trabajo en faena sin señal, el planteo correcto es una app con carga
> offline que sincroniza al volver — eso lo diseñamos junto con vos, no viene
> de fábrica.

**¿Cuántos usuarios soporta?**
> No es el cuello de botella para una empresa de tu tamaño. Sí conversemos por
> perfiles: no es lo mismo veinte personas cargando partes diarios que cinco
> mirando reportes.

**¿Hay control de permisos por rol?**
> Sí, la base es multi-rol con permisos a nivel de fila en la base de datos —
> o sea, el permiso no vive en la pantalla, vive en el motor. La demo del
> stand corre sin login a propósito, para que puedas tocar todo sin que se
> venza una sesión.

---

## 3. Preguntas sobre los datos del demo — **la sección más importante**

Esta es la que puede romper todo. Practicala.

**¿Estos son datos reales? ¿Andes es cliente de ustedes?**
> No, y te lo aclaro de entrada. Andes Servicios Integrales es una empresa
> modelo que construimos nosotros. Los casi treinta mil registros que estás
> viendo son generados. La elegimos multidisciplinaria justamente para que
> cualquiera que pase por acá encuentre su parte del negocio adentro.

**Entonces, ¿me estás mostrando una maqueta?**
> No. Una maqueta son pantallas dibujadas. Esto es el sistema funcionando
> sobre una base de datos real, con las consultas reales. Lo único ficticio son
> los nombres y los montos. Si mañana cargamos tus datos, es esta misma
> pantalla.

**Esos números de mora no cierran, ninguna empresa sobrevive así.**
> (Es una observación válida — el dataset tiene un nivel de mora alto a
> propósito, para que se vea el módulo de cobranzas cargado.)
>
> Buen ojo. Es un dataset de demostración y está cargado hacia el lado
> incobrable para que el módulo de cobranzas tenga algo que mostrar. Con tus
> números reales la curva es la tuya. Lo que importa acá es que el sistema te
> dice a quién llamar primero, no cuánto debe una empresa que no existe.

**¿De dónde sacaron los nombres de las mineras?**
> Son inventados. Litio del Norte, Puna Minerals, Altos Andes, Sal de los
> Andes, Cordillera Lithium, Andean Copper. Ninguna existe, a propósito: no
> quisimos poner nombres reales en una demo.

**¿Puedo probarlo con mis datos?**
> Sí, y es el mejor siguiente paso. Nos pasás un Excel de clientes y otro de
> órdenes de trabajo, y te lo devolvemos cargado. Ahí lo ves con tus nombres y
> tus montos. — **Anotá el contacto acá.**

---

## 4. Preguntas técnicas

**¿Dónde corre? ¿Es la nube de quién?**
> Corre en un servidor propio, no en una plataforma de terceros donde tus
> datos son el producto. Podemos instalarlo en un servidor nuestro dedicado a
> vos, o dentro de tu propia infraestructura si tenés política de que los
> datos no salen de la empresa.

**¿Qué tecnología usa?**
> Base de datos PostgreSQL, aplicación web moderna, y la capa de IA sobre
> modelos Claude de Anthropic. Nada exótico: cualquier desarrollador puede
> tomar esto y mantenerlo.

**Esto es un "no-code" / lo armaron con IA, ¿no?**
> Está construido con asistencia de IA, sí, y lo decimos sin problema. Lo que
> importa es qué hay abajo: base de datos versionada, migraciones, tipado
> estricto, revisiones de seguridad. Se puede auditar. Te muestro el esquema si
> querés.

**¿Y si se cae el servidor?**
> El servicio se reinicia solo y sobrevive a un reinicio de la máquina. Los
> respaldos de la base son la conversación seria que hay que tener en la
> implementación, no un checkbox de la demo: frecuencia, retención y — lo que
> nadie prueba — la restauración.

**¿Velocidad? Somos muchos registros.**
> La consulta más lenta de esta demo está en el orden de milisegundos sobre
> treinta mil registros. Volúmenes de cientos de miles no mueven la aguja en
> Postgres si el modelo está bien hecho.

**¿Cómo hacen los cambios? ¿Cada pedido mío es un proyecto de tres meses?**
> No. El diferencial nuestro es la velocidad de cambio: este sistema completo,
> trece módulos, se construyó en días. Un módulo nuevo tuyo se mide en días,
> no en trimestres.

---

## 5. Seguridad, soberanía y propiedad de los datos

**¿De quién son los datos?**
> Tuyos. Están en tu base, en tu servidor. Si mañana te querés ir, te llevás
> un volcado completo de la base de datos. No hay secuestro de datos.

**¿Qué pasa si ustedes desaparecen?**
> Pregunta correcta y te la contesto sin vueltas: es software, corre en tu
> servidor, con una base Postgres estándar. Peor escenario, cualquier equipo de
> desarrollo lo levanta. No es una caja negra que se apaga si nosotros nos
> apagamos.

**¿Mis datos se van a un modelo de IA para entrenarlo?**
> No. La IA consulta tus datos para responderte, no los usa para entrenarse.
> Y si tu política es que ningún dato salga de la empresa, se puede plantear
> con un modelo corriendo dentro de tu propia infraestructura.

**¿Esta demo pública no es un agujero de seguridad?**
> Es intencional y solo para el congreso: sin login, y con la base en modo
> **solo lectura** para el visitante. No hay datos reales de nadie adentro.
> Una instalación productiva no se parece en nada a esto: sesión obligatoria,
> permisos por rol y a nivel de fila.

> ⚠️ **Interno, no decir en el stand:** hay dos superficies heredadas sin
> control de sesión (`/api/proveedores`) y el bot de Telegram corre con
> permisos amplios sobre el proyecto. No es un problema para la demo — no hay
> datos reales — pero **no ofrezcas el bot de Telegram como parte del producto**
> y no invites a nadie a auditar la instalación del congreso.

---

## 6. La IA — la estrella y la parte más frágil

**¿Qué le puedo preguntar?**
> En castellano, lo que le preguntarías a tu jefe de administración. Está
> conectada a veintidós consultas sobre los datos reales del sistema: flota,
> cobranzas, clientes, proyectos, personal, stock, equipos, cotizaciones,
> vencimientos de documentación, faenas, agenda.

**Preguntas seguras para demostrar** (probadas, están en pantalla como sugerencias):
- ¿Qué vehículos no están en condiciones de circular y por qué?
- ¿Qué cliente me debe más vencido y desde cuándo?
- ¿A quién llamo primero para cobrar cinco mil millones esta semana?

**Preguntas que conviene evitar en vivo:**
- Conteos por provincia ("¿cuántos clientes hay en Catamarca?") — la IA cuenta
  clientes **con faena activa** y el módulo de clientes lista la **cartera
  completa**, así que pueden dar distinto. Ver sección 13 para el guion de
  recuperación.
- Márgenes y rentabilidad — se sacaron a propósito del demo porque los datos
  de origen estaban mal escalados.
- Cualquier cosa fuera de los datos del sistema (clima, precio del cobre,
  noticias). No es un chatbot de propósito general.

**¿Es ChatGPT?**
> Usa modelos Claude, de Anthropic. Pero la diferencia importante no es la
> marca del modelo: es que este agente **solo puede leer tus datos**, con
> consultas cerradas y auditables. No puede escribir, no puede borrar, y no
> puede inventar un número. Si no tiene el dato, dice "no tengo ese dato".

**¿Y si me miente? Los chatbots inventan.**
> Ese es exactamente el problema que atacamos. Hay un control que intercepta
> la respuesta: si el agente dice un número que no salió de una consulta a la
> base en ese mismo momento, la respuesta se descarta y no te llega. Preferimos
> que te diga "no lo sé" antes que darte un número inventado. En un sistema de
> gestión, un número inventado es peor que no tener sistema.

**¿Puedo pedirle que haga cosas, no solo que consulte?**
> Hoy lee. Escribir — crear una orden de trabajo dictándola, cargar un parte —
> es el paso siguiente, y es donde esto se pone realmente interesante. Pero no
> te lo vendo como que ya está.

**¿Anda por WhatsApp / Telegram?**
> Técnicamente sí, es la misma arquitectura. Para el congreso lo dejamos fuera
> a propósito: depende de la señal del predio y no quiero que veas fallar la
> red y pienses que falla el sistema. Es una conversación de implementación.

---

## 7. Implementación, migración e integraciones

**¿Cuánto tarda en estar andando?**
> Depende de una sola variable: en qué estado están tus datos hoy. Si tenés
> Excels ordenados, la carga inicial es cuestión de días. Si está todo en la
> cabeza de tres personas, primero hay que ordenarlo — y esa parte la hacemos
> juntos, es la mitad del valor.

**Tengo todo en Excel. ¿Sirve?**
> Es el mejor punto de partida. Excel ordenado es un modelo de datos que ya
> pensaste. Lo importamos.

**¿Se integra con AFIP / ARCA para facturar?**
> Hoy el módulo de facturación registra y controla comprobantes y cobranza; no
> emite contra el organismo. La integración es técnicamente estándar y la
> hacemos si es requisito tuyo. No te voy a decir que ya está cuando no está.

**¿Se integra con Tango / Bejerman / SAP / lo que ya tengo?**
> Si tiene base de datos o API, sí. El planteo sano no es reemplazar tu
> contable de un día para el otro: es que Gannet OS maneje la operación y le
> pase a tu sistema lo que necesita para facturar.

**¿Y el control de acceso a mina / los sistemas de la minera?**
> Cada minera tiene el suyo y no se tocan. Lo que sí resolvemos es lo que te
> duele: tener la documentación de tu gente y tus equipos al día y saber, antes
> de que te lo pidan, qué se te vence la semana que viene. Eso es el módulo de
> documentación.

**¿Capacitan a la gente?**
> Sí, y la parte buena es que la IA baja mucho la capacitación: el que no
> encuentra la pantalla, pregunta.

---

## 8. Comercial

> **Definí el precio antes de mañana.** "No sé" en precio es la peor respuesta
> del stand. Si todavía no está cerrado, usá la respuesta de abajo tal cual.

**¿Cuánto sale?**
> Trabajamos con una implementación inicial, que depende de cuántos módulos y
> del estado de tus datos, y después un abono mensual por soporte y
> evolución. Prefiero no tirarte un número al aire: en veinte minutos de
> charla con tus datos te paso una propuesta cerrada. ¿Te agendo esa charla?

**¿Es por usuario?**
> (Definir. Recomendación: por empresa y módulos, no por usuario — el precio
> por usuario castiga que lo use más gente, que es justo lo que querés.)

**¿Hay permanencia?**
> (Definir.)

**¿Tienen otros clientes en minería? ¿Referencias?**
> Estamos entrando al sector, y este congreso es parte de eso. Lo que te puedo
> mostrar es el sistema funcionando, y lo que te puedo ofrecer es lo que un
> proveedor grande no te da: que hablás directo con quien lo construye y que
> los cambios salen en días. Si buscás un proveedor con veinte años en
> minería, no somos nosotros. Si buscás velocidad, sí.

**¿Quiénes son ustedes? ¿Cuánta gente?**
> Somos un equipo chico y técnico. Lo digo de frente porque es la ventaja y la
> desventaja: no vas a tener un call center, vas a tener a la persona que
> escribió el sistema atendiéndote el teléfono.

**¿Hacen desarrollo a medida?**
> Sí, y de hecho es el modelo: esto es la base, tu operación le da la forma.

---

## 9. Objeciones frecuentes

| Te dicen | Respondé |
|---|---|
| "Ya tengo un sistema" | "¿Y lo usa todo el mundo, o hay Excels paralelos? Los Excels paralelos son la lista de lo que tu sistema no resuelve." |
| "Mi gente no lo va a usar" | "Es la objeción más real de todas. Por eso empezamos por un módulo que le resuelva algo a ellos, no a vos. Si el primer módulo solo sirve para controlarlos, no lo usa nadie." |
| "Es muy caro" | "¿Comparado con qué? Poné cuántas horas por mes se van en armar el reporte que acá sale en un clic, y cuánto de tu cobranza vencida se venció por no haber mirado." |
| "Somos muy chicos para esto" | "Entonces arrancás con dos módulos. Lo caro es al revés: crecer con la información desordenada." |
| "Lo tengo que hablar con mi socio" | "Perfecto, es la respuesta correcta. Te dejo el acceso a la demo para que se la muestres, y lo vemos los tres." (**pedí el contacto**) |
| "Mandame información" | "Te la mando, pero la información sola no dice nada. ¿Te sirve que la semana que viene te lo muestre con tus datos cargados?" |
| "Esto lo hago con ChatGPT" | "ChatGPT no sabe cuántos camiones tenés con la VTV vencida. El modelo es la parte fácil; lo difícil, y lo que estás viendo acá, es tener tus datos ordenados para que se los pueda preguntar." |

---

## 10. Competencia

**¿En qué son mejores que SAP?**
> No competimos con SAP y no te voy a decir que sí. SAP es para la minera.
> Para un proveedor de cincuenta o doscientas personas, SAP es una
> implementación que no termina nunca y un costo que no cierra. Nosotros somos
> lo contrario: andando en semanas y cambiándolo en días.

**¿Y Odoo, que es gratis?**
> Odoo es una buena herramienta y no es gratis: es gratis la licencia y caro
> el implementador. Lo instalás y te queda un ERP genérico que no sabe qué es
> una orden de trabajo en faena, ni una VTV vencida, ni una calibración de
> equipo. Nosotros arrancamos sabiendo eso.

**¿Y si me lo hace un programador conocido?**
> Puede. Preguntale dos cosas: cuánto tarda, y qué pasa cuando se va. Lo que
> ves acá ya está construido y tiene un equipo detrás.

---

## 11. Preguntas trampa de gente de la industria

Estos son los que te miran el detalle. Si contestás bien acá, te compraron.

**"¿Eso es una orden de trabajo de verdad? Falta X."**
> Casi seguro tiene razón en algo. Respondé: *"Contame qué le falta"* y
> **anotalo**. Un pliego de requisitos gratis vale más que una venta.
> No prometas que ya está.

**Flota: "¿Esa unidad no debería estar habilitada?"**
> El sistema separa dos cosas que normalmente se confunden: si el vehículo
> está **mecánicamente operativo** y si está **en condiciones de circular**,
> que además exige VTV y seguro vigentes. Por eso podés tener una unidad
> operativa que no puede salir, y el sistema te dice cuál es el motivo.

**Flota: "Esa marca y ese modelo no existen juntos."**
> (Se corrigió el 20/07: marcas y modelos ahora se generan siempre como par.)
> Si igual aparece algo raro: *"Es data generada, gracias — lo anoto."* Y
> anotalo de verdad.

**Seguridad e higiene: "¿Maneja incidentes / HSE?"**
> Hay indicadores de accidentes del mes e incidentes del año en RRHH. Un
> módulo HSE serio — investigación de incidente, acciones correctivas,
> capacitaciones y vencimientos por persona — es un módulo propio, y es de los
> primeros que construiríamos. ¿Cómo lo llevás hoy?

**Documentación: "¿Me avisa cuando se vence algo?"**
> El módulo de documentación tiene la lista de vencimientos por delante. La
> notificación proactiva — que te llegue el aviso sin que entres a mirar — es
> exactamente el paso siguiente del producto.

**"¿Maneja subcontratistas?"**
> El módulo de compras maneja proveedores con calificación y cumplimiento de
> plazos. Si tu negocio es subcontratar frentes completos, eso merece su
> propio tratamiento; contame cómo lo llevás.

**"¿Certificaciones? ¿ISO? ¿Auditoría?"**
> Hay trazabilidad: quién hizo qué y cuándo queda en la base. Una
> certificación formal es un proceso de tu empresa, no del software; lo que el
> software tiene que hacer es no ser el obstáculo cuando te auditan.

---

## 12. Si preguntan por el recorrido / quieren ver más

**Recorrido recomendado de tres minutos** (usá este orden, es el que está
diseñado para narrarse):

1. **Dashboard ejecutivo** — arrancá por el número grande: la cobranza
   vencida. *"Esto es lo primero que ve el dueño a la mañana."*
2. **Clic en una barra del ranking de clientes** → te lleva a las órdenes de
   trabajo **filtradas por ese cliente**. Ese clic es el momento "ah, es
   real". Usalo siempre.
3. **IA** — una de las tres preguntas sugeridas. Cerrá ahí.

Si tenés más tiempo y te piden profundidad: **clientes** (tiene ficha de
detalle) y **flota** (tiene la historia del apto/no apto). Los demás módulos
son listas cargadas — mostralos rápido, para densidad, no para detalle.

> ⚠️ **No prometas abrir una orden de trabajo individual: ese detalle no está
> construido.** El drill-down que sí funciona es dashboard → cliente → sus
> órdenes.

---

## 13. Guiones de recuperación — si algo falla en vivo

**Regla general:** nunca te quedes en silencio mirando la pantalla. Hablá
mientras se recupera. El público perdona un error técnico; no perdona el
pánico.

**La IA contesta "No tengo ese dato".**
> "Ahí ves algo que para mí es una función, no un error: prefiere decirte que
> no sabe antes que inventarte un número." (Y cambiá a otra pregunta.)

**La IA da un número distinto al de la pantalla** (caso conteos por provincia):
> "Buena observación, y la diferencia tiene sentido: el agente te está
> contando los clientes con faena activa y la pantalla te lista la cartera
> completa, incluidos prospectos. Son dos preguntas distintas." — Es cierto, y
> es la respuesta correcta. **Anotalo igual**, hay que unificarlo.

**La IA tarda mucho.**
> Contá qué está haciendo mientras: *"Está consultando la base, no está
> inventando — por eso tarda unos segundos."* Corta sola a los 28 segundos.

**Se cae internet del predio.**
> "Está corriendo en nuestro servidor, así que esto es la red del predio."
> Pasá al **video** o a las capturas del teléfono y seguí la charla.
>
> ⚠️ **Interno:** la copia local en la notebook **no arranca hoy** (falta la
> configuración de entorno). Si no se resuelve antes de mañana, tu plan B es el
> **video grabado** y capturas en el celular. **Confirmá que el video existe.**

**Alguien encuentra un dato absurdo.**
> "Es data generada, tenés razón. Gracias — lo anoto." Nunca discutas un dato
> ficticio. Perdés aunque ganes.

---

## 14. Qué NO decir nunca

- ❌ "Andes es un cliente nuestro." → Es la única mentira que te hunde.
- ❌ Un número de cobranza vencida de memoria. → Cambia todos los días.
- ❌ "Sí, eso ya lo hace" sin estar seguro. → Te lo cobran después.
- ❌ "Es 100% seguro." → Nada lo es; decí qué hay y qué falta.
- ❌ "La IA nunca se equivoca."
- ❌ Nombres de mineras reales como si fueran clientes.
- ❌ Hablar mal de un competidor por deporte. Reconocé lo que hace bien y
  marcá dónde no te sirve.

---

## 15. Cierre y captura de lead

Todo el stand existe para esto. No termines una conversación sin **una** de
estas tres:

1. **La mejor:** *"Pasame un Excel de clientes y otro de órdenes de trabajo y
   la semana que viene te lo muestro con tus datos."*
2. **La buena:** reunión agendada, con día y hora, ahí mismo.
3. **La mínima:** nombre, empresa, rubro, WhatsApp — y **qué le faltaba** al
   sistema según él.

Anotá siempre el rubro y la objeción. Esa lista es el roadmap del producto.

---

## Anexo — Números y hechos verificados

Números **estables** del demo (no cambian de un día para el otro):

| Dato | Valor |
|---|---|
| Módulos navegables | 13 |
| Registros generados | ~29.600 |
| Clientes (mineras) | 30 |
| Empleados | 140 |
| Vehículos | 45 |
| Equipos y herramientas | 280 |
| Órdenes de trabajo | 1.350 |
| Cotizaciones | 420 |
| Facturas | 980 |
| Órdenes de compra | 640 |
| Servicios que presta Andes | 10 |
| Consultas que puede hacer la IA | 22 |
| Tablas en el esquema | 24 |
| Consulta más lenta | milisegundos |
| Tiempo de construcción | días, no meses |

**Nunca** cites de memoria: cobranza vencida, facturación acumulada, % de mora.
Se calculan contra la fecha de hoy. Señalá la pantalla.

**Nombres a usar:** empresa modelo **Andes Servicios Integrales S.A.**;
clientes ficticios Litio del Norte, Puna Minerals, Altos Andes Mining, Sal de
los Andes, Cordillera Lithium, Andean Copper.

**Estado real, para no prometer de más:**

| Funciona hoy | No está construido |
|---|---|
| 13 módulos con datos cargados | Detalle de una orden de trabajo individual |
| Dashboard con gráficos y drill-down a cliente | Emisión de comprobantes a AFIP/ARCA |
| Ficha de detalle de cliente | Carga de datos por arrastrar un archivo |
| Flota con apto/no apto y motivo | Notificaciones proactivas de vencimientos |
| IA de solo lectura con 22 consultas | IA que escriba o cargue datos |
| Control anti-invención de números | Módulo HSE completo |
| Corre en servidor propio, sin plataforma de terceros | App offline para faena |
