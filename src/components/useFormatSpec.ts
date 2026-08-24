import { getFormatSpec, type VideoFormatSpec } from '../domain/formats'
import { useProjectStore } from '../state/project'

/**
 * The open project's format spec (Slice 18). Components render frames,
 * players, and thumbnails at `spec.cssAspect` instead of a hardcoded
 * 9:16. Outside a project (or before one loads) it falls back to the
 * default format, which only affects never-shown placeholder markup.
 */
export function useFormatSpec(): VideoFormatSpec {
  const format = useProjectStore((s) => s.project?.format)
  return getFormatSpec(format)
}
