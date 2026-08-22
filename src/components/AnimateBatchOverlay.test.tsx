import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoModel } from '../api/nanogpt'
import { createScene } from '../domain/types'
import type { AssetVersion, Scene } from '../domain/types'
import * as audioBlobModule from '../lib/audioBlob'
import { __resetRepositoryForTests, getRepository } from '../state/repo'
import { AnimateBatchOverlay } from './AnimateBatchOverlay'

const MODEL: VideoModel = {
  id: 'vid/main',
  name: 'Main Animator',
  description: '',
  supportsTextToVideo: false,
  supportsImageToVideo: true,
  priceRangeUsd: { min: 0.5, max: 1 },
  resolutions: ['480p', '1080p'],
  durations: ['5', '8'],
  frameControl: null,
  lipSync: null,
  releasedAt: null,
}

const ALT: VideoModel = {
  id: 'vid/alt',
  name: 'Alt Animator',
  description: '',
  supportsTextToVideo: false,
  supportsImageToVideo: true,
  priceRangeUsd: { min: 2, max: 2 },
  resolutions: ['360p'],
  durations: ['4'],
  frameControl: null,
  lipSync: null,
  releasedAt: null,
}

function audioVersion(blobPath: string): AssetVersion {
  return {
    id: 'audio-1',
    kind: 'audio',
    model: 'tts/mock',
    prompt: 'words',
    costUsd: 0.001,
    blobPath,
    mimeType: 'audio/mpeg',
    createdAt: new Date().toISOString(),
  }
}

async function makeScenes(): Promise<[Scene, Scene]> {
  const repo = await getRepository()
  const narrated = createScene(0)
  narrated.textExcerpt = 'A lighthouse stands on the cliff.'
  const version = audioVersion('p/audio-1')
  narrated.audioVersions = [version]
  narrated.activeAudioVersionId = version.id
  await repo.blobs.put(version.blobPath, new Blob(['fake-audio']))
  const silent = createScene(1)
  silent.textExcerpt = 'Waves crash below.'
  return [narrated, silent]
}

beforeEach(() => {
  __resetRepositoryForTests()
  vi.restoreAllMocks()
})

describe('AnimateBatchOverlay (Slice 15.12)', () => {
  it('pre-fits each row to its narration and submits per-row configs', async () => {
    vi.spyOn(audioBlobModule, 'audioBlobDuration').mockResolvedValue(6.4)
    const [narrated, silent] = await makeScenes()
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <AnimateBatchOverlay
        scenes={[narrated, silent]}
        sceneNumbers={
          new Map([
            [narrated.id, 1],
            [silent.id, 2],
          ])
        }
        defaultModel={MODEL}
        models={[MODEL, ALT]}
        globalDuration="5"
        globalResolution="480p"
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    )

    // The 6.4s narration bumps scene 1 to the model's 8s; scene 2 keeps 5s.
    await waitFor(() => {
      expect(screen.getByLabelText('Scene 1 duration')).toHaveValue('8')
    })
    expect(screen.getByLabelText('Scene 2 duration')).toHaveValue('5')
    expect(screen.getByText('♪ narration 6.4s')).toBeTruthy()
    expect(screen.getByText('no narration')).toBeTruthy()

    // Per-row model override re-fits within the new model's durations.
    await user.selectOptions(screen.getByLabelText('Scene 1 model'), 'vid/alt')
    expect(screen.getByLabelText('Scene 1 duration')).toHaveValue('4')

    await user.click(
      screen.getByRole('button', { name: 'Submit 2 jobs and charge' }),
    )
    expect(onSubmit).toHaveBeenCalledWith([
      {
        sceneId: narrated.id,
        model: ALT,
        duration: '4', // capped at the alt model's longest option
        resolution: '360p', // global 480p is invalid there — cheapest valid
      },
      { sceneId: silent.id, model: MODEL, duration: '5', resolution: '480p' },
    ])
  })

  it('fixed-length models get no duration control and submit none (15.15)', async () => {
    vi.spyOn(audioBlobModule, 'audioBlobDuration').mockResolvedValue(6.4)
    const FIXED: VideoModel = {
      ...MODEL,
      id: 'vid/fixed',
      name: 'Fixed Length Model',
      durations: [], // the listing advertises no duration parameter
      resolutions: [],
    }
    const [narrated] = await makeScenes()
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <AnimateBatchOverlay
        scenes={[narrated]}
        sceneNumbers={new Map([[narrated.id, 1]])}
        defaultModel={FIXED}
        models={[FIXED]}
        globalDuration={null}
        globalResolution={null}
        onSubmit={onSubmit}
        onCancel={() => undefined}
      />,
    )
    expect(await screen.findByText('fixed length')).toBeTruthy()
    expect(
      screen.queryByRole('combobox', { name: 'Scene 1 duration' }),
    ).toBeNull()
    // Submit stays disabled until measuring finishes — wait it out (a
    // click on a disabled button silently no-ops and flakes the test).
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Submit 1 job and charge' }),
      ).toBeEnabled()
    })
    await user.click(
      screen.getByRole('button', { name: 'Submit 1 job and charge' }),
    )
    expect(onSubmit).toHaveBeenCalledWith([
      { sceneId: narrated.id, model: FIXED, duration: null, resolution: null },
    ])
  })

  it('states the summed price estimate before charging', async () => {
    vi.spyOn(audioBlobModule, 'audioBlobDuration').mockResolvedValue(null)
    const [narrated, silent] = await makeScenes()
    render(
      <AnimateBatchOverlay
        scenes={[narrated, silent]}
        sceneNumbers={
          new Map([
            [narrated.id, 1],
            [silent.id, 2],
          ])
        }
        defaultModel={MODEL}
        models={[MODEL]}
        globalDuration="5"
        globalResolution="480p"
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    )
    // Two scenes × $0.5–$1 each.
    expect(
      await screen.findByText(
        /≈\$1\.00–\$2\.00 total, charged at submission\./,
      ),
    ).toBeTruthy()
  })
})
