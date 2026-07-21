/**
 * Tests for the Telegram chat allowlist.
 *
 * The allowlist is the only thing standing between an arbitrary Telegram user
 * and an agent that runs with full permissions on this host, so its parsing is
 * pinned here: a malformed entry must never widen access, and an empty value
 * must authorise nobody rather than everybody.
 */

import { describe, it, expect } from 'vitest'
import { parseAllowedChatIds } from './config.js'

describe('parseAllowedChatIds', () => {
  it('accepts a single id, as before the list was introduced', () => {
    expect(parseAllowedChatIds('123456')).toEqual(['123456'])
  })

  it('accepts two ids so a second person can be authorised', () => {
    expect(parseAllowedChatIds('123456,789012')).toEqual(['123456', '789012'])
  })

  it('trims surrounding whitespace around each entry', () => {
    expect(parseAllowedChatIds(' 123456 , 789012 ')).toEqual(['123456', '789012'])
  })

  it('drops empty entries from trailing or doubled separators', () => {
    expect(parseAllowedChatIds('123456,,789012,')).toEqual(['123456', '789012'])
  })

  it('returns an empty list for an empty value, authorising nobody', () => {
    expect(parseAllowedChatIds('')).toEqual([])
    expect(parseAllowedChatIds('   ')).toEqual([])
    expect(parseAllowedChatIds(',,')).toEqual([])
  })

  it('does not treat a negative group id as malformed', () => {
    expect(parseAllowedChatIds('-1001234567890')).toEqual(['-1001234567890'])
  })
})
