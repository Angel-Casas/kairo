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
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID } from '../domain/themes'
import { activeThemeId, useSettingsStore } from './settings'

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
    themeMode: 'dark',
    darkThemeId: DEFAULT_DARK_THEME_ID,
    lightThemeId: DEFAULT_LIGHT_THEME_ID,
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

describe('theme choice (ADR-010)', () => {
  it('setThemeMode switches mode and persists it', () => {
    useSettingsStore.getState().setThemeMode('light')
    expect(useSettingsStore.getState().themeMode).toBe('light')
    expect(localStorage.getItem('kairo.ui.mode')).toBe('light')
  })

  it('selectTheme stores a dark palette in the dark slot', () => {
    useSettingsStore.getState().selectTheme('lagoon')
    const state = useSettingsStore.getState()
    expect(state.darkThemeId).toBe('lagoon')
    expect(state.lightThemeId).toBe(DEFAULT_LIGHT_THEME_ID)
    expect(localStorage.getItem('kairo.ui.theme.dark')).toBe('lagoon')
  })

  it('selectTheme stores a light palette in the light slot', () => {
    useSettingsStore.getState().selectTheme('peony')
    const state = useSettingsStore.getState()
    expect(state.lightThemeId).toBe('peony')
    expect(state.darkThemeId).toBe(DEFAULT_DARK_THEME_ID)
    expect(localStorage.getItem('kairo.ui.theme.light')).toBe('peony')
  })

  it('selectTheme ignores unknown theme ids', () => {
    useSettingsStore.getState().selectTheme('not-a-theme')
    const state = useSettingsStore.getState()
    expect(state.darkThemeId).toBe(DEFAULT_DARK_THEME_ID)
    expect(state.lightThemeId).toBe(DEFAULT_LIGHT_THEME_ID)
    expect(localStorage.getItem('kairo.ui.theme.dark')).toBeNull()
  })

  it('activeThemeId follows the mode', () => {
    const store = useSettingsStore.getState()
    store.selectTheme('lagoon')
    store.selectTheme('peony')
    expect(activeThemeId(useSettingsStore.getState())).toBe('lagoon')
    useSettingsStore.getState().setThemeMode('light')
    expect(activeThemeId(useSettingsStore.getState())).toBe('peony')
  })

  it('each mode remembers its own palette across mode switches', () => {
    const store = useSettingsStore.getState()
    store.selectTheme('northsea')
    store.setThemeMode('light')
    store.selectTheme('meadow')
    useSettingsStore.getState().setThemeMode('dark')
    expect(activeThemeId(useSettingsStore.getState())).toBe('northsea')
  })

  it('chooseTheme switches to the palette AND its mode (single dropdown)', () => {
    useSettingsStore.getState().chooseTheme('peony')
    let state = useSettingsStore.getState()
    expect(state.themeMode).toBe('light')
    expect(state.lightThemeId).toBe('peony')
    expect(activeThemeId(state)).toBe('peony')
    expect(localStorage.getItem('kairo.ui.mode')).toBe('light')
    expect(localStorage.getItem('kairo.ui.theme.light')).toBe('peony')

    useSettingsStore.getState().chooseTheme('lagoon')
    state = useSettingsStore.getState()
    expect(state.themeMode).toBe('dark')
    expect(activeThemeId(state)).toBe('lagoon')
  })

  it('chooseTheme ignores unknown ids and keeps the current mode', () => {
    useSettingsStore.getState().chooseTheme('not-a-theme')
    const state = useSettingsStore.getState()
    expect(state.themeMode).toBe('dark')
    expect(activeThemeId(state)).toBe(DEFAULT_DARK_THEME_ID)
  })
})
