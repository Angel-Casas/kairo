import { useState } from 'react'
import { maskApiKey, type UsageTotals } from '../api/nanogpt'
import { NANOGPT_REFERRAL_URL, REPO_URL } from '../config'
import { useT } from '../i18n'
import { formatUsd } from '../lib/format'
import { getClient, useSettingsStore } from '../state/settings'

export function ApiKeySettings() {
  const t = useT()
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
      <h2 style={{ fontSize: 'var(--text-lg)' }}>{t('NanoGPT API key')}</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>
        {t(
          'Kairo runs on your own NanoGPT account: you pick the model at every step and pay only for what you generate. Your key is stored on this device only and is sent nowhere except NanoGPT itself —',
        )}{' '}
        <a href={REPO_URL} style={{ color: 'var(--color-accent)' }}>
          {t('the code is open')}
        </a>{' '}
        {t('so you can verify that.')}
      </p>

      {apiKey === null ? (
        <>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {t(
              "No NanoGPT account yet? Creating one through the link below supports Kairo's development at no extra cost to you.",
            )}
          </p>
          <p>
            <a
              href={NANOGPT_REFERRAL_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-accent)' }}
            >
              {t('Create a NanoGPT account →')}
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
              placeholder={t('Paste your NanoGPT API key')}
              aria-label="NanoGPT API key"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={draft.trim().length === 0 || keyStatus === 'validating'}
            >
              {keyStatus === 'validating'
                ? t('Validating…')
                : t('Validate & save')}
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
            {t('Key:')} <code>{maskApiKey(apiKey)}</code>
          </p>
          <p>
            {t('Balance:')}{' '}
            {balanceUsd !== null ? formatUsd(balanceUsd) : t('not loaded')}{' '}
            <button type="button" onClick={() => void refreshBalance()}>
              {t('Refresh')}
            </button>
          </p>
          {keyStatus === 'error' && keyError !== null && (
            <p role="alert" style={{ color: 'var(--color-danger)' }}>
              {keyError}
            </p>
          )}
          <AccountUsage apiKey={apiKey} />
          <button type="button" onClick={removeKey}>
            {t('Remove key from this device')}
          </button>
        </>
      )}
    </section>
  )
}

function AccountUsage({ apiKey }: { apiKey: string }) {
  const t = useT()
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
        {t('Account usage (this key)')}
      </h3>
      {usage !== null ? (
        <p aria-label="Account usage totals" style={{ margin: 0 }}>
          {t('{requests} requests, {usd} net spend.', {
            requests: usage.requests,
            usd: formatUsd(usage.netCostUsd),
          })}{' '}
          <button type="button" onClick={() => void load()}>
            {t('Refresh')}
          </button>
        </p>
      ) : (
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => void load()}
        >
          {status === 'loading' ? t('Loading…') : t('Load usage')}
        </button>
      )}
      {status === 'error' && (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {t('Usage could not be loaded. Check your connection and try again.')}
        </p>
      )}
    </div>
  )
}
