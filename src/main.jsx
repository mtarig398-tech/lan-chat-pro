import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight, Bell, CheckCheck, LogOut, MessageCircle, Mic, MoreVertical,
  Paperclip, Plus, Search, Send, Settings, ShieldCheck, Smile, UserCog,
  Users, X
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import './styles.css'

const ONLINE_WINDOW_MS = 70_000
const PRESENCE_INTERVAL_MS = 30_000

function isOnline(profile) {
  return Boolean(
    profile?.last_seen &&
    profile.status === 'online' &&
    Date.now() - new Date(profile.last_seen).getTime() <= ONLINE_WINDOW_MS
  )
}

function formatLastSeen(profile) {
  if (isOnline(profile)) return 'متصل الآن'
  if (!profile?.last_seen) return 'غير متصل'
  return `آخر ظهور ${new Date(profile.last_seen).toLocaleString('ar-SA', {
    dateStyle: 'short',
    timeStyle: 'short',
  })}`
}

function formatMessageTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Avatar({ profile, text }) {
  const label = profile?.full_name || text || '?'
  return (
    <div className="avatar">
      {label.charAt(0)}
      <i className={isOnline(profile) ? 'online' : ''} />
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message)
    setLoading(false)
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authLogo"><MessageCircle /></div>
        <h1>LAN Chat Pro</h1>
        <p>تواصل داخلي آمن وسريع لفريق العمل</p>
        <form className="authForm" onSubmit={submit}>
          <label>البريد الإلكتروني
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>كلمة المرور
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="errorBox">{error}</div>}
          <button disabled={loading}>{loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</button>
        </form>
        <div className="authSecurity"><ShieldCheck size={16} /> محمي بواسطة Supabase Auth</div>
      </section>
    </main>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header><h2>{title}</h2><button onClick={onClose}><X /></button></header>
        {children}
      </section>
    </div>
  )
}

function AdminPanel({ profiles, onClose, onRefresh }) {
  const [query, setQuery] = useState('')
  async function updateProfile(id, patch) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) return alert(error.message)
    await onRefresh()
  }
  const list = profiles.filter((p) => (p.full_name || '').toLowerCase().includes(query.toLowerCase()))

  return (
    <Modal title="إدارة المستخدمين" onClose={onClose}>
      <div className="searchBox">
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث" />
      </div>
      <div className="adminRows">
        {list.map((p) => (
          <article key={p.id}>
            <Avatar profile={p} />
            <div className="rowMain"><strong>{p.full_name}</strong><span>{formatLastSeen(p)} · {p.role}</span></div>
            <select value={p.role} onChange={(e) => updateProfile(p.id, { role: e.target.value })}>
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <label className="switch">
              <input type="checkbox" checked={p.is_active} onChange={(e) => updateProfile(p.id, { is_active: e.target.checked })} />
              <span />
            </label>
          </article>
        ))}
      </div>
    </Modal>
  )
}

function GroupModal({ profiles, currentUserId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const { data: chat, error } = await supabase.from('chats')
        .insert({ type: 'group', name: name.trim(), created_by: currentUserId })
        .select().single()
      if (error) throw error

      const rows = [
        { chat_id: chat.id, user_id: currentUserId, member_role: 'owner' },
        ...selected.map((user_id) => ({ chat_id: chat.id, user_id, member_role: 'member' })),
      ]
      const { error: memberError } = await supabase.from('chat_members').insert(rows)
      if (memberError) throw memberError

      await onCreated(chat)
      onClose()
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="إنشاء مجموعة" onClose={onClose}>
      <form className="groupForm" onSubmit={submit}>
        <input className="groupName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المجموعة" />
        <div className="pickMembers">
          {profiles.filter((p) => p.id !== currentUserId && p.is_active).map((p) => (
            <label key={p.id}>
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
              <Avatar profile={p} />
              <div><strong>{p.full_name}</strong><span>{formatLastSeen(p)}</span></div>
            </label>
          ))}
        </div>
        <button className="primary" disabled={loading}>{loading ? 'جارٍ الإنشاء...' : 'إنشاء المجموعة'}</button>
      </form>
    </Modal>
  )
}

