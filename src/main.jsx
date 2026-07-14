import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight,
  Bell,
  CheckCheck,
  LogOut,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  UserCog,
  Users,
  X,
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

  const date = new Date(value)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString('ar-SA', {
    day: 'numeric',
    month: 'numeric',
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
        <div className="authLogo">
          <MessageCircle />
        </div>

        <h1>LAN Chat Pro</h1>
        <p>تواصل داخلي آمن وسريع لفريق العمل</p>

        <form className="authForm" onSubmit={submit}>
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
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </header>

        {children}
      </section>
    </div>
  )
}

function AdminPanel({ profiles, onClose, onRefresh }) {
  const [query, setQuery] = useState('')

  async function updateProfile(id, patch) {
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', id)

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
              <span>
                {formatLastSeen(profile)} · {profile.role}
              </span>
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
                  updateProfile(profile.id, {
                    is_active: event.target.checked,
                  })
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

function GroupModal({
  profiles,
  currentUserId,
  onClose,
  onCreated,
}) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(false)

  function toggleMember(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    )
  }

  async function submit(event) {
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
        {
          chat_id: chat.id,
          user_id: currentUserId,
          member_role: 'owner',
          last_read_at: new Date().toISOString(),
        },
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
      <form className="groupForm" onSubmit={submit}>
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

function Composer({
  disabled,
  value,
  onChange,
  onSubmit,
}) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const fileInputRef = useRef(null)
  const hasText = value.trim().length > 0

  function insertEmoji(emoji) {
    onChange(value + emoji)
    setEmojiOpen(false)
  }

  return (
    <div className="composerWrap">
      {emojiOpen && (
        <div className="emojiPanel">
          {['😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '🔥', '✅', '👏'].map(
            (emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            )
          )}
        </div>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <div className="composerTools">
          <button
            type="button"
            onClick={() => setEmojiOpen((current) => !current)}
            disabled={disabled}
          >
            <Smile size={22} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip size={21} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={() =>
              alert('رفع الملفات سيكون في المرحلة التالية')
            }
          />
        </div>

        <input
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="اكتب رسالة"
        />

        <button
          className="composerAction"
          disabled={disabled}
          type={hasText ? 'submit' : 'button'}
        >
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

    setMe(
      (data || []).find(
        (profile) => profile.id === session.user.id
      ) || null
    )
  }, [session?.user?.id])

  const loadChats = useCallback(async () => {
    if (!session?.user?.id) return

    const { data: memberships, error } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        last_read_at,
        chats(
          id,
          name,
          type,
          created_at,
          created_by,
          last_message_at
        )
      `)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Load chats error:', error)
      return
    }

    const enrichedChats = await Promise.all(
      (memberships || []).map(async (membership) => {
        const chat = membership.chats

        if (!chat) return null

        let peer = null
        let displayName = chat.name

        if (chat.type === 'private') {
          const { data: memberRows, error: membersError } =
            await supabase
              .from('chat_members')
              .select('user_id,profiles:user_id(*)')
              .eq('chat_id', chat.id)

          if (membersError) {
            console.error(
              'Load private chat members error:',
              membersError
            )
          }

          peer =
            (memberRows || [])
              .map((item) => item.profiles)
              .find(
                (profile) =>
                  profile?.id !== session.user.id
              ) || null

          displayName = peer?.full_name || 'محادثة خاصة'
        }

        const { data: lastRows, error: lastMessageError } =
          await supabase
            .from('messages')
            .select('body,created_at,sender_id')
            .eq('chat_id', chat.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)

        if (lastMessageError) {
          console.error(
            'Load last message error:',
            lastMessageError
          )
        }

        const lastMessage = lastRows?.[0] || null

        let unreadQuery = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('chat_id', chat.id)
          .neq('sender_id', session.user.id)
          .is('deleted_at', null)

        if (membership.last_read_at) {
          unreadQuery = unreadQuery.gt(
            'created_at',
            membership.last_read_at
          )
        }

        const { count, error: unreadError } =
          await unreadQuery

        if (unreadError) {
          console.error(
            'Load unread messages error:',
            unreadError
          )
        }

        return {
          ...chat,
          name: displayName,
          peer,
          lastMessage,
          unread: count || 0,
          sortAt:
            lastMessage?.created_at ||
            chat.last_message_at ||
            chat.created_at,
        }
      })
    )

    const cleanChats = enrichedChats
      .filter(Boolean)
      .sort(
        (first, second) =>
          new Date(second.sortAt) -
          new Date(first.sortAt)
      )

    setChats(cleanChats)

    setActiveChat((current) =>
      current
        ? cleanChats.find(
            (chat) => chat.id === current.id
          ) || current
        : null
    )
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
        profiles:sender_id(
          full_name,
          status,
          last_seen
        )
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

  const markRead = useCallback(
    async (chatId) => {
      if (!session?.user?.id || !chatId) return

      const { error } = await supabase
        .from('chat_members')
        .update({
          last_read_at: new Date().toISOString(),
        })
        .eq('chat_id', chatId)
        .eq('user_id', session.user.id)

      if (error) {
        console.error('Mark read error:', error)
      }
    },
    [session?.user?.id]
  )

  useEffect(() => {
    if (!session?.user?.id) return undefined

    setLoading(true)

    Promise.all([
      loadProfiles(),
      loadChats(),
    ]).finally(() => setLoading(false))

    return undefined
  }, [
    session?.user?.id,
    loadProfiles,
    loadChats,
  ])

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

      if (error) {
        console.error('Presence error:', error)
      }
    }

    void heartbeat()

    const timer = window.setInterval(
      heartbeat,
      PRESENCE_INTERVAL_MS
    )

    return () => {
      window.clearInterval(timer)
    }
  }, [session?.user?.id])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!session?.user?.id) return undefined

    const channel = supabase
      .channel(`app-live-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          void loadProfiles()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          void loadChats()

          const changedChatId =
            payload.new?.chat_id ||
            payload.old?.chat_id

          if (changedChatId === activeChat?.id) {
            void loadMessages()
            void markRead(activeChat.id)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
        },
        () => {
          void loadChats()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_members',
        },
        () => {
          void loadChats()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [
    session?.user?.id,
    activeChat?.id,
    loadProfiles,
    loadChats,
    loadMessages,
    markRead,
  ])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages])

  useEffect(() => {
    if (!session) return undefined

    window.history.replaceState(
      { lanChat: true },
      '',
      window.location.href
    )

    window.history.pushState(
      { lanChat: true },
      '',
      window.location.href
    )

    function handleBrowserBack() {
      if (activeChat) {
        setActiveChat(null)
        setMessages([])
        setMobileOpen(false)
      }

      window.history.pushState(
        { lanChat: true },
        '',
        window.location.href
      )
    }

    window.addEventListener(
      'popstate',
      handleBrowserBack
    )

    return () => {
      window.removeEventListener(
        'popstate',
        handleBrowserBack
      )
    }
  }, [session, activeChat])

  async function openChat(chat) {
    setActiveChat(chat)
    setMobileOpen(true)

    await markRead(chat.id)
    await loadChats()

    window.history.pushState(
      {
        lanChat: true,
        chatOpen: true,
      },
      '',
      window.location.href
    )
  }

  async function startPrivateChat(otherUser) {
    const existingChat = chats.find(
      (chat) =>
        chat.type === 'private' &&
        chat.peer?.id === otherUser.id
    )

    if (existingChat) {
      await openChat(existingChat)
      return
    }

    const { data: chat, error: chatError } =
      await supabase
        .from('chats')
        .insert({
          type: 'private',
          created_by: session.user.id,
        })
        .select()
        .single()

    if (chatError) {
      alert(chatError.message)
      return
    }

    const { error: membersError } = await supabase
      .from('chat_members')
      .insert([
        {
          chat_id: chat.id,
          user_id: session.user.id,
          member_role: 'owner',
          last_read_at: new Date().toISOString(),
        },
        {
          chat_id: chat.id,
          user_id: otherUser.id,
          member_role: 'member',
        },
      ])

    if (membersError) {
      alert(membersError.message)
      return
    }

    await loadChats()

    await openChat({
      ...chat,
      name: otherUser.full_name,
      peer: otherUser,
      unread: 0,
    })

    setTab('chats')
  }

  async function sendMessage(event) {
    event.preventDefault()

    const body = draft.trim()

    if (!body || !activeChat?.id) return

    setDraft('')

    const { error } = await supabase
      .from('messages')
      .insert({
        chat_id: activeChat.id,
        sender_id: session.user.id,
        body,
      })

    if (error) {
      setDraft(body)
      alert(error.message)
      return
    }

    await markRead(activeChat.id)

    await Promise.all([
      loadMessages(),
      loadChats(),
    ])
  }

  function closeConversation() {
    setMobileOpen(false)
    setActiveChat(null)
    setMessages([])

    window.history.pushState(
      {
        lanChat: true,
        chatOpen: false,
      },
      '',
      window.location.href
    )
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

  if (loading) {
    return (
      <div className="loadingPage">
        جارٍ التحميل...
      </div>
    )
  }

  if (!session) return <Login />

  const isAdmin = [
    'super_admin',
    'admin',
  ].includes(me?.role)

  const visibleProfiles = profiles.filter(
    (profile) =>
      profile.id !== session.user.id &&
      profile.is_active &&
      (profile.full_name || '')
        .toLowerCase()
        .includes(query.toLowerCase())
  )

  const visibleChats = chats.filter(
    (chat) =>
      (chat.name || '')
        .toLowerCase()
        .includes(query.toLowerCase()) ||
      (chat.lastMessage?.body || '')
        .toLowerCase()
        .includes(query.toLowerCase())
  )

  const totalUnread = chats.reduce(
    (sum, chat) =>
      sum + (chat.unread || 0),
    0
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
            await openChat(chat)
            setTab('chats')
          }}
        />
      )}

      <aside
        className={`sidebar ${
          mobileOpen ? 'mobileHidden' : ''
        }`}
      >
        <header className="sideHeader">
          <div className="me">
            <Avatar profile={me} />

            <div>
              <strong>
                {me?.full_name ||
                  session.user.email}
              </strong>

              <span>
                {formatLastSeen(me || {})}
              </span>
            </div>
          </div>

          <div className="tools">
            {isAdmin && (
              <button
                onClick={() =>
                  setAdminOpen(true)
                }
              >
                <UserCog size={19} />
              </button>
            )}

            <button
              onClick={() =>
                setGroupOpen(true)
              }
            >
              <Plus size={19} />
            </button>

            <button className="bellButton">
              <Bell size={19} />

              {totalUnread > 0 && (
                <b>
                  {totalUnread > 99
                    ? '99+'
                    : totalUnread}
                </b>
              )}
            </button>

            <button>
              <Settings size={19} />
            </button>

            <button onClick={logout}>
              <LogOut size={19} />
            </button>
          </div>
        </header>

        <div className="tabs">
          <button
            className={
              tab === 'chats'
                ? 'active'
                : ''
            }
            onClick={() =>
              setTab('chats')
            }
          >
            <MessageCircle size={17} />
            المحادثات
          </button>

          <button
            className={
              tab === 'members'
                ? 'active'
                : ''
            }
            onClick={() =>
              setTab('members')
            }
          >
            <Users size={17} />
            الأعضاء
          </button>
        </div>

        <div className="searchBox">
          <Search size={18} />

          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder={
              tab === 'members'
                ? 'بحث في الأعضاء'
                : 'بحث في المحادثات'
            }
          />
        </div>

        <div className="list">
          {tab === 'members' ? (
            <>
              <div className="onlineCount">
                المتصلون الآن:{' '}
                {
                  visibleProfiles.filter(
                    isOnline
                  ).length
                }
              </div>

              {visibleProfiles.map(
                (profile) => (
                  <button
                    className="memberRow"
                    key={profile.id}
                    onClick={() =>
                      startPrivateChat(
                        profile
                      )
                    }
                  >
                    <Avatar
                      profile={profile}
                    />

                    <div className="rowMain">
                      <strong>
                        {profile.full_name}
                      </strong>

                      <span>
                        {formatLastSeen(
                          profile
                        )}
                      </span>
                    </div>

                    <MessageCircle
                      size={18}
                    />
                  </button>
                )
              )}
            </>
          ) : visibleChats.length ? (
            visibleChats.map((chat) => (
              <button
                className={`chatRow ${
                  activeChat?.id ===
                  chat.id
                    ? 'active'
                    : ''
                }`}
                key={chat.id}
                onClick={() =>
                  openChat(chat)
                }
              >
                <Avatar
                  profile={chat.peer}
                  text={chat.name || 'م'}
                />

                <div className="rowMain">
                  <div className="chatRowTop">
                    <strong>
                      {chat.name ||
                        'محادثة'}
                    </strong>

                    <time>
                      {formatMessageTime(
                        chat.sortAt
                      )}
                    </time>
                  </div>

                  <div className="chatRowBottom">
                    <span>
                      {chat.lastMessage
                        ?.body ||
                        (chat.type ===
                        'group'
                          ? 'مجموعة جديدة'
                          : 'ابدأ المحادثة')}
                    </span>

                    {chat.unread > 0 && (
                      <b className="unreadBadge">
                        {chat.unread > 99
                          ? '99+'
                          : chat.unread}
                      </b>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="empty">
              لا توجد محادثات. افتح
              الأعضاء وابدأ محادثة.
            </div>
          )}
        </div>

        <footer>
          Supabase Realtime connected
        </footer>
      </aside>

      <main
        className={`chatPanel ${
          mobileOpen
            ? 'mobileVisible'
            : ''
        }`}
      >
        <header className="chatHeader">
          <button
            className="back"
            onClick={closeConversation}
          >
            <ArrowRight />
          </button>

          <Avatar
            profile={activeChat?.peer}
            text={activeChat?.name || 'م'}
          />

          <div className="chatTitle">
            <strong>
              {activeChat?.name ||
                'اختر محادثة'}
            </strong>

            <span>
              {activeChat?.peer
                ? formatLastSeen(
                    activeChat.peer
                  )
                : activeChat
                  ? 'Realtime مفعل'
                  : 'اختر عضوًا للبدء'}
            </span>
          </div>

          <button className="more">
            <MoreVertical />
          </button>
        </header>

        <section className="messages">
          {!activeChat ? (
            <div className="emptyChat">
              اختر محادثة أو عضوًا
              للبدء
            </div>
          ) : messages.length === 0 ? (
            <div className="emptyChat">
              لا توجد رسائل بعد
            </div>
          ) : (
            <div className="messageStack">
              {messages.map(
                (message) => {
                  const mine =
                    message.sender_id ===
                    session.user.id

                  return (
                    <article
                      key={message.id}
                      className={`bubble ${
                        mine
                          ? 'mine'
                          : 'theirs'
                      }`}
                    >
                      {!mine && (
                        <strong>
                          {message.profiles
                            ?.full_name ||
                            'مستخدم'}
                        </strong>
                      )}

                      <p>
                        {message.body}
                      </p>

                      <footer>
                        <time>
                          {formatMessageTime(
                            message.created_at
                          )}
                        </time>

                        {mine && (
                          <CheckCheck
                            size={15}
                            className="read"
                          />
                        )}
                      </footer>
                    </article>
                  )
                }
              )}

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

createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
