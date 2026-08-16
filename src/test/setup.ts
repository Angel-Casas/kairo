import '@testing-library/jest-dom/vitest'
// jsdom has no IndexedDB; fake-indexeddb provides a spec-compliant one for
// component tests. Persistence tests create their own fresh IDBFactory.
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL auto-cleanup only registers with vitest globals enabled; we don't use
// globals, so unmount rendered components between tests explicitly.
afterEach(() => {
  cleanup()
})
