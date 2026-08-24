import { useState } from 'react'
import { maskApiKey, type UsageTotals } from '../api/nanogpt'
import { NANOGPT_REFERRAL_URL, REPO_URL } from '../config'
import { formatUsd } from '../lib/format'
import { getClient, useSettingsStore } from '../state/settings'

export function ApiKeySettings() {
  const apiKey = useSettingsStore((s) => s.apiKey)
  const keyStatus = useSettingsStore((s) => s.keyStatus)
  const keyError = useSettingsStore((s) => s.keyError)
  const balanceUsd = useSettingsStore((s) => s.balanceUsd)
  const saveKey = useSettingsStore((s) => s.saveKey)
  const removeKey = useSettingsStore((s) => s.removeKey)
  const refreshBalance = useSettingsStore((s) => s.refreshBalance)
  const [draft, setDraft] = useState('')

  return (
    <section style={{ maxWidth: '36rem' }}>
      <h2 style={{ fontSize: 'var(--text-lg)' }}>NanoGPT API key</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Kairo runs on your own NanoGPT account: you pick the model at every step
        and pay only for what you generate. Your key is stored on this device
        only and is sent nowhere except NanoGPT itself —{' '}
        <a href={REPO_URL} style={{ color: 'var(--color-accent)' }}>
          the code is open
        </a>{' '}
        so you can verify that.
      </p>

      {apiKey === null ? (
        <>
          <p style={{ color: 'var(--color-text-muted)' }}>
            No NanoGPT account yet? Creating one through the link below supports
            Kairo's development at no extra cost to you.
          </p>
          <p>
            <a
              href={NANOGPT_REFERRAL_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-accent)' }}
            >
              Create a NanoGPT account →
            </a>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveKey(draft).then((ok) => {
                if (ok) setDraft('')
              })
            }}
            style={{ display: 'flex', gap: 'var(--space-2)' }}
          >
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste your NanoGPT API key"
              aria-label="NanoGPT API key"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={draft.trim().length === 0 || keyStatus === 'validating'}
            >
              {keyStatus === 'validating' ? 'Validating…' : 'Validate & save'}
            </button>
          </form>
          {keyStatus === 'error' && keyError !== null && (
            <p role="alert" style={{ color: 'var(--color-danger)' }}>
              {keyError}
            </p>
          )}
        </>
      ) : (
        <>
          <p>
            Key: <code>{maskApiKey(apiKey)}</code>
          </p>
          <p>
            Balance:{' '}
            {balanceUsd !== null ? formatUsd(balanceUsd) : 'not loaded'}{' '}
            <button type="button" onClick={() => void refreshBalance()}>
              Refresh
            </button>
          </p>
          {keyStatus === 'error' && keyError !== null && (
            <p role="alert" style={{ color: 'var(--color-danger)' }}>
              {keyError}
            </p>
          )}
          <AccountUsage apiKey={apiKey} />
          <button type="button" onClick={removeKey}>
            Remove key from this device
          </button>
        </>
      )}
    </section>
  )
}

function AccountUsage({ apiKey }: { apiKey: string }) {
  const [usage, setUsage] = useState<UsageTotals | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const load = async () => {
    setStatus('loading')
    try {
      setUsage(await getClient(apiKey).getUsage())
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-4)',
        margin: 'var(--space-4) 0',
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: 'var(--text-base)' }}>
        Account usage (this key)
      </h3>
      {usage !== null ? (
        <p aria-label="Account usage totals" style={{ margin: 0 }}>
          {usage.requests} requests, {formatUsd(usage.netCostUsd)} net spent.{' '}
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
        </p>
      ) : (
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => void load()}
        >
          {status === 'loading' ? 'Loading…' : 'Load usage'}
        </button>
      )}
      {status === 'error' && (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          Usage could not be loaded. Check your connection and try again.
        </p>
      )}
    </div>
  )
}
