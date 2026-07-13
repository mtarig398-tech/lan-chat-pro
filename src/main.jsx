import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, Bell, CheckCheck, LogOut, MessageCircle, MoreVertical, Paperclip, Search, Send, Settings, ShieldCheck, Smile, UserCog, Users, X } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import './styles.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signIn(event) {
    event.preventDefault()
    setError('')
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
        <form className="authForm" onSubmit={signIn}>
          <label>البريد الإلكتروني<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>كلمة المرور<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <div className="errorBox">{error}</div>}
          <button disabled={loading}>{loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</button>
        </form>
        <div className="authSecurity"><ShieldCheck size={16} /> محمي بواسطة Supabase Auth</div>
      </section>
    </main>
  )
}

function AdminPanel({ profiles, onClose, onRefresh, currentRole }) {
  const [query, setQuery] = useState('')
  const filtered = profiles.filter((p) => (p.full_name || '').toLowerCase().includes(query.toLowerCase()))

  async function updateUser(id, patch) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) return alert(error.message)
    await onRefresh()
  }

  return (
    <div className="adminOverlay">
      <section className="adminPanel">
        <header>
          <div><h2>إدارة المستخدمين</h2><p>صلاحيتك الحالية: {currentRole}</p></div>
          <button onClick={onClose}><X /></button>
        </header>
        <div className="adminSearch"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث عن مستخدم" /></div>
        <div className="userTable">
          {filtered.map((p) => (
            <article key={p.id}>
              <div className="userAvatar">{(p.full_name || 'U')[0]}</div>
              <div className="userInfo"><strong>{p.full_name}</strong><span>{p.status} · {p.role}</span></div>
              <select value={p.role} onChange={(e) => updateUser(p.id, { role: e.target.value })}>
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <label className="switch"><input type="checkbox" checked={p.is_active} onChange={(e) => updateUser(p.id, { is_active: e.target.checked })} /><span /></label>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!supabaseConfigured) return setLoading(false)
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadAll() }, [session])

  useEffect(() => {
    if (!activeChat) return
    loadMessages(activeChat.id)
    const channel = supabase.channel(`messages:${activeChat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeChat.id}` },
        (payload) => setMessages((current) => current.some((m) => m.id === payload.new.id) ? current : [...current, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeChat?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadProfile(), loadProfiles(), loadChats()])
    setLoading(false)
  }

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
  }

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles(data || [])
  }

  async function loadChats() {
    const { data, error } = await supabase.from('chat_members').select('chat_id,chats(id,name,type,created_at)').eq('user_id', session.user.id)
    if (error) return
    const list = (data || []).map((x) => x.chats).filter(Boolean)
    setChats(list)
    if (!activeChat && list[0]) setActiveChat(list[0])
  }

  async function loadMessages(chatId) {
    const { data } = await supabase.from('messages')
      .select('id,body,created_at,sender_id,profiles:sender_id(full_name)')
      .eq('chat_id', chatId).is('deleted_at', null).order('created_at')
    setMessages(data || [])
  }

  async function sendMessage(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !activeChat) return
    const { error } = await supabase.from('messages').insert({ chat_id: activeChat.id, sender_id: session.user.id, body })
    if (error) alert(error.message)
    else setDraft('')
  }

  async function logout() { await supabase.auth.signOut() }

  if (loading) return <div className="loadingPage">جارٍ التحميل...</div>
  if (!session) return <Login />

  const isAdmin = ['super_admin', 'admin'].includes(profile?.role)
  const filteredChats = chats.filter((chat) => (chat.name || 'محادثة').includes(query))

  return (
    <div className="appShell">
      {adminOpen && <AdminPanel profiles={profiles} onClose={() => setAdminOpen(false)} onRefresh={loadProfiles} currentRole={profile?.role} />}
      <aside className={`chatList ${mobileOpen ? 'mobileHidden' : ''}`}>
        <header className="listHeader">
          <div className="me"><div className="avatar">{(profile?.full_name || 'U')[0]}</div><div><strong>{profile?.full_name || session.user.email}</strong><span><i /> متصل</span></div></div>
          <div className="headerButtons">
            {isAdmin && <button title="إدارة المستخدمين" onClick={() => setAdminOpen(true)}><UserCog size={19} /></button>}
            <button><Bell size={19} /></button><button><Settings size={19} /></button><button onClick={logout}><LogOut size={19} /></button>
          </div>
        </header>
        <div className="listTabs"><button className="active"><MessageCircle size={17} /> المحادثات</button><button><Users size={17} /> الأعضاء</button></div>
        <div className="chatSearch"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث" /></div>
        <div className="conversationList">
          {filteredChats.length === 0 ? <div className="emptyState">لا توجد محادثات بعد</div> :
            filteredChats.map((chat) => (
              <button key={chat.id} className={`conversation ${activeChat?.id === chat.id ? 'active' : ''}`}
                onClick={() => { setActiveChat(chat); setMobileOpen(true) }}>
                <div className="conversationAvatar">{(chat.name || 'م')[0]}</div>
                <div className="conversationMain"><div><strong>{chat.name || 'محادثة خاصة'}</strong><time>{new Date(chat.created_at).toLocaleDateString('ar-SA')}</time></div><div><span>اضغط لفتح المحادثة</span></div></div>
              </button>
            ))}
        </div>
        <footer className="connectionStatus">Supabase Realtime connected</footer>
      </aside>

      <main className={`chatPanel ${mobileOpen ? 'mobileVisible' : ''}`}>
        <header className="chatHeader">
          <button className="backButton" onClick={() => setMobileOpen(false)}><ArrowRight size={22} /></button>
          <div className="conversationAvatar large">{(activeChat?.name || 'م')[0]}</div>
          <div className="chatIdentity"><strong>{activeChat?.name || 'اختر محادثة'}</strong><span>{activeChat ? 'متصل عبر Realtime' : 'لا توجد محادثة محددة'}</span></div>
          <div className="chatActions"><button><Search size={20} /></button><button><MoreVertical size={20} /></button></div>
        </header>
        <section className="messageArea">
          {!activeChat ? <div className="emptyConversation">اختر محادثة للبدء</div> :
           messages.length === 0 ? <div className="emptyConversation">لا توجد رسائل بعد. ابدأ أول رسالة.</div> :
           messages.map((m) => {
             const mine = m.sender_id === session.user.id
             return <article key={m.id} className={`messageBubble ${mine ? 'mine' : 'theirs'}`}>
               {!mine && <strong>{m.profiles?.full_name || 'مستخدم'}</strong>}
               <p>{m.body}</p>
               <footer><time>{new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</time>{mine && <CheckCheck size={15} className="read" />}</footer>
             </article>
           })}
          <div ref={bottomRef} />
        </section>
        <form className="messageComposer" onSubmit={sendMessage}>
          <button type="button"><Smile size={22} /></button><button type="button"><Paperclip size={21} /></button>
          <input disabled={!activeChat} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب رسالة" />
          <button className="sendButton" disabled={!activeChat}><Send size={20} /></button>
        </form>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
