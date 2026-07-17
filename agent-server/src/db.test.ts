/**
 * Tests del weekly key ISO-8601 (FIX 3).
 *
 * Casos borde reales del calendario ISO-8601:
 *  - 1 enero 2024 cayó en LUNES → semana 1 de 2024.
 *  - 31 diciembre 2024 cayó en MARTES → pertenece a semana 1 de 2025.
 *  - 1 enero 2026 cae en JUEVES → semana 1 de 2026.
 *  - 1 enero 2023 cayó en DOMINGO → pertenece a semana 52 de 2022.
 *  - 31 diciembre 2023 cayó en DOMINGO → semana 52 de 2023.
 */

import { describe, it, expect } from 'vitest'
import { currentWeekKey } from './db.js'

describe('currentWeekKey (FIX 3 — ISO-8601)', () => {
  it('1 enero 2024 (lunes) → semana 1 de 2024', () => {
    expect(currentWeekKey(new Date('2024-01-01T12:00:00Z'))).toBe('2024-W01')
  })

  it('31 diciembre 2024 (martes) → semana 1 de 2025 (rollover ISO)', () => {
    expect(currentWeekKey(new Date('2024-12-31T12:00:00Z'))).toBe('2025-W01')
  })

  it('1 enero 2026 (jueves) → semana 1 de 2026', () => {
    expect(currentWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01')
  })

  it('1 enero 2023 (domingo) → semana 52 de 2022 (rollback ISO)', () => {
    expect(currentWeekKey(new Date('2023-01-01T12:00:00Z'))).toBe('2022-W52')
  })

  it('31 diciembre 2023 (domingo) → semana 52 de 2023', () => {
    expect(currentWeekKey(new Date('2023-12-31T12:00:00Z'))).toBe('2023-W52')
  })

  it('formato siempre `YYYY-Www` con padding cero', () => {
    // semana 5 de 2026 = 26 enero – 1 febrero
    expect(currentWeekKey(new Date('2026-01-30T12:00:00Z'))).toBe('2026-W05')
  })
})