function Composer({ disabled, value, onChange, onSubmit }) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const fileRef = useRef(null)
  const hasText = value.trim().length > 0

  function insertEmoji(emoji) {
    onChange(value + emoji)
    setEmojiOpen(false)
  }

  return (
    <div className="composerWrap">
      {emojiOpen && (
        <div className="emojiPanel">
          {['😀','😂','😍','👍','🙏','🎉','❤️','🔥','✅','👏'].map((emoji) => (
            <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>{emoji}</button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <div className="composerTools">
          <button type="button" onClick={() => setEmojiOpen((open) => !open)} disabled={disabled}>
            <Smile size={22} />
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled}>
            <Paperclip size={21} />
          </button>
          <input ref={fileRef} type="file" hidden onChange={() => alert('رفع الملفات سيكون في المرحلة التالية')} />
        </div>

        <input
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="اكتب رسالة"
        />

        <button className={`composerAction ${hasText ? 'sendMode' : ''}`} disabled={disabled} type={hasText ? 'submit' : 'button'}>
          {hasText ? <Send size={20} /> : <Mic size={21} />}
        </button>
      </form>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [me, setMe] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [tab, setTab] = useState('chats')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return }
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSession(data.session); setLoading(false) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next)
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id) return
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) return console.error(error)
    setProfiles(data || [])
    setMe((data || []).find((p) => p.id === session.user.id) || null)
  }, [session?.user?.id])

  const loadChats = useCallback(async () => {
    if (!session?.user?.id) return
    const { data, error } = await supabase
      .from('chat_members')
      .select('chat_id,chats(id,name,type,created_at,created_by)')
      .eq('user_id', session.user.id)
    if (error) return console.error(error)

    const list = await Promise.all((data || []).map(async (item) => {
      const chat = item.chats
      if (!chat) return null
      if (chat.type !== 'private') return chat

      const { data: rows } = await supabase.from('chat_members')
        .select('user_id,profiles:user_id(*)').eq('chat_id', chat.id)

      const peer = (rows || []).map((x) => x.profiles).find((p) => p?.id !== session.user.id)
      return { ...chat, name: peer?.full_name || 'محادثة خاصة', peer }
    }))

    const clean = list.filter(Boolean)
    setChats(clean)
    setActiveChat((current) => current ? clean.find((c) => c.id === current.id) || current : null)
  }, [session?.user?.id])

  const loadMessages = useCallback(async () => {
    if (!activeChat?.id) { setMessages([]); return }
    const { data, error } = await supabase.from('messages')
      .select('id,chat_id,body,created_at,sender_id,profiles:sender_id(full_name,status,last_seen)')
      .eq('chat_id', activeChat.id)
      .is('deleted_at', null)
      .order('created_at')
    if (error) return console.error(error)
    setMessages(data || [])
  }, [activeChat?.id])

  useEffect(() => {
    if (!session?.user?.id) return
    setLoading(true)
    Promise.all([loadProfiles(), loadChats()]).finally(() => setLoading(false))
  }, [session?.user?.id, loadProfiles, loadChats])

  useEffect(() => {
    if (!session?.user?.id) return
    const heartbeat = () => supabase.from('profiles')
      .update({ status: 'online', last_seen: new Date().toISOString() })
      .eq('id', session.user.id)
    void heartbeat()
    const timer = setInterval(heartbeat, PRESENCE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [session?.user?.id])

  useEffect(() => { void loadMessages() }, [loadMessages])

  useEffect(() => {
    if (!session?.user?.id) return
    const channel = supabase.channel(`ui-live-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void loadProfiles())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new?.chat_id === activeChat?.id || payload.old?.chat_id === activeChat?.id) {
          void loadMessages()
        }
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [session?.user?.id, activeChat?.id, loadProfiles, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  async function openChat(chat) {
    setActiveChat(chat)
    setMobileOpen(true)
  }

  async function startPrivateChat(otherUser) {
    const existing = chats.find((chat) => chat.type === 'private' && chat.peer?.id === otherUser.id)
    if (existing) return openChat(existing)

    const { data: chat, error } = await supabase.from('chats')
      .insert({ type: 'private', created_by: session.user.id })
      .select().single()
    if (error) return alert(error.message)

    const { error: memberError } = await supabase.from('chat_members').insert([
      { chat_id: chat.id, user_id: session.user.id, member_role: 'owner' },
      { chat_id: chat.id, user_id: otherUser.id, member_role: 'member' },
    ])
    if (memberError) return alert(memberError.message)

    await loadChats()
    setActiveChat({ ...chat, name: otherUser.full_name, peer: otherUser })
    setTab('chats')
    setMobileOpen(true)
  }

  async function sendMessage(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !activeChat?.id) return

    setDraft('')
    const { error } = await supabase.from('messages').insert({
      chat_id: activeChat.id,
      sender_id: session.user.id,
      body,
    })
    if (error) {
      setDraft(body)
      return alert(error.message)
    }
    await loadMessages()
  }

  function closeConversation() {
    setMobileOpen(false)
    setActiveChat(null)
    setMessages([])
  }

  async function logout() {
    await supabase.from('profiles').update({
      status: 'offline',
      last_seen: new Date().toISOString(),
    }).eq('id', session.user.id)
    await supabase.auth.signOut()
  }

  if (loading) return <div className="loadingPage">جارٍ التحميل...</div>
  if (!session) return <Login />

  const isAdmin = ['super_admin', 'admin'].includes(me?.role)
  const visibleProfiles = profiles.filter((p) =>
    p.id !== session.user.id &&
    p.is_active &&
    (p.full_name || '').toLowerCase().includes(query.toLowerCase())
  )
  const visibleChats = chats.filter((c) =>
    (c.name || '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="appShell">
      {adminOpen && <AdminPanel profiles={profiles} onClose={() => setAdminOpen(false)} onRefresh={loadProfiles} />}
      {groupOpen && (
        <GroupModal
          profiles={profiles}
          currentUserId={session.user.id}
          onClose={() => setGroupOpen(false)}
          onCreated={async (chat) => {
            await loadChats()
            setActiveChat(chat)
            setTab('chats')
            setMobileOpen(true)
          }}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobileHidden' : ''}`}>
        <header className="sideHeader">
          <div className="me">
            <Avatar profile={me} />
            <div>
              <strong>{me?.full_name || session.user.email}</strong>
              <span>{formatLastSeen(me || {})}</span>
            </div>
          </div>

          <div className="tools">
            {isAdmin && <button onClick={() => setAdminOpen(true)}><UserCog size={19} /></button>}
            <button onClick={() => setGroupOpen(true)}><Plus size={19} /></button>
            <button><Bell size={19} /></button>
            <button><Settings size={19} /></button>
            <button onClick={logout}><LogOut size={19} /></button>
          </div>
        </header>

        <div className="tabs">
          <button className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')}>
            <MessageCircle size={17} /> المحادثات
          </button>
          <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
            <Users size={17} /> الأعضاء
          </button>
        </div>

        <div className="searchBox">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'members' ? 'بحث في الأعضاء' : 'بحث في المحادثات'}
          />
        </div>

        <div className="list">
          {tab === 'members' ? (
            <>
              <div className="onlineCount">المتصلون الآن: {visibleProfiles.filter(isOnline).length}</div>
              {visibleProfiles.map((p) => (
                <button className="memberRow" key={p.id} onClick={() => startPrivateChat(p)}>
                  <Avatar profile={p} />
                  <div className="rowMain"><strong>{p.full_name}</strong><span>{formatLastSeen(p)}</span></div>
                  <MessageCircle size={18} />
                </button>
              ))}
            </>
          ) : visibleChats.length ? (
            visibleChats.map((chat) => (
              <button
                className={`chatRow ${activeChat?.id === chat.id ? 'active' : ''}`}
                key={chat.id}
                onClick={() => openChat(chat)}
              >
                <Avatar profile={chat.peer} text={chat.name || 'م'} />
                <div className="rowMain">
                  <strong>{chat.name || 'محادثة'}</strong>
                  <span>{chat.type === 'group' ? 'مجموعة' : 'محادثة خاصة'}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="empty">لا توجد محادثات. افتح الأعضاء وابدأ محادثة.</div>
          )}
        </div>

        <footer>Supabase Realtime connected</footer>
      </aside>

      <main className={`chatPanel ${mobileOpen ? 'mobileVisible' : ''}`}>
        <header className="chatHeader">
          <button className="back" onClick={closeConversation}><ArrowRight /></button>
          <Avatar profile={activeChat?.peer} text={activeChat?.name || 'م'} />
          <div className="chatTitle">
            <strong>{activeChat?.name || 'اختر محادثة'}</strong>
            <span>
              {activeChat?.peer
                ? formatLastSeen(activeChat.peer)
                : activeChat
                  ? 'Realtime مفعل'
                  : 'اختر عضوًا للبدء'}
            </span>
          </div>
          <button className="more"><MoreVertical /></button>
        </header>

        <section className="messages">
          {!activeChat ? (
            <div className="emptyChat">اختر محادثة أو عضوًا للبدء</div>
          ) : messages.length === 0 ? (
            <div className="emptyChat">لا توجد رسائل بعد</div>
          ) : (
            <div className="messageStack">
              {messages.map((message) => {
                const mine = message.sender_id === session.user.id
                return (
                  <article key={message.id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
                    {!mine && <strong>{message.profiles?.full_name || 'مستخدم'}</strong>}
                    <p>{message.body}</p>
                    <footer>
                      <time>{formatMessageTime(message.created_at)}</time>
                      {mine && <CheckCheck size={15} className="read" />}
                    </footer>
                  </article>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <Composer
          disabled={!activeChat}
          value={draft}
          onChange={setDraft}
          onSubmit={sendMessage}
        />
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
