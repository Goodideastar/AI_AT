import { useEffect, useRef, useState, useMemo } from 'react'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><'

interface ScrambleInProps {
  text: string
  delay: number
  triggered: boolean
}

export default function ScrambleIn({ text, delay, triggered }: ScrambleInProps) {
  const [display, setDisplay] = useState<string>('\u00A0'.repeat(text.length))
  const rafRef = useRef(0)
  const startTimeRef = useRef(0)

  const charArray = useMemo(() => text.split(''), [text])

  useEffect(() => {
    if (!triggered) {
      setDisplay('\u00A0'.repeat(text.length))
      return
    }

    const timeout = setTimeout(() => {
      startTimeRef.current = performance.now()

      const tick = (now: number) => {
        const elapsed = now - startTimeRef.current
        const charsRevealed = Math.floor(elapsed / 25 * 0.5)
        const arr: string[] = []

        for (let i = 0; i < charArray.length; i++) {
          if (charArray[i] === ' ') {
            arr.push(' ')
          } else if (i < charsRevealed) {
            arr.push(charArray[i])
          } else if (i < charsRevealed + 3) {
            arr.push(CHARS[Math.floor(Math.random() * CHARS.length)])
          } else {
            arr.push('\u00A0')
          }
        }
        setDisplay(arr.join(''))

        if (charsRevealed < charArray.length) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setDisplay(text)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }, delay)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(rafRef.current)
    }
  }, [triggered, delay, text, charArray])

  return <span>{display}</span>
}
