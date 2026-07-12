import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Hash, LayoutDashboard, MessageSquare, Search, Send, Shield, Users, Wifi, Plus, Settings } from 'lucide-react';
import './styles.css';

const seedRooms = [
  { id: 'general', name: 'العام', unread: 3 },
  { id: 'it', name: 'تقنية المعلومات', unread: 0 },
  { id: 'operations', name: 'العمليات', unread: 1 },
  { id: 'management', name: 'الإدارة', unread: 0 },
];

const seedUsers = [
  { name: 'محمد طارق', role: 'مدير النظام', online: true },
  { name: 'أحمد', role: 'مشرف', online: true },
  { name: 'سارة', role: 'مستخدم', online: true },
  { name: 'خالد', role: 'مستخدم', online: false },
];

const seedMessages = {
  general: [
    { id: 1, author: 'أحمد', text: 'مرحبًا بالجميع في LAN Chat Pro 👋', time: '10:12', mine: false },
    { id: 2, author: 'محمد طارق', text: 'هذه النسخة الأولى من واجهة React، وسنربطها مع Supabase في الخطوة التالية.', time: '10:15', mine: true },
    { id: 3, author: 'سارة', text: 'التصميم واضح وخفيف جدًا.', time: '10:18', mine: false },
  ],
  it: [{ id: 4, author: 'محمد طارق', text: 'غرفة فريق تقنية المعلومات.', time: '09:40', mine: true }],
  operations: [{ id: 5, author: 'أحمد', text: 'تم إنشاء قناة العمليات.', time: '08:30', mine: false }],
  management: [{ id: 6, author: 'محمد طارق', text: 'هذه الغرفة مخصصة للإدارة.', time: '08:10', mine: true }],
};

function App() {
  const [activeRoom, setActiveRoom] = useState('general');
  const [messages, setMessages] = useState(seedMessages);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const active = seedRooms.find((room) => room.id === activeRoom);
  const visibleMessages = useMemo(() => (messages[activeRoom] || []).filter((m) => m.text.includes(query) || m.author.includes(query)), [messages, activeRoom, query]);

  function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => ({
      ...current,
      [activeRoom]: [...(current[activeRoom] || []), { id: Date.now(), author: 'محمد طارق', text, time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }), mine: true }],
    }));
    setDraft('');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brandMark"><MessageSquare size={22}/></div><div><strong>LAN Chat Pro</strong><span>الشبكة الداخلية</span></div></div>
        <nav className="nav">
          <button className="navItem active"><MessageSquare size={18}/>المحادثات</button>
          <button className="navItem"><LayoutDashboard size={18}/>لوحة التحكم</button>
          <button className="navItem"><Users size={18}/>المستخدمون</button>
          <button className="navItem"><Shield size={18}/>الصلاحيات</button>
        </nav>
        <div className="roomsHeader"><span>الغرف</span><button aria-label="إضافة غرفة"><Plus size={16}/></button></div>
        <div className="rooms">
          {seedRooms.map((room) => <button key={room.id} onClick={() => setActiveRoom(room.id)} className={`room ${activeRoom === room.id ? 'active' : ''}`}><span><Hash size={16}/>{room.name}</span>{room.unread > 0 && <b>{room.unread}</b>}</button>)}
        </div>
        <div className="profile"><div className="avatar">م</div><div><strong>محمد طارق</strong><span><i/>متصل</span></div><Settings size={18}/></div>
      </aside>

      <main className="chatArea">
        <header className="topbar">
          <div><div className="roomTitle"><Hash size={21}/><h1>{active?.name}</h1></div><p>قناة داخلية لفريق العمل</p></div>
          <div className="topActions"><div className="search"><Search size={18}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="بحث في الرسائل"/></div><div className="status"><Wifi size={17}/>Local ready</div></div>
        </header>
        <section className="messages">
          <div className="welcome"><div><Hash size={25}/></div><h2>بداية غرفة {active?.name}</h2><p>ابدأ المحادثة مع أعضاء الفريق.</p></div>
          {visibleMessages.map((message) => <article key={message.id} className={`message ${message.mine ? 'mine' : ''}`}><div className="messageAvatar">{message.author.charAt(0)}</div><div className="bubble"><div className="meta"><strong>{message.author}</strong><span>{message.time}</span></div><p>{message.text}</p></div></article>)}
        </section>
        <form className="composer" onSubmit={sendMessage}><button type="button" className="attach"><Plus size={21}/></button><input value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder={`إرسال رسالة إلى #${active?.name}`}/><button className="send" type="submit"><Send size={19}/>إرسال</button></form>
      </main>

      <aside className="membersPanel"><div className="membersTitle"><h3>الأعضاء</h3><span>{seedUsers.filter(u=>u.online).length} متصلون</span></div>{seedUsers.map((user) => <div className="member" key={user.name}><div className="memberAvatar">{user.name.charAt(0)}<i className={user.online ? 'online' : ''}/></div><div><strong>{user.name}</strong><span>{user.role}</span></div></div>)}</aside>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
