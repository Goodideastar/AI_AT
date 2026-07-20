import { useEffect, useRef, useState, useCallback } from 'react'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><'

interface ScrambleTextProps {
  text: string
  isHovered: boolean
  className?: string
}

export default function ScrambleText({ text, isHovered, className }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text)
  const intervalRef = useRef(0)

  const scramble = useCallback(() => {
    const arr = text.split('')
    let cursor = 0
    const charsPerFrame = 4

    intervalRef.current = window.setInterval(() => {
      for (let i = 0; i < arr.length; i++) {
        if (i < cursor) {
          arr[i] = text[i]
        } else {
          arr[i] = CHARS[Math.floor(Math.random() * CHARS.length)]
        }
      }
      setDisplay(arr.join(''))
      cursor += charsPerFrame

      if (cursor >= text.length) {
        clearInterval(intervalRef.current)
        setDisplay(text)
      }
    }, 25)
  }, [text])

  useEffect(() => {
    if (isHovered) {
      scramble()
    } else {
      clearInterval(intervalRef.current)
      setDisplay(text)
    }
    return () => clearInterval(intervalRef.current)
  }, [isHovered, scramble, text])

  return <span className={className}>{display}</span>
}
