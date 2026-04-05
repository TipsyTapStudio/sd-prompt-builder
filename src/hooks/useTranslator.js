import { useState, useEffect, useRef, useCallback } from 'react'

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

async function translateWithMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ja`
  const res = await withTimeout(fetch(url), 8000)
  if (res.status === 429) throw new Error('API制限: 1日の翻訳上限に達しました')
  if (!res.ok) throw new Error(`MyMemory API error: ${res.status}`)
  const data = await res.json()
  // Check for quota exceeded in response
  if (data.responseStatus === 429 || (data.responseData?.translatedText || '').includes('MYMEMORY WARNING')) {
    throw new Error('API制限: 1日の翻訳上限に達しました（5,000文字/日）')
  }
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText
  }
  throw new Error(`MyMemory: status ${data.responseStatus}`)
}

async function initChromeTranslator() {
  if (!('Translator' in self)) return null
  const availability = await withTimeout(
    Translator.availability({ sourceLanguage: 'en', targetLanguage: 'ja' }), 5000
  )
  if (availability === 'unavailable') return null
  return await withTimeout(
    Translator.create({ sourceLanguage: 'en', targetLanguage: 'ja' }), 15000
  )
}

export const PROVIDERS = {
  AUTO: 'auto',
  CHROME: 'chrome',
  MYMEMORY: 'mymemory',
  OFF: 'off',
}

export function useTranslator(provider = PROVIDERS.AUTO) {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState(null)
  const [error, setError] = useState(null)
  const chromeRef = useRef(null)

  useEffect(() => {
    if (provider === PROVIDERS.OFF) {
      setIsAvailable(false)
      setIsLoading(false)
      setActiveProvider(null)
      setError(null)
      return
    }

    let cancelled = false

    async function init() {
      setError(null)

      if (provider === PROVIDERS.AUTO || provider === PROVIDERS.CHROME) {
        try {
          const translator = await initChromeTranslator()
          if (cancelled) { translator?.destroy(); return }
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
    setError(null)
    try {
      if (activeProvider === 'chrome' && chromeRef.current) {
        return await withTimeout(chromeRef.current.translate(text), 10000)
      }
      if (activeProvider === 'mymemory') {
        return await translateWithMyMemory(text)
      }
      return ''
    } catch (err) {
      const msg = err.message || 'Translation failed'
      console.warn(`Translation failed (${activeProvider}):`, msg)
      setError(msg)
      return ''
    }
  }, [activeProvider])

  return { translate, isAvailable, isLoading, activeProvider, error }
}

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
