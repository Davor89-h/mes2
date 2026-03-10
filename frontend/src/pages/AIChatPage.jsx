import { useState, useRef, useEffect } from 'react'
import { C, Btn } from '../components/UI'
import { Brain, Send, Trash2, User, Bot, Loader } from 'lucide-react'
import api from '../utils/api'

const SUGGESTIONS = [
  'Koje naprave imaju prekoračen servis?',
  'Koji strojevi su trenutno najopterećeniji?',
  'Koje naprave se najčešće koriste?',
  'Kako optimizirati raspored naprava?',
  'Što trebam naručiti ovaj tjedan?',
  'Analiza rizika od kvarova',
]

export default function AIChatPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Zdravo! Ja sam DEER AI asistent. Mogu analizirati tvoje produkcijske podatke, naprave, strojeve i alate. Što te zanima?',
      timestamp: new Date().toISOString(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setError(null)

    const userMsg = { role:'user', content:msg, timestamp:new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // Build history (exclude first greeting)
      const history = messages.slice(1).map(m => ({ role:m.role, content:m.content }))
      
      const r = await api.post('/ai/chat', { message:msg, history })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: r.data.reply,
        timestamp: r.data.timestamp,
      }])
    } catch(e) {
      setError(e.response?.data?.error || 'Greška pri komunikaciji s AI')
      setMessages(prev => [...prev, {
        role:'assistant',
        content:'Žao mi je, došlo je do greške. Pokušaj ponovo.',
        timestamp: new Date().toISOString(),
        isError: true,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const clear = () => {
    setMessages([{
      role:'assistant',
      content:'Chat očišćen. Kako ti mogu pomoći?',
      timestamp:new Date().toISOString(),
    }])
    setError(null)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'calc(100vh - 106px)',gap:0 }}>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:16,flexShrink:0 }}>
        <div style={{ width:44,height:44,borderRadius:12,background:`${C.teal}15`,border:`1px solid ${C.teal}30`,display:'flex',alignItems:'center',justifyContent:'center' }}>
          <Brain size={22} color={C.teal}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10,color:C.muted,letterSpacing:2 }}>DEER MES · AI MODUL</div>
          <div style={{ fontSize:17,fontWeight:700,color:'#e8f0ee',letterSpacing:1.5 }}>AI ASISTENT</div>
        </div>
        <button onClick={clear} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.muted2,fontSize:11,cursor:'pointer' }}>
          <Trash2 size={13}/> Očisti
        </button>
      </div>

      {/* Chat window */}
      <div style={{ flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden',display:'flex',flexDirection:'column' }}>
        {/* Messages */}
        <div style={{ flex:1,overflowY:'auto',padding:'20px',display:'flex',flexDirection:'column',gap:16 }}>
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg}/>
          ))}
          {loading && <TypingIndicator/>}
          <div ref={bottomRef}/>
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ padding:'0 20px 16px',display:'flex',flexWrap:'wrap',gap:8 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={()=>send(s)}
                style={{ padding:'7px 14px',borderRadius:20,border:`1px solid ${C.border}`,background:C.surface2,color:C.muted2,fontSize:11,cursor:'pointer',transition:'all .15s' }}
                onMouseOver={e=>{e.target.style.borderColor=C.teal;e.target.style.color=C.teal}}
                onMouseOut={e=>{e.target.style.borderColor=C.border;e.target.style.color=C.muted2}}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ borderTop:`1px solid ${C.border}`,padding:'14px 16px',display:'flex',gap:10,background:C.surface2 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Postavi pitanje o produkciji, napravama, strojevima... (Enter za slanje)"
            rows={1}
            style={{
              flex:1,background:C.surface3,border:`1px solid ${C.border}`,borderRadius:10,
              padding:'10px 14px',color:'#e8f0ee',fontSize:13,resize:'none',
              fontFamily:"'Chakra Petch',sans-serif",outline:'none',lineHeight:1.5,
              maxHeight:120,overflowY:'auto',
            }}
          />
          <button onClick={()=>send()}
            disabled={!input.trim() || loading}
            style={{
              width:44,height:44,borderRadius:10,border:'none',
              background:input.trim()&&!loading?C.teal:'#2a3a38',
              color:input.trim()&&!loading?'#000':C.muted,
              cursor:input.trim()&&!loading?'pointer':'default',
              display:'flex',alignItems:'center',justifyContent:'center',
              transition:'all .2s',flexShrink:0,
            }}
          >
            <Send size={16}/>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding:'10px 16px',background:`${C.red}10`,border:`1px solid ${C.red}30`,borderRadius:10,fontSize:11,color:C.red,marginTop:10,flexShrink:0 }}>
          {error}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex',gap:12,alignItems:'flex-start',flexDirection:isUser?'row-reverse':'row' }}>
      {/* Avatar */}
      <div style={{ width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:isUser?`${C.accent}20`:`${C.teal}20`,border:`1px solid ${isUser?C.accent:C.teal}40` }}>
        {isUser ? <User size={14} color={C.accent}/> : <Bot size={14} color={C.teal}/>}
      </div>
      {/* Bubble */}
      <div style={{ maxWidth:'72%' }}>
        <div style={{
          padding:'12px 16px',borderRadius:isUser?'14px 4px 14px 14px':'4px 14px 14px 14px',
          background:isUser?`${C.accent}15`:C.surface2,
          border:`1px solid ${isUser?C.accent+'30':C.border}`,
          fontSize:13,color:msg.isError?C.red:'#d8e8e4',lineHeight:1.7,
          whiteSpace:'pre-wrap',wordBreak:'break-word',
        }}>
          {msg.content}
        </div>
        <div style={{ fontSize:10,color:C.muted,marginTop:4,textAlign:isUser?'right':'left' }}>
          {new Date(msg.timestamp).toLocaleTimeString('hr-HR',{hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
      <div style={{ width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${C.teal}20`,border:`1px solid ${C.teal}40` }}>
        <Bot size={14} color={C.teal}/>
      </div>
      <div style={{ padding:'12px 18px',borderRadius:'4px 14px 14px 14px',background:C.surface2,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:6 }}>
        <Loader size={12} color={C.teal} style={{ animation:'spin 1s linear infinite' }}/>
        <span style={{ fontSize:12,color:C.muted }}>DEER AI analizira...</span>
      </div>
    </div>
  )
}
