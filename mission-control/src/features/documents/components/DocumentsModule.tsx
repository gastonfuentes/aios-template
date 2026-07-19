'use client'

/**
 * Documents module — repository from `gd_documentos` with the expiry watchlist
 * from `gd_documentos_vencimientos`.
 *
 * `gd_documentos_vencimientos` is not a subset filter of `gd_documentos`: it
 * only carries documents that have an expiry date and buckets them by urgency.
 * That is the module's seeded signal, so it renders first.
 */

import { useMemo } from 'react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleSection, ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useViews2 } from '@/features/gannet/useView'
import {
  DOCUMENT_ENTITY,
  DOCUMENT_EXPIRY_BUCKET,
  DOCUMENT_TYPE,
  describe,
} from '@/features/gannet/labels'
import {
  EMPTY,
  formatDate,
  formatDaysRemaining,
  formatInteger,
} from '@/features/gannet/format'
import { toneForDaysRemaining } from '@/features/gannet/tone'
import type { Documento, DocumentoVencimiento } from '@/features/gannet/types'

const EXPIRY_COLUMNS: readonly Column<DocumentoVencimiento>[] = [
  {
    key: 'documento',
    header: 'Documento',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.documento}
        </div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(DOCUMENT_TYPE, row.documento_tipo).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.documento,
    searchValue: (row) => `${row.documento} ${row.documento_tipo ?? ''}`,
  },
  {
    key: 'entidad_nombre',
    header: 'Asociado a',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.entidad_nombre ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(DOCUMENT_ENTITY, row.entidad_tipo).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.entidad_nombre,
    searchValue: (row) => `${row.entidad_nombre ?? ''} ${row.entidad_tipo ?? ''}`,
  },
  {
    key: 'tramo',
    header: 'Tramo',
    render: (row) => {
      const bucket = describe(DOCUMENT_EXPIRY_BUCKET, row.tramo)
      return <Pill tone={bucket.tone}>{bucket.label}</Pill>
    },
    sortValue: (row) => row.orden_tramo,
    searchValue: (row) => row.tramo,
  },
  {
    key: 'fecha_vencimiento',
    header: 'Vencimiento',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="tabular-nums">{formatDate(row.fecha_vencimiento)}</span>
        <Pill tone={toneForDaysRemaining(row.dias_para_vencer)}>
          {formatDaysRemaining(row.dias_para_vencer)}
        </Pill>
      </div>
    ),
    sortValue: (row) => row.dias_para_vencer,
  },
  {
    key: 'fecha_emision',
    header: 'Emisión',
    hideBelow: 'lg',
    render: (row) => formatDate(row.fecha_emision),
    sortValue: (row) => row.fecha_emision,
  },
]

const DOCUMENT_COLUMNS: readonly Column<Documento>[] = [
  {
    key: 'documento',
    header: 'Documento',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.documento}
        </div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(DOCUMENT_TYPE, row.tipo).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.documento,
    searchValue: (row) => `${row.documento} ${row.tipo ?? ''}`,
  },
  {
    key: 'entidad_nombre',
    header: 'Asociado a',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.entidad_nombre ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(DOCUMENT_ENTITY, row.entidad_tipo).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.entidad_nombre,
    searchValue: (row) => `${row.entidad_nombre ?? ''} ${row.entidad_tipo ?? ''}`,
  },
  {
    key: 'fecha_emision',
    header: 'Emisión',
    hideBelow: 'md',
    render: (row) => formatDate(row.fecha_emision),
    sortValue: (row) => row.fecha_emision,
  },
  {
    key: 'fecha_vencimiento',
    header: 'Vencimiento',
    render: (row) => {
      if (row.fecha_vencimiento === null) {
        return <span style={{ color: 'var(--label-tertiary)' }}>Sin vencimiento</span>
      }
      return (
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums">{formatDate(row.fecha_vencimiento)}</span>
          <Pill tone={toneForDaysRemaining(row.dias_para_vencer)}>
            {formatDaysRemaining(row.dias_para_vencer)}
          </Pill>
        </div>
      )
    },
    sortValue: (row) => row.dias_para_vencer,
  },
  {
    key: 'tamano_kb',
    header: 'Tamaño',
    align: 'right',
    hideBelow: 'xl',
    render: (row) =>
      row.tamano_kb === null ? EMPTY : `${formatInteger(row.tamano_kb)} KB`,
    sortValue: (row) => row.tamano_kb,
  },
]

export function DocumentsModule() {
  const { primary: documents, secondary: expiring, loading, error, reload } = useViews2<
    Documento,
    DocumentoVencimiento
  >('gd_documentos', 'gd_documentos_vencimientos')

  const summary = useMemo(() => {
    const expired = expiring.filter((row) => row.esta_vencido === true).length
    const within30 = expiring.filter(
      (row) => row.esta_vencido !== true && (row.dias_para_vencer ?? Infinity) <= 30,
    ).length
    const withoutExpiry = documents.filter((row) => row.fecha_vencimiento === null).length
    return { expired, within30, withoutExpiry }
  }, [documents, expiring])

  return (
    <ModuleShell
      title="Documentación"
      description="Repositorio documental de clientes, personal, equipos y vehículos, con control de vigencia."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Documentos registrados"
          value={formatInteger(documents.length)}
          hint={`${formatInteger(summary.withoutExpiry)} sin fecha de vencimiento`}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Documentos vencidos"
          value={formatInteger(summary.expired)}
          hint="Requieren renovación inmediata"
          tone={summary.expired > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Vencen en 30 días"
          value={formatInteger(summary.within30)}
          hint="Renovación a gestionar"
          tone={summary.within30 > 0 ? 'warning' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Bajo control de vigencia"
          value={formatInteger(expiring.length)}
          hint="Documentos con fecha de vencimiento"
          tone="accent"
          loading={loading}
        />
      </StatGrid>

      <ModuleSection
        title="Vencimientos"
        description="Documentos vencidos y próximos a vencer, ordenados por urgencia."
      >
        <DataTable
          rows={expiring}
          columns={EXPIRY_COLUMNS}
          getRowId={(row) => String(row.documento_id)}
          loading={loading}
          pageSize={15}
          initialSort={{ key: 'fecha_vencimiento', direction: 'asc' }}
          searchPlaceholder="Buscar por documento o entidad asociada…"
          emptyMessage="No hay documentos próximos a vencer."
          rowAccent={(row) => (row.esta_vencido ? 'var(--sys-red)' : 'var(--sys-orange)')}
        />
      </ModuleSection>

      <ModuleSection title="Repositorio documental">
        <DataTable
          rows={documents}
          columns={DOCUMENT_COLUMNS}
          getRowId={(row) => String(row.documento_id)}
          loading={loading}
          pageSize={25}
          initialSort={{ key: 'fecha_vencimiento', direction: 'asc' }}
          searchPlaceholder="Buscar por documento, tipo o entidad…"
          emptyMessage="Todavía no hay documentos cargados."
          rowAccent={(row) => (row.esta_vencido ? 'var(--sys-red)' : null)}
        />
      </ModuleSection>
    </ModuleShell>
  )
}
