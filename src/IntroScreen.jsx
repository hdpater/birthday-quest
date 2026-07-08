import shipwreck from '../images/shipwreck.png'

export default function IntroScreen({onContinue}){
  return (
    <div style={{position:'fixed',inset:0,background:'#0d1117',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',color:'#e8dcc8',
      fontFamily:"'Palatino Linotype',Palatino,serif",textAlign:'center',padding:20}}>
      <img src={shipwreck} alt="Shipwreck" style={{maxWidth:'90%',maxHeight:'55vh',objectFit:'contain',
        borderRadius:8,marginBottom:24}}/>
      <div style={{fontSize:14,maxWidth:480,lineHeight:1.6,marginBottom:24,color:'#7a6a4a'}}>
        {/* TODO: replace with real intro copy */}
        You wake on an unfamiliar shore, the wreckage of your ship scattered across the sand...
      </div>
      <button onClick={onContinue} style={{padding:'10px 28px',background:'transparent',
        border:'1.5px solid #c9a84c',color:'#c9a84c',fontSize:13,letterSpacing:'0.1em',
        textTransform:'uppercase',cursor:'pointer',borderRadius:3}}>
        Begin
      </button>
    </div>
  )
}
