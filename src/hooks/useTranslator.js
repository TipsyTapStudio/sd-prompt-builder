import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook for Chrome's built-in Translator API (en → ja).
 * Returns { translate, isAvailable, isLoading } where translate(text) returns translated text.
 * Falls back gracefully: isAvailable=false if API doesn't exist or language pair unsupported.
 */
export function useTranslator() {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const translatorRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Feature detection
        if (!('Translator' in self)) {
          setIsAvailable(false)
          setIsLoading(false)
          return
        }

        // Check en→ja availability
        const availability = await Translator.availability({
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        })

        if (cancelled) return

        if (availability === 'unavailable') {
          setIsAvailable(false)
          setIsLoading(false)
          return
        }

        // Create translator (may trigger model download)
        const translator = await Translator.create({
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        })

        if (cancelled) {
          translator.destroy()
          return
        }

        translatorRef.current = translator
        setIsAvailable(true)
        setIsLoading(false)
      } catch (err) {
        console.warn('Translator API init failed:', err)
        setIsAvailable(false)
        setIsLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
      if (translatorRef.current) {
        translatorRef.current.destroy()
        translatorRef.current = null
      }
    }
  }, [])

  const translate = useCallback(async (text) => {
    if (!translatorRef.current || !text?.trim()) return ''
    try {
      return await translatorRef.current.translate(text)
    } catch (err) {
      console.warn('Translation failed:', err)
      return ''
    }
  }, [])

  return { translate, isAvailable, isLoading }
}

/**
 * Hook that debounces translation of a text value.
 * Returns the translated string (or '' if unavailable/pending).
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
