/**
 * /dashboard — placeholder minimal post-PRP-035.
 *
 * Hero section (h1 "Dashboard" + p descripcion) removida en PRP-035 (titulo
 * vive en Toolbar top global). El contenido productivo (metricas BI, atajos,
 * actividad reciente) llegara en un PRP futuro. Mientras tanto, microcopy
 * tertiary centrado para no dejar la pagina visualmente rota.
 */
export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <p
        className="text-callout normal-case"
        style={{ color: 'var(--label-tertiary)' }}
      >
        Aqui vivira el panel de mando — metricas, atajos, lo que pase en
        Gannet OS de un vistazo.
      </p>
    </div>
  )
}
