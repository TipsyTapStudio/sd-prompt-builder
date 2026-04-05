import { useState, useEffect, useRef, useCallback } from 'react'

/** Race a promise against a timeout */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

/**
 * MyMemory Translation API (free, no key required, CORS-friendly)
 * Limit: 5,000 chars/day (anonymous), 50,000 chars/day (with email)
 */
async function translateWithMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ja`
  const res = await withTimeout(fetch(url), 8000)
  if (!res.ok) throw new Error(`MyMemory API error: ${res.status}`)
  const data = await res.json()
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText
  }
  throw new Error('MyMemory: no translation returned')
}

/**
 * Chrome built-in Translator API (en → ja, fully local)
 */
async function initChromeTranslator() {
  if (!('Translator' in self)) return null

  const availability = await withTimeout(
    Translator.availability({ sourceLanguage: 'en', targetLanguage: 'ja' }),
    5000
  )

  if (availability === 'unavailable') return null

  return await withTimeout(
    Translator.create({ sourceLanguage: 'en', targetLanguage: 'ja' }),
    15000
  )
}

// Provider names
export const PROVIDERS = {
  AUTO: 'auto',       // Chrome → MyMemory fallback
  CHROME: 'chrome',   // Chrome only
  MYMEMORY: 'mymemory', // MyMemory only
  OFF: 'off',         // Disabled
}

/**
 * Main translator hook with provider selection.
 */
export function useTranslator(provider = PROVIDERS.AUTO) {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState(null) // 'chrome' | 'mymemory' | null
  const chromeRef = useRef(null)

  useEffect(() => {
    if (provider === PROVIDERS.OFF) {
      setIsAvailable(false)
      setIsLoading(false)
      setActiveProvider(null)
      return
    }

    let cancelled = false

    async function init() {
      // Try Chrome first (if auto or chrome)
      if (provider === PROVIDERS.AUTO || provider === PROVIDERS.CHROME) {
        try {
          const translator = await initChromeTranslator()
          if (cancelled) {
            translator?.destroy()
            return
          }
          if (translator) {
            chromeRef.current = translator
            setActiveProvider('chrome')
            setIsAvailable(true)
            setIsLoading(false)
            return
          }
        } catch (err) {
          console.warn('Chrome Translator unavailable:', err.message)
        }
      }

      // Fallback to MyMemory (if auto or mymemory)
      if (provider === PROVIDERS.AUTO || provider === PROVIDERS.MYMEMORY) {
        if (!cancelled) {
          setActiveProvider('mymemory')
          setIsAvailable(true)
          setIsLoading(false)
          return
        }
      }

      if (!cancelled) {
        setIsAvailable(false)
        setIsLoading(false)
        setActiveProvider(null)
      }
    }

    init()

    return () => {
      cancelled = true
      if (chromeRef.current) {
        chromeRef.current.destroy()
        chromeRef.current = null
      }
    }
  }, [provider])

  const translate = useCallback(async (text) => {
    if (!text?.trim()) return ''
    try {
      if (activeProvider === 'chrome' && chromeRef.current) {
        return await withTimeout(chromeRef.current.translate(text), 10000)
      }
      if (activeProvider === 'mymemory') {
        return await translateWithMyMemory(text)
      }
      return ''
    } catch (err) {
      console.warn(`Translation failed (${activeProvider}):`, err.message)
      return ''
    }
  }, [activeProvider])

  return { translate, isAvailable, isLoading, activeProvider }
}

/**
 * Hook that debounces translation of a text value.
 */
export function useDebouncedTranslation(text, translator, delay = 500) {
  const [translated, setTranslated] = useState('')
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!translator.isAvailable || !text?.trim()) {
      setTranslated('')
      return
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(async () => {
      const result = await translator.translate(text)
      setTranslated(result)
    }, delay)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [text, translator, delay])

  return translated
}
