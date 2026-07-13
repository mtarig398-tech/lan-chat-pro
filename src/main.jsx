import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight,
  Bell,
  CheckCheck,
  LogOut,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import './styles.css'

const ONLINE_WINDOW_MS = 70_000
const PRESENCE_INTERVAL_MS = 30_000

function isOnline(profile) {
  if (!profile?.last_seen || profile.status !== 'online') return false
  return Date.now() - new Date(profile.last_seen).getTime() <= ONLINE_WINDOW_MS
}

function formatLastSeen(profile) {
  if (isOnline(profile)) return 'متصل الآن'
  if (!profile?.last_seen) return 'غير متصل'

  return `آخر ظهور ${new Date(profile.last_seen).toLocaleString('ar-SA', {
    dateStyle: 'short',
    timeStyle: 'short',
  })}`
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

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) setError(signInError.message)
    setLoading(false)
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authLogo"><MessageCircle /></div>
        <h1>LAN Chat Pro</h1>
        <p>تواصل داخلي آمن وسريع لفريق العمل</p>

        <form className="authForm" onSubmit={handleSubmit}>
          <label>
            البريد الإلكتروني
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            كلمة المرور
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <div className="errorBox">{error}</div>}

          <button disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="authSecurity">
          <ShieldCheck size={16} />
          محمي بواسطة Supabase Auth
        </div>
      </section>
    </main>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="إغلاق"><X /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

