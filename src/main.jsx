import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight,
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import './styles.css'

const demoChats = [
  { id: 'general', title: 'الفريق العام', avatar: 'ف', last: 'أهلًا بالجميع في LAN Chat Pro', time: '10:32', unread: 2, online: true },
  { id: 'it', title: 'قسم تقنية المعلومات', avatar: 'ت', last: 'تم تحديث إعدادات الشبكة', time: '09:18', unread: 0, online: true },
  { id: 'ops', title: 'العمليات', avatar: 'ع', last: 'نحتاج مراجعة الجدول اليوم', time: 'أمس', unread: 1, online: false },
]

const demoMessages = {
  general: [
    { id: 1, sender: 'أحمد', body: 'أهلًا بالجميع في LAN Chat Pro 👋', time: '10:10', mine: false },
    { id: 2, sender: 'أنت', body: 'هذه نسخة v0.2 بتصميم مناسب للجوال.', time: '10:12', mine: true, read: true },
  ],
  it: [{ id: 3, sender: 'أنت', body: 'تم تحديث إعدادات الشبكة.', time: '09:18', mine: true, read: true }],
  ops: [{ id: 4, sender: 'سارة', body: 'نحتاج مراجعة الجدول اليوم.', time: 'أمس', mine: false }],
}

function Login({ onDemoLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signIn(event) {
    event.preventDefault()
    setError('')
    if (!supabaseConfigured) {
      onDemoLogin({ email: email || 'demo@local', user_metadata: { display_name: 'مستخدم تجريبي' } })
      return
    }
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message)
    setLoading(false)
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authLogo"><MessageCircle size={30} /></div>
        <h1>LAN Chat Pro</h1>
        <p>تواصل داخلي آمن وسريع لفريق العمل</p>
        <form onSubmit={signIn} className="authForm">
          <label>البريد الإلكتروني<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
          <label>كلمة المرور<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
          {error && <div className="errorBox">{error}</div>}
          <button disabled={loading}>{loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</button>
        </form>
        {!supabaseConfigured && <div className="demoHint">وضع المعاينة مفعل. أدخل أي بريد وكلمة مرور للتجربة.</div>}
        <div className="authSecurity"><ShieldCheck size={16} /> محمي بواسطة Supabase Auth</div>
      </section>
    </main>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [demoUser, setDemoUser] = useState(null)
  const [activeChat, setActiveChat] = useState(demoChats[0])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState(demoMessages)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, activeChat])

  const user = session?.user || demoUser
  if (!user) return <Login onDemoLogin={setDemoUser} />

  const filteredChats = demoChats.filter((chat) => chat.title.includes(query) || chat.last.includes(query))
  const activeMessages = messages[activeChat.id] || []

  async function logout() {
    if (supabaseConfigured) await supabase.auth.signOut()
    setDemoUser(null)
  }

  function sendMessage(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return
    setMessages((current) => ({
      ...current,
      [activeChat.id]: [...(current[activeChat.id] || []), {
        id: crypto.randomUUID(), sender: 'أنت', body, mine: true, read: true,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      }],
    }))
    setDraft('')
  }

  return (
    <div className="appShell">
      <aside className={`chatList ${mobileOpen ? 'mobileHidden' : ''}`}>
        <header className="listHeader">
          <div className="me"><div className="avatar">م</div><div><strong>محمد طارق</strong><span><i /> متصل</span></div></div>
          <div className="headerButtons"><button title="الإشعارات"><Bell size={19} /></button><button title="الإعدادات"><Settings size={19} /></button><button onClick={logout} title="تسجيل الخروج"><LogOut size={19} /></button></div>
        </header>
        <div className="listTabs"><button className="active"><MessageCircle size={17} />المحادثات</button><button><Users size={17} />الأعضاء</button></div>
        <div className="chatSearch"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث أو بدء محادثة" /></div>
        <div className="conversationList">
          {filteredChats.map((chat) => (
            <button key={chat.id} className={`conversation ${activeChat.id === chat.id ? 'active' : ''}`} onClick={() => { setActiveChat(chat); setMobileOpen(true) }}>
              <div className="conversationAvatar">{chat.avatar}<i className={chat.online ? 'online' : ''} /></div>
              <div className="conversationMain"><div><strong>{chat.title}</strong><time>{chat.time}</time></div><div><span>{chat.last}</span>{chat.unread > 0 && <b>{chat.unread}</b>}</div></div>
            </button>
          ))}
        </div>
        <footer className="connectionStatus">{supabaseConfigured ? <><Wifi size={15} /> Cloud connected</> : <><WifiOff size={15} /> Demo / Local preview</>}</footer>
      </aside>

      <main className={`chatPanel ${mobileOpen ? 'mobileVisible' : ''}`}>
        <header className="chatHeader">
          <button className="backButton" onClick={() => setMobileOpen(false)}><ArrowRight size={22} /></button>
          <div className="conversationAvatar large">{activeChat.avatar}<i className={activeChat.online ? 'online' : ''} /></div>
          <div className="chatIdentity"><strong>{activeChat.title}</strong><span>{activeChat.online ? 'متصل الآن' : 'آخر ظهور أمس'}</span></div>
          <div className="chatActions"><button><Search size={20} /></button><button><MoreVertical size={20} /></button></div>
        </header>

        <section className="messageArea">
          <div className="datePill">اليوم</div>
          {activeMessages.map((message) => (
            <article key={message.id} className={`messageBubble ${message.mine ? 'mine' : 'theirs'}`}>
              {!message.mine && <strong>{message.sender}</strong>}
              <p>{message.body}</p>
              <footer><time>{message.time}</time>{message.mine && <CheckCheck size={15} className={message.read ? 'read' : ''} />}</footer>
            </article>
          ))}
          <div ref={bottomRef} />
        </section>

        <form className="messageComposer" onSubmit={sendMessage}>
          <button type="button" title="إيموجي"><Smile size={22} /></button>
          <button type="button" title="مرفق"><Paperclip size={21} /></button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب رسالة" />
          <button className="sendButton" type="submit"><Send size={20} /></button>
        </form>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
