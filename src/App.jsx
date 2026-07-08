import { useState } from 'react'
import Game from './Game.jsx'
import IntroScreen from './IntroScreen.jsx'

const GAME_PART_KEY = 'game_part'

export default function App(){
  const [gamePart, setGamePart] = useState(() => {
    try { return localStorage.getItem(GAME_PART_KEY) } catch { return null }
  })

  const beginMain = () => {
    try { localStorage.setItem(GAME_PART_KEY, 'main') } catch {}
    setGamePart('main')
  }

  if (!gamePart) return <IntroScreen onContinue={beginMain}/>
  return <Game/>
}
