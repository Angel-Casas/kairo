function App() {
  return (
    <>
      <header
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Kairo</h1>
      </header>
      <main style={{ padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Script → Scenes → Images → Animation → Export. Bring your own NanoGPT
          key; pay only for what you generate.
        </p>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Slice 0 scaffold — the pipeline arrives in the next slices.
        </p>
      </main>
    </>
  )
}

export default App
