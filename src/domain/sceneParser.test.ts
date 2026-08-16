import { describe, expect, it } from 'vitest'
import { MAX_SCENES, parseSceneBreakdown, SceneParseError } from './sceneParser'

const VALID = JSON.stringify([
  { textExcerpt: 'Once upon a time', visualDescription: 'A castle at dawn' },
  { textExcerpt: 'a dragon appeared', visualDescription: 'A dragon in fog' },
])

describe('parseSceneBreakdown', () => {
  it('parses a plain JSON array', () => {
    const scenes = parseSceneBreakdown(VALID)
    expect(scenes).toHaveLength(2)
    expect(scenes[0]).toEqual({
      textExcerpt: 'Once upon a time',
      visualDescription: 'A castle at dawn',
    })
  })

  it('strips code fences', () => {
    expect(parseSceneBreakdown('```json\n' + VALID + '\n```')).toHaveLength(2)
  })

  it('ignores prose around the array', () => {
    expect(
      parseSceneBreakdown('Here are your scenes:\n' + VALID + '\nEnjoy!'),
    ).toHaveLength(2)
  })

  it('trims whitespace inside fields', () => {
    const scenes = parseSceneBreakdown(
      JSON.stringify([{ textExcerpt: '  a  ', visualDescription: ' b ' }]),
    )
    expect(scenes[0]).toEqual({ textExcerpt: 'a', visualDescription: 'b' })
  })

  it('rejects output with no array at all', () => {
    expect(() => parseSceneBreakdown('I cannot do that.')).toThrow(
      SceneParseError,
    )
  })

  it('rejects malformed JSON', () => {
    expect(() => parseSceneBreakdown('[{"textExcerpt": "a",]')).toThrow(
      /malformed/,
    )
  })

  it('rejects an empty array', () => {
    expect(() => parseSceneBreakdown('[]')).toThrow(/empty/)
  })

  it('rejects non-object elements', () => {
    expect(() => parseSceneBreakdown('["a", "b"]')).toThrow(/not an object/)
  })

  it('rejects scenes missing fields', () => {
    expect(() =>
      parseSceneBreakdown(JSON.stringify([{ textExcerpt: 'a' }])),
    ).toThrow(/missing/)
    expect(() =>
      parseSceneBreakdown(
        JSON.stringify([{ textExcerpt: '', visualDescription: 'b' }]),
      ),
    ).toThrow(/missing/)
  })

  it('rejects absurd scene counts', () => {
    const many = JSON.stringify(
      Array.from({ length: MAX_SCENES + 1 }, (_, i) => ({
        textExcerpt: `t${String(i)}`,
        visualDescription: `v${String(i)}`,
      })),
    )
    expect(() => parseSceneBreakdown(many)).toThrow(/limit/)
  })
})
