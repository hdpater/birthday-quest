import { useState } from 'react'
import wizard from '../images/wizard.jpeg'
import shipwreck from '../images/shipwreck.png'
import introScene from '../images/intro_scene.mp4'

export default function IntroScreen({onContinue}){
  const [stage, setStage] = useState('wizard') // 'wizard' -> 'video' -> 'shipwreck'

  return (
    <div style={{position:'fixed',inset:0,background:'#0d1117',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',color:'#e8dcc8',
      fontFamily:"'Palatino Linotype',Palatino,serif",textAlign:'center',padding:20}}>
      {stage === 'video' &&
        <video src={introScene} autoPlay playsInline
          onEnded={() => setStage('shipwreck')}
          style={{maxWidth:'90%',maxHeight:'80vh',objectFit:'contain'}}/>
      }
      {stage !== 'video' && <>
        <img src={stage === 'wizard' ? wizard : shipwreck} alt={stage === 'wizard' ? 'Wizard' : 'Shipwreck'}
          style={{maxWidth:'90%',maxHeight:'55vh',objectFit:'contain',borderRadius:8,marginBottom:24}}/>
        {stage === 'shipwreck' &&
          <div style={{fontSize:14,maxWidth:480,lineHeight:1.6,marginBottom:24,color:'#7a6a4a'}}>
            You wake on an unfamiliar shore, the wreckage of your ship scattered across the sand. Climbing the path to the hill-top, you hope to figure out what on earth is going on...
          </div>
        }
        <button onClick={() => stage === 'wizard' ? setStage('video') : onContinue()} style={{padding:'10px 28px',background:'transparent',
          border:'1.5px solid #c9a84c',color:'#c9a84c',fontSize:13,letterSpacing:'0.1em',
          textTransform:'uppercase',cursor:'pointer',borderRadius:3}}>
          Begin
        </button>
      </>}
    </div>
  )
}
