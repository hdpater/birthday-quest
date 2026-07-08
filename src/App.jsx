import { useState, useEffect } from 'react'
import Game from './Game.jsx'
import IntroScreen from './IntroScreen.jsx'
import { SAVES_KEY, storageGet } from './data/storage.js'

export default function App(){
  // null while checking, then 'main' (skip intro) or 'intro' (show it).
  const [gamePart, setGamePart] = useState(null)

  useEffect(() => {
    let cancelled = false
    storageGet(SAVES_KEY).then(raw => {
      if (cancelled) return
      let hasSave = false
      try {
        const list = raw ? JSON.parse(raw) : []
        hasSave = Array.isArray(list) && list.length > 0
      } catch {}
      setGamePart(hasSave ? 'main' : 'intro')
    })
    return () => { cancelled = true }
  }, [])

  const beginMain = () => setGamePart('main')

  if (gamePart === null) return null
  if (gamePart === 'intro') return <IntroScreen onContinue={beginMain}/>
  return <Game/>
}
