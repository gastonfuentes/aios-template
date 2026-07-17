/**
 * Tests unitarios de `env.ts` (PRP-017).
 *
 * Cubre:
 *  - readEnvFile: parsing de KEY=value, quotes simples y dobles, comentarios,
 *    líneas vacías, filtrado por keys[].
 *  - validateRequiredEnv: aborta con MissingEnvError si falta alguna DAEMON_REQUIRED_ENV.
 *
 * Mock `fs.readFileSync` para controlar el contenido de .env sin tocar disco real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}))

import { readFileSync } from 'fs'
import {
  readEnvFile,
  validateRequiredEnv,
  MissingEnvError,
  DAEMON_REQUIRED_ENV,
} from './env.js'

const mockedRead = vi.mocked(readFileSync)

describe('readEnvFile', () => {
  beforeEach(() => {
    mockedRead.mockReset()
  })

  it('parsea KEY=value simple', () => {
    mockedRead.mockReturnValue('FOO=bar\nBAZ=qux' as never)
    const env = readEnvFile()
    expect(env).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('parsea valores con quotes dobles', () => {
    mockedRead.mockReturnValue('FOO="bar baz"\nQUUX=plain' as never)
    const env = readEnvFile()
    expect(env['FOO']).toBe('bar baz')
    expect(env['QUUX']).toBe('plain')
  })

  it('parsea valores con quotes simples', () => {
    mockedRead.mockReturnValue("FOO='hola mundo'" as never)
    const env = readEnvFile()
    expect(env['FOO']).toBe('hola mundo')
  })

  it('ignora líneas que empiezan con #', () => {
    mockedRead.mockReturnValue('# comentario\nFOO=bar\n# otro' as never)
    const env = readEnvFile()
    expect(env).toEqual({ FOO: 'bar' })
  })

  it('ignora líneas vacías y whitespace', () => {
    mockedRead.mockReturnValue('\n\n  \nFOO=bar\n\n' as never)
    const env = readEnvFile()
    expect(env).toEqual({ FOO: 'bar' })
  })

  it('ignora líneas sin = (malformed)', () => {
    mockedRead.mockReturnValue('FOO=bar\ngarbage line\nBAZ=qux' as never)
    const env = readEnvFile()
    expect(env).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('filtra por keys[] cuando se pasa', () => {
    mockedRead.mockReturnValue('FOO=bar\nBAZ=qux\nQUUX=zonk' as never)
    const env = readEnvFile(['FOO', 'QUUX'])
    expect(env).toEqual({ FOO: 'bar', QUUX: 'zonk' })
    expect(env['BAZ']).toBeUndefined()
  })

  it('retorna {} cuando .env no existe', () => {
    mockedRead.mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    expect(readEnvFile()).toEqual({})
  })

  it('preserva = literal en valores (URLs con =)', () => {
    mockedRead.mockReturnValue('URL=https://example.com?x=1&y=2' as never)
    const env = readEnvFile()
    expect(env['URL']).toBe('https://example.com?x=1&y=2')
  })
})

describe('validateRequiredEnv', () => {
  beforeEach(() => {
    mockedRead.mockReset()
  })

  it('retorna las 6 vars cuando todas están presentes', () => {
    const allPresent = DAEMON_REQUIRED_ENV
      .map((k) => `${k}=value_${k}`)
      .join('\n')
    mockedRead.mockReturnValue(allPresent as never)
    const env = validateRequiredEnv()
    for (const k of DAEMON_REQUIRED_ENV) {
      expect(env[k]).toBe(`value_${k}`)
    }
  })

  it('throws MissingEnvError cuando falta MC_SUPABASE_URL', () => {
    const partial = DAEMON_REQUIRED_ENV
      .filter((k) => k !== 'MC_SUPABASE_URL')
      .map((k) => `${k}=value`)
      .join('\n')
    mockedRead.mockReturnValue(partial as never)
    expect(() => validateRequiredEnv()).toThrow(MissingEnvError)
    expect(() => validateRequiredEnv()).toThrow(/MC_SUPABASE_URL/)
  })

  it('throws MissingEnvError cuando una var está empty', () => {
    const empty = DAEMON_REQUIRED_ENV
      .map((k) => (k === 'OPENCLAW_GATEWAY_TOKEN' ? `${k}=` : `${k}=v`))
      .join('\n')
    mockedRead.mockReturnValue(empty as never)
    expect(() => validateRequiredEnv()).toThrow(/OPENCLAW_GATEWAY_TOKEN/)
  })

  it('throws cuando .env entero falta (readEnvFile retorna {})', () => {
    mockedRead.mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    expect(() => validateRequiredEnv()).toThrow(MissingEnvError)
  })

  it('MissingEnvError.key contiene el nombre de la var faltante', () => {
    mockedRead.mockReturnValue('' as never)
    try {
      validateRequiredEnv()
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError)
      expect((err as MissingEnvError).key).toBe('MC_SUPABASE_URL')
    }
  })

  it('mensaje del error es accionable (incluye path .env + var)', () => {
    mockedRead.mockReturnValue('' as never)
    try {
      validateRequiredEnv()
    } catch (err) {
      expect((err as Error).message).toContain('agent-server/.env')
      expect((err as Error).message).toContain('Aborting before bind')
    }
  })
})

describe('DAEMON_REQUIRED_ENV', () => {
  it('contiene exactamente las 6 vars críticas del boot', () => {
    expect(DAEMON_REQUIRED_ENV).toEqual([
      'MC_SUPABASE_URL',
      'MC_SUPABASE_KEY',
      'OPENCLAW_GATEWAY_TOKEN',
      'MISSION_CONTROL_ORIGIN',
      'MISSION_CONTROL_URL',
      'MISSION_CONTROL_TOKEN',
    ])
  })
})
