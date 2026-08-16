import { useEffect } from 'react'
import { ProjectList } from './components/ProjectList'
import { useAppStore } from './state/store'

function App() {
  const loaded = useAppStore((s) => s.loaded)
  const init = useAppStore((s) => s.init)
  const selectedProjectId = useAppStore((s) => s.selectedProjectId)
  const projects = useAppStore((s) => s.projects)
  const select = useAppStore((s) => s.select)

  useEffect(() => {
    void init()
  }, [init])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

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
      <main style={{ padding: 'var(--space-8)', maxWidth: '48rem' }}>
        {!loaded ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : selectedProject !== undefined ? (
          <section>
            <button type="button" onClick={() => select(null)}>
              ← All projects
            </button>
            <h2 style={{ fontSize: 'var(--text-lg)' }}>
              {selectedProject.title}
            </h2>
            <p style={{ color: 'var(--color-text-muted)' }}>
              The pipeline (script → scenes → images → animation → export)
              arrives in the next slices.
            </p>
          </section>
        ) : (
          <ProjectList />
        )}
      </main>
    </>
  )
}

export default App
