import type { LanguageId } from './languages'
import ar from './lang/ar'
import bn from './lang/bn'
import es from './lang/es'
import fr from './lang/fr'
import hi from './lang/hi'
import pt from './lang/pt'
import ru from './lang/ru'
import ur from './lang/ur'
import zh from './lang/zh'

/**
 * One dictionary per non-English language, keyed by the ENGLISH source
 * text exactly as it appears in the components (placeholders like {usd}
 * included — they are filled in after lookup). A missing entry is never
 * an error: `translate` falls back to the English key itself, so partial
 * dictionaries degrade to English, not to blank UI.
 */
export type Dictionary = Record<string, string>

export const DICTIONARIES: Partial<Record<LanguageId, Dictionary>> = {
  zh,
  hi,
  es,
  fr,
  ar,
  bn,
  pt,
  ru,
  ur,
}
