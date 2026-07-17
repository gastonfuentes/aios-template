'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { useScheduledJobs } from '../hooks/useScheduledJobs'
import { ScheduledItem } from './ScheduledItem'
import { ScheduledFormModal } from './ScheduledFormModal'
import type { ScheduledTask } from '../types'

export function ScheduledList() {
  const {
    tasks,
    loading,
    error,
    runNow,
    pause,
    resume,
    remove,
    create,
    update,
  } = useScheduledJobs()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledTask | null>(null)

  function openEdit(task: ScheduledTask) {
    setEditing(task)
    setModalOpen(true)
  }

  // PRP-035 iter post-cierre: el boton "+ Nuevo" vive ahora en el Toolbar
  // global y dispatchea `aios:scheduled:new` cuando se clickea. Listener
  // registrado al mount, cleanup al unmount. El handler es stable (no
  // depende de props/state externos), por eso deps array vacio. setState
  // dentro de callbacks NO dispara la regla react-hooks/set-state-in-effect
  // (aprendizaje canonico PRP-034).
  useEffect(() => {
    const handler = () => {
      setEditing(null)
      setModalOpen(true)
    }
    window.addEventListener('aios:scheduled:new', handler)
    return () => window.removeEventListener('aios:scheduled:new', handler)
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-8">
      {error && (
        <div
          className="mc-card rounded-card p-4 text-callout"
          style={{ color: 'var(--sys-orange)' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && tasks.length === 0 && (
        <div
          className="mc-card rounded-card p-4 text-callout"
          style={{ color: 'var(--label-tertiary)' }}
        >
          Cargando jobs…
        </div>
      )}

      {!loading && tasks.length === 0 && !error && (
        <div
          className="mc-card flex flex-col items-center gap-3 rounded-card p-12 text-center"
          style={{ color: 'var(--label-tertiary)' }}
        >
          <Clock size={32} strokeWidth={1.5} />
          <p className="text-body">No hay cron jobs activos.</p>
          <p className="text-callout normal-case" style={{ color: 'var(--label-tertiary)' }}>
            Crea uno para que el daemon corra prompts en horarios fijos.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {tasks.map((task) => (
          <ScheduledItem
            key={task.id}
            task={task}
            onRunNow={() => void runNow(task.id)}
            onPause={() => void pause(task.id)}
            onResume={() => void resume(task.id)}
            onDelete={() => void remove(task.id)}
            onEdit={() => openEdit(task)}
          />
        ))}
      </div>

      <ScheduledFormModal
        key={editing?.id ?? 'create-new'}
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={async (input) => {
          if (editing) {
            return update(editing.id, {
              prompt: input.prompt,
              schedule: input.schedule,
            })
          }
          return create(input)
        }}
      />
    </div>
  )
}
