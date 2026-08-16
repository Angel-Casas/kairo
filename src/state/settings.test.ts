import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { useSettingsStore } from './settings'

const BASE = 'https://nano-gpt.com/api'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({
    apiKey: null,
    keyStatus: 'none',
    keyError: null,
    balanceUsd: null,
  })
})

describe('settings store', () => {
  it('saves a valid key, persists it, and records the balance', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ usd_balance: '42.5' }),
      ),
    )
    const ok = await useSettingsStore.getState().saveKey('  good-key-1234  ')
    expect(ok).toBe(true)
    const state = useSettingsStore.getState()
    expect(state.apiKey).toBe('good-key-1234')
    expect(state.keyStatus).toBe('valid')
    expect(state.balanceUsd).toBe(42.5)
    expect(localStorage.getItem('kairo.nanogpt.apiKey')).toBe('good-key-1234')
  })

  it('rejects an invalid key and does not persist it', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 401 }),
      ),
    )
    const ok = await useSettingsStore.getState().saveKey('bad-key')
    expect(ok).toBe(false)
    const state = useSettingsStore.getState()
    expect(state.apiKey).toBeNull()
    expect(state.keyStatus).toBe('error')
    expect(state.keyError).toMatch(/rejected/)
    expect(localStorage.getItem('kairo.nanogpt.apiKey')).toBeNull()
  })

  it('keeps the existing valid key when a replacement fails validation', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ usd_balance: '10' }),
      ),
    )
    await useSettingsStore.getState().saveKey('good-key')
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 401 }),
      ),
    )
    const ok = await useSettingsStore.getState().saveKey('bad-key')
    expect(ok).toBe(false)
    const state = useSettingsStore.getState()
    expect(state.apiKey).toBe('good-key')
    expect(state.keyStatus).toBe('valid')
    expect(localStorage.getItem('kairo.nanogpt.apiKey')).toBe('good-key')
  })

  it('removeKey clears state and storage', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ usd_balance: '10' }),
      ),
    )
    await useSettingsStore.getState().saveKey('good-key')
    useSettingsStore.getState().removeKey()
    const state = useSettingsStore.getState()
    expect(state.apiKey).toBeNull()
    expect(state.keyStatus).toBe('none')
    expect(state.balanceUsd).toBeNull()
    expect(localStorage.getItem('kairo.nanogpt.apiKey')).toBeNull()
  })

  it('refreshBalance flags a revoked key', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ usd_balance: '10' }),
      ),
    )
    await useSettingsStore.getState().saveKey('good-key')
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ message: 'revoked' }, { status: 401 }),
      ),
    )
    await useSettingsStore.getState().refreshBalance()
    const state = useSettingsStore.getState()
    expect(state.keyStatus).toBe('error')
    expect(state.keyError).toMatch(/no longer valid/)
    expect(state.balanceUsd).toBeNull()
  })

  it('refreshBalance keeps last known balance on network errors', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ usd_balance: '10' }),
      ),
    )
    await useSettingsStore.getState().saveKey('good-key')
    server.use(http.post(`${BASE}/check-balance`, () => HttpResponse.error()))
    await useSettingsStore.getState().refreshBalance()
    const state = useSettingsStore.getState()
    expect(state.balanceUsd).toBe(10)
    expect(state.keyStatus).toBe('valid')
  })
})
