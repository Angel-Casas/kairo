import { useEffect, useState } from 'react'
import { getRepository } from '../state/repo'

/**
 * Resolve a BlobStore path to an object URL for display, revoking it on
 * cleanup so object URLs don't leak as users browse versions.
 *
 * Pass the AssetVersion's stored `mimeType` whenever you have one: OPFS
 * hands files back with an EMPTY type (blob paths carry no extension), so
 * without it `<video>`/`<audio>` playback depends on the browser sniffing
 * the container — which works for plain mp4 but silently fails for others
 * (a clip that plays fine on NanoGPT renders as a black player here). The
 * stored type re-creates what the CDN's Content-Type header told us.
 */
export function useBlobUrl(
  blobPath: string | null,
  mimeType?: string,
): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    if (blobPath !== null) {
      void getRepository()
        .then((repo) => repo.blobs.get(blobPath))
        .then((blob) => {
          if (blob !== null && !cancelled) {
            const typed =
              mimeType !== undefined &&
              mimeType !== '' &&
              blob.type !== mimeType
                ? new Blob([blob], { type: mimeType })
                : blob
            objectUrl = URL.createObjectURL(typed)
            setUrl(objectUrl)
          }
        })
    }
    return () => {
      cancelled = true
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [blobPath, mimeType])

  return url
}