function AdminPanel({ profiles, onClose, onRefresh }) {
  const [query, setQuery] = useState('')

  async function updateProfile(userId, patch) {
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)

    if (error) return alert(error.message)
    await onRefresh()
  }

  const visibleProfiles = profiles.filter((profile) =>
    (profile.full_name || '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Modal title="إدارة المستخدمين" onClose={onClose}>
      <div className="searchBox">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث"
        />
      </div>

      <div className="adminRows">
        {visibleProfiles.map((profile) => (
          <article key={profile.id}>
            <Avatar profile={profile} />
            <div className="rowMain">
              <strong>{profile.full_name}</strong>
              <span>{formatLastSeen(profile)} · {profile.role}</span>
            </div>

            <select
              value={profile.role}
              onChange={(event) =>
                updateProfile(profile.id, { role: event.target.value })
              }
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>

            <label className="switch">
              <input
                type="checkbox"
                checked={profile.is_active}
                onChange={(event) =>
                  updateProfile(profile.id, { is_active: event.target.checked })
                }
              />
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
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(false)

  function toggleMember(userId) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          type: 'group',
          name: name.trim(),
          created_by: currentUserId,
        })
        .select()
        .single()

      if (chatError) throw chatError

      const rows = [
        { chat_id: chat.id, user_id: currentUserId, member_role: 'owner' },
        ...selectedIds.map((userId) => ({
          chat_id: chat.id,
          user_id: userId,
          member_role: 'member',
        })),
      ]

      const { error: membersError } = await supabase
        .from('chat_members')
        .insert(rows)

      if (membersError) throw membersError

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
      <form className="groupForm" onSubmit={handleSubmit}>
        <input
          className="groupName"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="اسم المجموعة"
        />

        <div className="pickMembers">
          {profiles
            .filter(
              (profile) =>
                profile.id !== currentUserId && profile.is_active
            )
            .map((profile) => (
              <label key={profile.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(profile.id)}
                  onChange={() => toggleMember(profile.id)}
                />
                <Avatar profile={profile} />
                <div>
                  <strong>{profile.full_name}</strong>
                  <span>{formatLastSeen(profile)}</span>
                </div>
              </label>
            ))}
        </div>

        <button className="primary" disabled={loading}>
          {loading ? 'جارٍ الإنشاء...' : 'إنشاء المجموعة'}
        </button>
      </form>
    </Modal>
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
    if (!supabaseConfigured) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (mounted) setSession(nextSession)
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const loadProfiles = useCallback(async () => {
    if (!session?.user?.id) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')

    if (error) {
      console.error('Load profiles error:', error)
      return
    }

    setProfiles(data || [])
    const ownProfile = (data || []).find(
      (profile) => profile.id === session.user.id
    )
    if (ownProfile) setMe(ownProfile)
  }, [session?.user?.id])

  const loadChats = useCallback(async () => {
    if (!session?.user?.id) return

    const { data, error } = await supabase
      .from('chat_members')
      .select('chat_id,chats(id,name,type,created_at,created_by)')
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Load chats error:', error)
      return
    }

    const list = (data || []).map((item) => item.chats).filter(Boolean)
    setChats(list)
    setActiveChat((current) => current || list[0] || null)
  }, [session?.user?.id])

  const loadMessages = useCallback(async () => {
    if (!activeChat?.id) {
      setMessages([])
      return
    }

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        body,
        created_at,
        sender_id,
        profiles:sender_id(full_name,status,last_seen)
      `)
      .eq('chat_id', activeChat.id)
      .is('deleted_at', null)
      .order('created_at')

    if (error) {
      console.error('Load messages error:', error)
      return
    }

    setMessages(data || [])
  }, [activeChat?.id])

  useEffect(() => {
    if (!session?.user?.id) return undefined

    let active = true

    async function bootstrap() {
      setLoading(true)
      await Promise.all([loadProfiles(), loadChats()])
      if (active) setLoading(false)
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [session?.user?.id, loadProfiles, loadChats])

  useEffect(() => {
    if (!session?.user?.id) return undefined

    async function heartbeat() {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'online',
          last_seen: new Date().toISOString(),
        })
        .eq('id', session.user.id)

      if (error) console.error('Presence error:', error)
    }

    heartbeat()
    const timer = window.setInterval(heartbeat, PRESENCE_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [session?.user?.id])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!session?.user?.id) return undefined

    let active = true

    const channel = supabase
      .channel(`profiles-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          if (active) void loadProfiles()
        }
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [session?.user?.id, loadProfiles])

  useEffect(() => {
    if (!activeChat?.id) return undefined

    let active = true
    const chatId = activeChat.id

    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          if (active) void loadMessages()
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime messages channel error')
        }
      })

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [activeChat?.id, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function openChat(chat) {
    if (chat.type !== 'private') {
      setActiveChat(chat)
      setMobileOpen(true)
      return
    }

    const { data, error } = await supabase
      .from('chat_members')
      .select('user_id,profiles:user_id(*)')
      .eq('chat_id', chat.id)

    if (error) return alert(error.message)

    const peer = (data || [])
      .map((item) => item.profiles)
      .find((profile) => profile?.id !== session.user.id)

    setActiveChat({
      ...chat,
      name: peer?.full_name || 'محادثة خاصة',
      peer,
    })
    setMobileOpen(true)
  }

  async function startPrivateChat(otherUser) {
    for (const chat of chats.filter((item) => item.type === 'private')) {
      const { data } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chat.id)

      const memberIds = (data || []).map((item) => item.user_id)

      if (memberIds.length === 2 && memberIds.includes(otherUser.id)) {
        setActiveChat({
          ...chat,
          name: otherUser.full_name,
          peer: otherUser,
        })
        setTab('chats')
        setMobileOpen(true)
        return
      }
    }

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({ type: 'private', created_by: session.user.id })
      .select()
      .single()

    if (chatError) return alert(chatError.message)

    const { error: membersError } = await supabase
      .from('chat_members')
      .insert([
        {
          chat_id: chat.id,
          user_id: session.user.id,
          member_role: 'owner',
        },
        {
          chat_id: chat.id,
          user_id: otherUser.id,
          member_role: 'member',
        },
      ])

    if (membersError) return alert(membersError.message)

    await loadChats()
    setActiveChat({
      ...chat,
      name: otherUser.full_name,
      peer: otherUser,
    })
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
      alert(error.message)
      return
    }

    await loadMessages()
  }

  async function logout() {
    await supabase
      .from('profiles')
      .update({
        status: 'offline',
        last_seen: new Date().toISOString(),
      })
      .eq('id', session.user.id)

    await supabase.auth.signOut()
  }

  if (loading) return <div className="loadingPage">جارٍ التحميل...</div>
  if (!session) return <Login />

  const isAdmin = ['super_admin', 'admin'].includes(me?.role)

  const visibleProfiles = profiles.filter(
    (profile) =>
      profile.id !== session.user.id &&
      profile.is_active &&
      (profile.full_name || '').toLowerCase().includes(query.toLowerCase())
  )

  const visibleChats = chats.filter((chat) =>
    (chat.name || 'محادثة خاصة')
      .toLowerCase()
      .includes(query.toLowerCase())
  )

  return (
    <div className="appShell">
      {adminOpen && (
        <AdminPanel
          profiles={profiles}
          onClose={() => setAdminOpen(false)}
          onRefresh={loadProfiles}
        />
      )}

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
            {isAdmin && (
              <button onClick={() => setAdminOpen(true)}>
                <UserCog size={19} />
              </button>
            )}

            <button onClick={() => setGroupOpen(true)}>
              <Plus size={19} />
            </button>
            <button><Bell size={19} /></button>
            <button><Settings size={19} /></button>
            <button onClick={logout}><LogOut size={19} /></button>
          </div>
        </header>

        <div className="tabs">
          <button
            className={tab === 'chats' ? 'active' : ''}
            onClick={() => setTab('chats')}
          >
            <MessageCircle size={17} />
            المحادثات
          </button>

          <button
            className={tab === 'members' ? 'active' : ''}
            onClick={() => setTab('members')}
          >
            <Users size={17} />
            الأعضاء
          </button>
        </div>

        <div className="searchBox">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === 'members' ? 'بحث في الأعضاء' : 'بحث في المحادثات'
            }
          />
        </div>

        <div className="list">
          {tab === 'members' ? (
            <>
              <div className="onlineCount">
                المتصلون الآن: {visibleProfiles.filter(isOnline).length}
              </div>

              {visibleProfiles.length === 0 ? (
                <div className="empty">لا يوجد أعضاء آخرون حتى الآن.</div>
              ) : (
                visibleProfiles.map((profile) => (
                  <button
                    className="memberRow"
                    key={profile.id}
                    onClick={() => startPrivateChat(profile)}
                  >
                    <Avatar profile={profile} />
                    <div className="rowMain">
                      <strong>{profile.full_name}</strong>
                      <span>{formatLastSeen(profile)}</span>
                    </div>
                    <MessageCircle size={18} />
                  </button>
                ))
              )}
            </>
          ) : visibleChats.length === 0 ? (
            <div className="empty">
              لا توجد محادثات. افتح الأعضاء وابدأ محادثة.
            </div>
          ) : (
            visibleChats.map((chat) => (
              <button
                className={`chatRow ${
                  activeChat?.id === chat.id ? 'active' : ''
                }`}
                key={chat.id}
                onClick={() => openChat(chat)}
              >
                <Avatar text={chat.name || 'م'} />
                <div className="rowMain">
                  <strong>{chat.name || 'محادثة خاصة'}</strong>
                  <span>
                    {chat.type === 'group' ? 'مجموعة' : 'محادثة خاصة'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <footer>Supabase Realtime connected</footer>
      </aside>

      <main className={`chatPanel ${mobileOpen ? 'mobileVisible' : ''}`}>
        <header className="chatHeader">
          <button className="back" onClick={() => setMobileOpen(false)}>
            <ArrowRight />
          </button>

          <Avatar
            profile={activeChat?.peer}
            text={activeChat?.name || 'م'}
          />

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
            messages.map((message) => {
              const mine = message.sender_id === session.user.id

              return (
                <article
                  key={message.id}
                  className={`bubble ${mine ? 'mine' : 'theirs'}`}
                >
                  {!mine && (
                    <strong>{message.profiles?.full_name || 'مستخدم'}</strong>
                  )}

                  <p>{message.body}</p>

                  <footer>
                    <time>
                      {new Date(message.created_at).toLocaleTimeString(
                        'ar-SA',
                        { hour: '2-digit', minute: '2-digit' }
                      )}
                    </time>

                    {mine && <CheckCheck size={15} className="read" />}
                  </footer>
                </article>
              )
            })
          )}

          <div ref={bottomRef} />
        </section>

        <form className="composer" onSubmit={sendMessage}>
          <input
            disabled={!activeChat}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="اكتب رسالة"
          />
          <button disabled={!activeChat}><Send size={20} /></button>
        </form>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
