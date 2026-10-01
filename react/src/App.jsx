import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Home, Play, Search, Send, Heart, User, Settings } from 'lucide-react'
import { AppProvider, useC } from './context/AppContext'
import { Auth } from './components/Shared'
import CallOverlay from './components/CallOverlay'
import Modals from './components/Modals'
import HomePage from './pages/HomePage'
import ReelsPage from './pages/ReelsPage'
import SearchPage from './pages/SearchPage'
import ExplorePage from './pages/ExplorePage'
import NotificationsPage from './pages/NotificationsPage'
import MessagesPage from './pages/MessagesPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import './App.css'

function ProfileRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <ProfilePage id={id} goChat={userId => navigate(`/messages/${userId}`)} />
}

function MessagesRoute() {
  const { id } = useParams()
  const { peer, setPeer } = useC()
  const navigate = useNavigate()
  const currentPeer = id || peer || null
  const choosePeer = userId => {
    setPeer(userId)
    navigate(`/messages/${userId}`)
  }
  return <MessagesPage peer={currentPeer} setPeer={choosePeer} />
}

function AppShell() {
  const { me, A, open, unreadN, unreadM, accessInfo } = useC()
  const navigate = useNavigate()
  const [accountMenu, setAccountMenu] = useState(false)

  if (!me) return <Auth A={A} accessInfo={accessInfo} />

  const isAdmin = me.username === 'admin' || (me.username || '').toLowerCase().includes('admin') || me.isAdmin
  const nav = [
    ['/', Home, 'Home', unreadN * 0],
    ['/reels', Play, 'Reels'],
    ['/notifications', Heart, 'Notifications', unreadN],
    ['/search', Search, 'Search'],
    ['/messages', Send, 'Messages', unreadM],
    [`/profile/${me.id}`, User, `${me.username} ▾`],
    ...(isAdmin ? [['/admin', Settings, 'Admin']] : []),
  ]

  const pathname = window.location.pathname
  const active = pathname.startsWith('/profile/') ? '/profile/' + me.id : pathname
  const go = path => navigate(path)
  const Badge = ({ n }) => n > 0 ? <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3040] px-1 text-[10px] font-bold text-white">{n}</span> : null
  const recentAccounts = (() => { try { return JSON.parse(localStorage.getItem('instakids_recent_accounts') || '[]') } catch { return [] } })()
  const chooseAccount = username => { localStorage.setItem('instakids_switch_account', username); setAccountMenu(false); A.logout(); navigate('/') }

  return <div className="min-h-screen bg-white text-neutral-900 dark:bg-[#0b1224] dark:text-neutral-100">
    <aside className="ig-sidebar fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-neutral-200 bg-white px-3 pb-5 pt-7 dark:border-[#1d2a45] dark:bg-[#070b19] md:flex">
      <nav className="space-y-1">
        {nav.map(([path, I, label, badge]) => <button key={path} onClick={() => go(path)} className="group flex w-full items-center gap-4 rounded-xl p-3.5 hover:bg-neutral-100 dark:hover:bg-neutral-900">
          <span className={`relative transition group-hover:scale-110 ${active === path ? 'text-[#f5a400]' : ''}`}><I size={26} strokeWidth={active === path ? 2.8 : 1.8} /><Badge n={badge} /></span>
          <span className={`sidebar-label text-[15px] ${active === path ? 'font-bold' : ''}`}>{label}</span>
        </button>)}
      </nav>
    </aside>

    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-[#1d2a45] dark:bg-[#070b19] md:hidden">
      <span className="font-logo text-2xl text-neutral-900 dark:text-white">InstaKids</span>
      <div className="flex items-center gap-3"><button onClick={() => navigate('/notifications')} aria-label="Bildirishnomalar" className="relative p-1"><Heart size={23} /><Badge n={unreadN} /></button>{isAdmin && <button onClick={() => navigate('/admin')} aria-label="Admin panel" className="p-1"><Settings size={22} /></button>}</div>
    </header>

    <div className="app-page-shell pb-16 md:pb-0">
      {accessInfo.restriction?.active && <div role="status" className="mx-auto mt-3 max-w-[900px] rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        Admin cheklovi faol. Xabar, like va follow vaqtincha ishlamaydi. Tugash vaqti: {new Date(accessInfo.restriction.until).toLocaleString('uz-UZ')}.
      </div>}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/messages" element={<MessagesRoute />} />
        <Route path="/messages/:id" element={<MessagesRoute />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile/:id" element={<ProfileRoute />} />
        <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>

    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-neutral-200 bg-white dark:border-[#1d2a45] dark:bg-[#070b19] md:hidden">
      {nav.filter(x => ['/','/reels','/messages','/search',`/profile/${me.id}`].includes(x[0]) || (isAdmin && x[0] === '/admin')).map(([path, I, , badge]) =>
        <button key={path} onClick={() => go(path)} onContextMenu={path === `/profile/${me.id}` ? event => { event.preventDefault(); setAccountMenu(true) } : undefined} className={`relative p-2 ${active === path ? 'text-[#f5a400]' : ''}`}><I size={26} strokeWidth={active === path ? 2.8 : 1.8} /><Badge n={badge} /></button>
      )}
    </nav>
    {accountMenu && <div className="fixed bottom-16 right-3 z-[120] w-64 rounded-2xl border border-[#263756] bg-[#101a30] p-3 text-white shadow-2xl"><div className="mb-2 flex items-center justify-between"><b className="text-sm">Akkauntni almashtirish</b><button onClick={() => setAccountMenu(false)} aria-label="Yopish">×</button></div>{recentAccounts.filter(account => account.username !== me.username).length ? recentAccounts.filter(account => account.username !== me.username).map(account => <button key={account.username} onClick={() => chooseAccount(account.username)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-[#17223b]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#263756] font-bold">{(account.name || account.username)[0].toUpperCase()}</span><span className="min-w-0"><b className="block truncate">{account.name || account.username}</b><span className="block truncate text-xs text-neutral-400">@{account.username}</span></span></button>) : <p className="py-3 text-center text-xs text-neutral-400">Boshqa saqlangan akkaunt yo‘q.</p>}</div>}
    <CallOverlay />
    <Modals />
  </div>
}

export default function App() {
  return <BrowserRouter><AppProvider><AppShell /></AppProvider></BrowserRouter>
}
