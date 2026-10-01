import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* ---------- data layer (localStorage, tabs sync live) ---------- */
const KEY = 'ig_db_v2', ME = 'ig_me_v2'
const EMPTY = { users: [], posts: [], reels: [], stories: [], seenStories: [], follows: [], messages: [], deletedMessages: [], hiddenChats: [], blockedUsers: [], blockedByUsers: [], notifs: [], saved: {}, searchHistory: [] }
const load = () => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...EMPTY } } }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const csrfToken = () => decodeURIComponent(document.cookie.split('; ').find(cookie => cookie.startsWith('csrftoken='))?.split('=')[1] || '')
const ensureCsrfToken = async () => {
  let token = csrfToken()
  if (token) return token
  try {
    const response = await fetch('/plat/csrf/', { credentials: 'same-origin' })
    const data = await response.json().catch(() => ({}))
    token = data.csrfToken || csrfToken()
  } catch {
    token = ''
  }
  return token
}
const serializeSocialState = db => {
  const username = id => db.users.find(user => user.id === id)?.username || id
  return {
    posts: db.posts.map(post => ({ ...post, userId: username(post.userId), likes: post.likes.map(username), comments: post.comments.map(comment => ({ ...comment, userId: username(comment.userId) })) })),
    reels: db.reels.map(reel => ({ ...reel, userId: username(reel.userId), likes: reel.likes.map(username) })),
    stories: db.stories.map(story => ({ ...story, userId: username(story.userId) })),
    seenStories: db.seenStories.map(item => ({ ...item, viewerId: username(item.viewerId) })),
    follows: db.follows.map(follow => ({ ...follow, a: username(follow.a), b: username(follow.b) })),
    messages: db.messages.map(message => ({ ...message, from: username(message.from), to: username(message.to), hiddenFor: (message.hiddenFor || []).map(username) })),
    deletedMessages: db.deletedMessages.map(message => ({ ...message, from: username(message.from), to: username(message.to) })),
    notifs: db.notifs.map(notif => ({ ...notif, from: username(notif.from), to: username(notif.to) })),
    saved: Object.fromEntries(Object.entries(db.saved).map(([id, posts]) => [username(id), posts])),
  }
}
const Ctx = createContext(null); const useC = () => useContext(Ctx)
const ago = t => { const s = (Date.now() - t) / 1000; if (s < 60) return 'hozirgina'; if (s < 3600) return `${~~(s / 60)} daqiqa oldin`; if (s < 86400) return `${~~(s / 3600)} soat oldin`; if (s < 604800) return `${~~(s / 86400)} kun oldin`; return new Date(t).toLocaleDateString() }
const hm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const seg = s => [...new Intl.Segmenter().segment(s)].map(x => x.segment)
const readMedia = (file, max = 1000) => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file) })
const readImg = (file, max = 1000) => new Promise(r => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', .82)) }; im.src = fr.result }; fr.readAsDataURL(file) })

const KIDS_BLOCKED_TERMS = [
  'fuck','fucking','shit','bitch','asshole','casino','betting','gambling','drug','drugs','cocaine','heroin',
  'meth','weed','kill','murder','suicide','weapon','gun','bomb','блядь','бля','сука','хуй',
  'пизд','еба','ебать','шлюха','порно','секс','наркот','кокаин','героин','оруж','убий',
  'самоубий','ahmoq','tentak','jalab','siktir'
]
const kidsUnsafeText = value => {
  if (!value) return false
  const normalized = String(value).toLowerCase().replace(/[\W_]+/gu, ' ')
  const compact = normalized.replace(/\s/g, '')
  if (/(https?:\/\/|www\.|t\.me|telegram\.me|wa\.me|discord\.gg)/i.test(String(value))) return true
  return KIDS_BLOCKED_TERMS.some(term => {
    const re = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i')
    return re.test(normalized) || (term.length >= 4 && compact.includes(term))
  })
}
const kidsUnsafeFile = file => {
  if (!file) return 'Fayl tanlanmadi.'
  const allowed = ['image/jpeg','image/png','image/webp','video/mp4','video/webm']
  if (!allowed.includes(file.type)) return 'Faqat JPG, PNG, WEBP, MP4 yoki WEBM fayllar ruxsat etiladi.'
  if (file.size > 25 * 1024 * 1024) return 'Fayl hajmi 25 MB dan oshmasin.'
  if (kidsUnsafeText(file.name)) return 'Bu fayl nomi xavfsizlik filtri tomonidan rad etildi.'
  return ''
}
const kidsUnsafeDataUrl = value => {
  if (!value || typeof value !== 'string') return 'Media fayl noto‘g‘ri.'
  if (!/^data:(image\/jpeg|image\/png|image\/webp|video\/mp4|video\/webm|audio\/webm|audio\/ogg|audio\/mp4|audio\/mpeg|audio\/wav)(?:;[a-z0-9=.+_-]+)*;base64,/i.test(value)) return 'Media turi ruxsat etilmagan.'
  if (value.length > 36 * 1024 * 1024) return 'Media hajmi juda katta.'
  return ''
}
const isKidsHours = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tashkent', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0)
  return hour >= 8 && hour < 22
}
const kidsHoursMessage = 'Platforma 08:00–22:00 oralig‘ida ishlaydi (Toshkent vaqti).'

const EMO = {
  '😀': '😀😃😄😁😆😅🤣😂🙂😉😊😇🥰😍🤩😘😋😜🤪😎🤓🥳😏😒😞😔😕🥺😢😭😤😠😡🤯😳🥵🥶😱😰🤗🤔🤭🤫😶😐🙄😮😴🤤🤢🤧😷',
  '👍': '👍👎👊✊🤞✌️🤟🤘👌🤌👈👉👆👇☝️✋👋🤙💪🙏🤝👏🙌👐🤲',
  '❤️': '❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟😻💌',
  '🌹': '🌹🌸🌼🌻🌺🌷🌱🌴🍀🍁🌈☀️🌙⭐🌟✨⚡🔥💧🌊🐶🐱🐭🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🦄🐝🦋',
  '🍕': '🍎🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥑🍅🌽🍕🍔🍟🌭🍿🥗🍜🍣🍰🎂🍩🍪🍫🍬☕🍵🥤🍺',
  '🎉': '🎉🎊🎁🎈🏆⚽🏀🎮🎧🎵🎶📸💯✅❌⚠️💬👀🚀✈️🚗🏠📱💻',
}
export function AppProvider({ children }) {
  const navigate = useNavigate()
  const dbRef = useRef(load()); const [db, setDb] = useState(dbRef.current); const [meId, setMeId] = useState(() => sessionStorage.getItem(ME))
  const [suggestionSeed] = useState(() => { const next = Number(localStorage.getItem('ig_suggestion_seed') || 0) + 1; localStorage.setItem('ig_suggestion_seed', String(next)); return next })
  const [socialReadyUser, setSocialReadyUser] = useState(null)
  const [view, setView] = useState({ n: 'home' }); const [reelId, setReelId] = useState(null); const [createPost,setCreatePost]=useState(false); const [postId, setPostId] = useState(null); const [create, setCreate] = useState(false); const [createReel, setCreateReel] = useState(false); const [createStory, setCreateStory] = useState(false); const [storyId, setStoryId] = useState(null); const [toast, setToast] = useState(null); const [peer, setPeer] = useState(null)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')
  const [serviceOpen, setServiceOpen] = useState(isKidsHours())
  const [accessInfo, setAccessInfo] = useState({ open: isKidsHours(), reason: isKidsHours() ? 'open' : 'hours', start: '08:00', end: '22:00', usageLimitMinutes: 30, cooldownMinutes: 10, usageRemainingSeconds: 1800, cooldownSeconds: 0, restriction: { active: false, until: null, remainingSeconds: 0 } })
  const [callSession, setCallSession] = useState(null)
  const [callLocalStream, setCallLocalStream] = useState(null)
  const [callRemoteStream, setCallRemoteStream] = useState(null)
  const [presenceByUser, setPresenceByUser] = useState({})
  const callRef = useRef(null)
  const callPeerConnectionRef = useRef(null)
  const callLocalStreamRef = useRef(null)
  const pendingCallOfferRef = useRef(null)
  const pendingCallIceRef = useRef([])
  const callSignalHandlerRef = useRef(null)
  const updateCall = next => { callRef.current = next; setCallSession(next) }
  const postCallSignal = async (session, action, payload = {}) => {
    const target = dbRef.current.users.find(user => user.id === session.peerId)
    if (!target) throw new Error('Foydalanuvchi topilmadi.')
    const token = await ensureCsrfToken()
    const response = await fetch('/plat/calls/signals/', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
      body: JSON.stringify({ callId: session.id, to: target.username, action, payload }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Qo‘ng‘iroq signali yuborilmadi.')
  }
  const closeCall = () => {
    callPeerConnectionRef.current?.close()
    callPeerConnectionRef.current = null
    callLocalStreamRef.current?.getTracks().forEach(track => track.stop())
    callLocalStreamRef.current = null
    pendingCallOfferRef.current = null
    pendingCallIceRef.current = []
    setCallLocalStream(null)
    setCallRemoteStream(null)
    updateCall(null)
  }
  const createCallPeerConnection = session => {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    callPeerConnectionRef.current = connection
    callLocalStreamRef.current?.getTracks().forEach(track => connection.addTrack(track, callLocalStreamRef.current))
    connection.onicecandidate = event => {
      if (event.candidate) postCallSignal(session, 'candidate', event.candidate.toJSON()).catch(() => {})
    }
    connection.ontrack = event => {
      setCallRemoteStream(event.streams[0])
      const current = callRef.current
      if (current?.id === session.id) updateCall({ ...current, status: 'connected', connectedAt: current.connectedAt || Date.now() })
    }
    connection.onconnectionstatechange = () => {
      const current = callRef.current
      if (current?.id !== session.id) return
      if (connection.connectionState === 'connected') updateCall({ ...current, status: 'connected', connectedAt: current.connectedAt || Date.now() })
      if (connection.connectionState === 'disconnected') updateCall({ ...current, status: 'reconnecting' })
      if (connection.connectionState === 'failed') updateCall({ ...current, status: 'failed' })
    }
    return connection
  }
  const addPendingCallIce = async connection => {
    const candidates = pendingCallIceRef.current.splice(0)
    for (const candidate of candidates) {
      try { await connection.addIceCandidate(new RTCIceCandidate(candidate)) } catch { }
    }
  }
  const answerCallOffer = async (session, description) => {
    const connection = callPeerConnectionRef.current || createCallPeerConnection(session)
    await connection.setRemoteDescription(new RTCSessionDescription(description))
    await addPendingCallIce(connection)
    const answer = await connection.createAnswer()
    await connection.setLocalDescription(answer)
    await postCallSignal(session, 'answer', { description: connection.localDescription.toJSON() })
  }
  const acceptCall = async () => {
    const session = callRef.current
    if (!session || session.direction !== 'incoming' || session.status !== 'ringing') return false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: session.mode === 'video' })
      callLocalStreamRef.current = stream
      setCallLocalStream(stream)
      updateCall({ ...session, status: 'connecting', muted: false, cameraOff: false })
      createCallPeerConnection(session)
      await postCallSignal(session, 'accept')
      if (pendingCallOfferRef.current) {
        const offer = pendingCallOfferRef.current
        pendingCallOfferRef.current = null
        await answerCallOffer(session, offer)
      }
      return true
    } catch (error) {
      await postCallSignal(session, 'reject', { reason: 'media-unavailable' }).catch(() => {})
      closeCall()
      say(error.name === 'NotAllowedError' ? 'Mikrofon yoki kameraga ruxsat bering.' : 'Qo‘ng‘iroqni qabul qilib bo‘lmadi.')
      return false
    }
  }
  const processCallSignal = async signal => {
    const peerId = dbRef.current.users.find(user => user.username === signal.from)?.id
    if (!peerId) return
    if (signal.action === 'invite') {
      if (callRef.current) {
        await postCallSignal({ id: signal.callId, peerId }, 'reject', { reason: 'busy' }).catch(() => {})
        return
      }
      updateCall({ id: signal.callId, peerId, mode: signal.payload.mode, direction: 'incoming', status: 'ringing', startedAt: Date.now() })
      return
    }
    const current = callRef.current
    if (!current || current.id !== signal.callId || current.peerId !== peerId) return
    if (signal.action === 'accept') {
      updateCall({ ...current, status: 'connecting' })
    } else if (signal.action === 'offer') {
      const description = signal.payload.description
      if (current.direction === 'incoming' && current.status === 'ringing') pendingCallOfferRef.current = description
      else if (description && callLocalStreamRef.current) await answerCallOffer(current, description)
    } else if (signal.action === 'answer') {
      const connection = callPeerConnectionRef.current
      if (connection && signal.payload.description) {
        await connection.setRemoteDescription(new RTCSessionDescription(signal.payload.description))
        await addPendingCallIce(connection)
      }
    } else if (signal.action === 'candidate' && signal.payload) {
      const connection = callPeerConnectionRef.current
      if (connection?.remoteDescription) {
        try { await connection.addIceCandidate(new RTCIceCandidate(signal.payload)) } catch { }
      } else {
        pendingCallIceRef.current.push(signal.payload)
      }
    } else if (signal.action === 'reject' || signal.action === 'end') {
      closeCall()
      say(signal.action === 'reject' ? 'Qo‘ng‘iroq rad etildi.' : 'Qo‘ng‘iroq tugadi.')
    }
  }
  callSignalHandlerRef.current = processCallSignal
  useEffect(() => {
    let active = true
    const checkAccess = async () => {
      if (document.hidden && meId) return
      try {
        const response = await fetch('/plat/access/', { credentials: 'same-origin' })
        const data = await response.json()
        if (!active) return
        setAccessInfo(data)
        setServiceOpen(Boolean(data.open))
        if (meId && !data.open) {
          fetch('/plat/logout/', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken() } }).catch(() => {})
          sessionStorage.removeItem(ME)
          setMeId(null)
          setSocialReadyUser(null)
        }
      } catch {
        if (active) {
          const fallback = { ...accessInfo, open: isKidsHours(), reason: isKidsHours() ? 'open' : 'hours' }
          setAccessInfo(fallback)
          setServiceOpen(fallback.open)
        }
      }
    }
    checkAccess()
    const timer = setInterval(checkAccess, 30000)
    return () => { active = false; clearInterval(timer) }
  }, [meId])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { const f = e => { if (e.key === KEY) { dbRef.current = load(); setDb(dbRef.current) } }; addEventListener('storage', f); return () => removeEventListener('storage', f) }, [])
  const say = m => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(null), 2600) }
  const save = fn => {
    if (meId && !serviceOpen) { say(accessInfo.reason === 'cooldown' ? `Tanaffus: ${Math.ceil((accessInfo.cooldownSeconds || accessInfo.cooldownMinutes * 60) / 60)} daqiqa.` : `Platforma yopiq: ${accessInfo.start || '08:00'}–${accessInfo.end || '22:00'}.`); return false }
    const n = structuredClone(dbRef.current); fn(n); dbRef.current = n
    try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { say('Xotira to‘ldi — kichikroq rasm tanlang'); return false }
    setDb(n); return true
  }
  useEffect(() => {
    let active = true
    const syncFromServer = async () => {
      try {
        const accountsResponse = await fetch('/plat/users/')
        if (!accountsResponse.ok) throw new Error('Userlarni yuklab bo‘lmadi')
        const accounts = await accountsResponse.json()
        if (!active) return
        save(d => {
          const accountNames = new Set(accounts.map(account => account.username))
          d.users = d.users.filter(user => !String(user.id).startsWith('server-') || accountNames.has(user.username))
          accounts.forEach(account => {
            const existing = d.users.find(user => user.username === account.username)
            if (existing) { existing.name = account.name || existing.name; existing.email = account.email || existing.email || '' }
            else d.users.push({ id: `server-${account.id}`, username: account.username, email: account.email || '', name: account.name, bio: '', avatar: null, t: Date.now() })
          })
        })
        if (!meId) return

        const stateResponse = await fetch('/plat/social/')
        if (!stateResponse.ok) throw new Error('Ma’lumotlarni yuklab bo‘lmadi')
        const remote = await stateResponse.json()
        if (!active) return
        const localId = username => dbRef.current.users.find(user => user.username === username)?.id || username
        const restored = {
          posts: remote.posts.map(post => ({ ...post, userId: localId(post.userId), likes: post.likes.map(localId), comments: post.comments.map(comment => ({ ...comment, userId: localId(comment.userId) })) })),
          reels: remote.reels.map(reel => ({ ...reel, userId: localId(reel.userId), likes: reel.likes.map(localId) })),
          stories: remote.stories.map(story => ({ ...story, userId: localId(story.userId) })),
          seenStories: remote.seenStories.map(item => ({ ...item, viewerId: localId(item.viewerId) })),
          follows: remote.follows.map(follow => ({ ...follow, a: localId(follow.a), b: localId(follow.b) })),
          messages: remote.messages.map(message => ({ ...message, from: localId(message.from), to: localId(message.to), hiddenFor: (message.hiddenFor || []).map(localId) })),
          deletedMessages: remote.deletedMessages.map(message => ({ ...message, from: localId(message.from), to: localId(message.to) })),
          hiddenChats: remote.hiddenChats.map(chat => ({ ...chat, owner: localId(chat.owner), peer: localId(chat.peer) })),
          blockedUsers: remote.blockedUsers.map(localId),
          blockedByUsers: remote.blockedByUsers.map(localId),
          notifs: remote.notifs.map(notif => ({ ...notif, from: localId(notif.from), to: localId(notif.to) })),
          saved: Object.fromEntries(Object.entries(remote.saved).map(([username, posts]) => [localId(username), posts])),
        }
        const serverMessageIds = new Set(restored.messages.map(message => String(message.id)))
        const deletedMessageIds = new Set(restored.deletedMessages.map(message => String(message.id)))
        const hiddenCutoffs = new Map(restored.hiddenChats.map(chat => [chat.peer, chat.cutoff]))
        const hiddenChatMessageIds = new Set(restored.hiddenChats.flatMap(chat => chat.messageIds || []).map(String))
        const unsyncedLocalMessages = dbRef.current.messages.filter(message => {
          if (message.from !== meId && message.to !== meId) return false
          if (serverMessageIds.has(String(message.id)) || deletedMessageIds.has(String(message.id)) || hiddenChatMessageIds.has(String(message.id))) return false
          const peerId = message.from === meId ? message.to : message.from
          return message.t > (hiddenCutoffs.get(peerId) || 0)
        })
        restored.messages = [...restored.messages, ...unsyncedLocalMessages]
        save(d => {
          Object.assign(d, restored)
        })
        setSocialReadyUser(meId)
      } catch {
        if (active && meId) say('Server bilan sinxronlash amalga oshmadi')
      }
    }
    syncFromServer()
    return () => { active = false }
  }, [meId])
  const me = db.users.find(u => u.id === meId); const byId = id => db.users.find(u => u.id === id)
  useEffect(() => {
    if (!me || socialReadyUser !== meId) return
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch('/plat/social/', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
          body: JSON.stringify(serializeSocialState(dbRef.current)),
        })
        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem(ME); setMeId(null)
        } else if (!response.ok) {
          throw new Error('Sinxronlash amalga oshmadi')
        } else {
          const result = await response.json()
          if (result.moderation?.length || result.blockedMessages?.length) {
            const next = structuredClone(dbRef.current)
            const fields = { post: 'posts', reel: 'reels', story: 'stories', message: 'messages' }
            result.moderation.forEach(item => {
              const field = fields[item.type]
              if (field) next[field] = next[field].filter(content => String(content.id) !== String(item.id))
            })
            const blockedIds = new Set((result.blockedMessages || []).map(String))
            next.messages = next.messages.filter(message => !blockedIds.has(String(message.id)))
            dbRef.current = next
            localStorage.setItem(KEY, JSON.stringify(next))
            setDb(next)
            say(result.moderation?.length ? 'Kontent admin tekshiruviga yuborildi.' : 'Bu foydalanuvchi xabarlarni bloklagan.')
          }
        }
      } catch {
        say('Server bilan sinxronlash amalga oshmadi')
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [db, meId, socialReadyUser])
  const unreadN = me ? db.notifs.filter(n => n.to === me.id && !n.read).length : 0
  const unreadM = me ? db.messages.filter(m => m.to === me.id && !m.read).length : 0
  const prevN = useRef(0)
  useEffect(() => { if (me && unreadN > prevN.current) { const n = db.notifs.find(x => x.to === me.id && !x.read), u = n && byId(n.from); if (u) say(`${u.username} ${n.type === 'follow' ? 'sizni follow qilishni boshladi' : n.type === 'like' ? 'postingizni yoqtirdi' : 'izoh qoldirdi'}`) } prevN.current = unreadN }, [unreadN])
  const notify = (d, to, type, x = {}) => { if (to !== meId) d.notifs.unshift({ id: uid(), to, from: meId, type, t: Date.now(), read: false, ...x }) }
  const blockRestrictedAction = () => {
    const restriction = accessInfo.restriction
    if (!restriction?.active) return false
    const until = restriction.until ? new Date(restriction.until).toLocaleString('uz-UZ') : ''
    say(`Admin cheklovi faol${until ? `: ${until} gacha` : ''}. Xabar, like va follow vaqtincha yopiq.`)
    return true
  }
  const startCall = async (peerId, mode) => {
    if (callRef.current) { say('Boshqa qo‘ng‘iroq davom etmoqda.'); return false }
    if (dbRef.current.blockedUsers.includes(peerId) || dbRef.current.blockedByUsers.includes(peerId)) {
      say('Bloklangan foydalanuvchiga qo‘ng‘iroq qilib bo‘lmaydi.')
      return false
    }
    const session = { id: crypto.randomUUID(), peerId, mode, direction: 'outgoing', status: 'calling', startedAt: Date.now(), muted: false, cameraOff: false }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' })
      callLocalStreamRef.current = stream
      setCallLocalStream(stream)
      updateCall(session)
      const connection = createCallPeerConnection(session)
      await postCallSignal(session, 'invite', { mode })
      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      await postCallSignal(session, 'offer', { description: connection.localDescription.toJSON() })
      return true
    } catch (error) {
      closeCall()
      say(error.name === 'NotAllowedError'
        ? 'Qo‘ng‘iroq uchun mikrofon yoki kameraga ruxsat bering.'
        : error.message || 'Qo‘ng‘iroqni boshlab bo‘lmadi.')
      return false
    }
  }
  const endCall = async () => {
    const session = callRef.current
    if (!session) return
    await postCallSignal(session, 'end').catch(() => {})
    closeCall()
  }
  const rejectCall = async () => {
    const session = callRef.current
    if (!session) return
    await postCallSignal(session, 'reject').catch(() => {})
    closeCall()
  }
  const toggleCallMute = () => {
    const session = callRef.current
    if (!session) return
    const muted = !session.muted
    callLocalStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !muted })
    updateCall({ ...session, muted })
  }
  const toggleCallCamera = () => {
    const session = callRef.current
    if (!session) return
    const cameraOff = !session.cameraOff
    callLocalStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !cameraOff })
    updateCall({ ...session, cameraOff })
  }
  const A = {
    toast: say,
    validateRegister: ({ username, email, name, password }) => { if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'To‘g‘ri email manzil kiriting'; if (username.length < 3) return 'Username kamida 3 ta belgi'; if (!name.trim()) return 'Ismingizni kiriting'; if (password.length < 4) return 'Parol kamida 4 ta belgi'; if (dbRef.current.users.some(u => u.username === username)) return 'Bu username band' },
    register: ({ username, email, name }, account) => {
      const existing = dbRef.current.users.find(user => user.username === username)
      const id = existing?.id || `server-${account.id}`
      save(d => {
        const user = d.users.find(item => item.username === username)
        if (user) Object.assign(user, { name: name.trim(), email: email.trim() })
        else d.users.push({ id, username, email: email.trim(), name: name.trim(), bio: '', avatar: null, t: Date.now() })
      })
      sessionStorage.setItem(ME, id); setMeId(id)
    },
    login: ({ username }, account) => {
      const existing = dbRef.current.users.find(user => user.username === username)
      const id = existing?.id || `server-${account.id}`
      save(d => {
        const user = d.users.find(item => item.username === username)
        if (user) { user.name = account.name || user.name; user.email = account.email || user.email || '' }
        else d.users.push({ id, username, email: account.email || '', name: account.name, bio: '', avatar: null, t: Date.now() })
      })
      sessionStorage.setItem(ME, id); setMeId(id); navigate('/')
    },
    logout: () => {
      fetch('/plat/logout/', { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } }).catch(() => {})
      sessionStorage.removeItem(ME); setMeId(null); setSocialReadyUser(null)
    },
    toggleTheme: () => setDark(value => !value),
    updateAccessInfo: value => { setAccessInfo(current => ({ ...current, ...value })); if (typeof value.open === 'boolean') setServiceOpen(value.open) },
    follow: id => { if (blockRestrictedAction()) return false; const had = dbRef.current.follows.some(f => f.a === meId && f.b === id), u = byId(id); save(d => { if (had) d.follows = d.follows.filter(f => !(f.a === meId && f.b === id)); else { d.follows.push({ a: meId, b: id }); notify(d, id, 'follow') } }); say(had ? `${u.username} follow’dan chiqarildi` : `Siz ${u.username} ni follow qilishni boshladingiz ✓`) },
    like: (id, kind='post') => { if (blockRestrictedAction()) return false; return save(d => {
      const arr = kind === 'reel' ? d.reels : kind === 'story' ? d.stories : d.posts
      const item = arr.find(x => x.id === id); if (!item) return
      item.likes ||= []
      if (item.likes.includes(meId)) item.likes = item.likes.filter(x => x !== meId)
      else {
        item.likes.push(meId)
        notify(d, item.userId, kind === 'story' ? 'story_like' : 'like', kind === 'story' ? { storyId: id } : { postId: id })
      }
    }) },
    comment: (id, text) => {
      if (blockRestrictedAction()) return false
      if (kidsUnsafeText(text)) { say('Haqoratli yoki 7+ ga mos bo‘lmagan izoh yuborilmadi.'); return false }
      return save(d => { const p = d.posts.find(x => x.id === id); if (!p) return; p.comments.push({ id: uid(), userId: meId, text, t: Date.now() }); notify(d, p.userId, 'comment', { postId: id, text }) })
    },
    save: id => save(d => { const s = d.saved[meId] || []; d.saved[meId] = s.includes(id) ? s.filter(x => x !== id) : [...s, id] }),
    post: (image, caption) => {
      if (blockRestrictedAction()) return false
      const mediaError = kidsUnsafeDataUrl(image)
      if (mediaError || kidsUnsafeText(caption)) { say(mediaError || 'Caption 7+ xavfsizlik filtri tomonidan rad etildi.'); return false }
      const ok = save(d => { d.posts.unshift({ id: uid(), userId: meId, image, caption, t: Date.now(), likes: [], comments: [] }) })
      if (ok) { say('Post ulashildi ✓'); navigate(`/profile/${meId}`) }
      return ok
    },
    reel: (media, caption) => { if (blockRestrictedAction()) return false; save(d => { d.reels.unshift({ id: uid(), userId: meId, media, type:'video', caption, t: Date.now(), likes: [] }) }); say('Reels ulashildi ✓'); navigate('/reels') },
    story: (media, type='image', caption='', sourceReel=false) => {
      if (blockRestrictedAction()) return false
      const mediaError = kidsUnsafeDataUrl(media)
      if (mediaError || kidsUnsafeText(caption)) { say(mediaError || 'Story matni 7+ xavfsizlik filtri tomonidan rad etildi.'); return false }
      const ok = save(d => { d.stories = d.stories.filter(s => !(s.userId===meId && s.t < Date.now()-864e5)); d.stories.push({ id:uid(), userId:meId, media, type, caption, sourceReel, likes: [], t:Date.now() }) })
      if (ok) say('Story qo‘shildi ✓')
      return ok
    },
    viewStory: id => { if (dbRef.current.seenStories.some(item => item.viewerId === meId && item.storyId === id)) return; save(d => { d.seenStories.push({ viewerId: meId, storyId: id, t: Date.now() }) }) },
    refreshStoryViews: async () => {
      try {
        const response = await fetch('/plat/social/')
        if (!response.ok) return
        const remote = await response.json()
        const localId = username => dbRef.current.users.find(user => user.username === username)?.id || username
        const remoteViews = remote.seenStories.map(item => ({ ...item, viewerId: localId(item.viewerId) }))
        save(d => {
          const views = new Map(d.seenStories.map(item => [`${item.storyId}:${item.viewerId}`, item]))
          remoteViews.forEach(item => views.set(`${item.storyId}:${item.viewerId}`, item))
          d.seenStories = [...views.values()]
        })
      } catch { }
    },
    addSearch: id => save(d => { d.searchHistory = [...d.searchHistory.filter(item => item !== id), id].slice(-12) }),
    removeSearch: id => save(d => { d.searchHistory = d.searchHistory.filter(item => item !== id) }),
    clearSearchHistory: () => save(d => { d.searchHistory = [] }),
    del: id => { save(d => { d.posts = d.posts.filter(p => p.id !== id) }); say('Post o‘chirildi') },
    send: (to, x) => {
      if (blockRestrictedAction()) return false
      if (dbRef.current.blockedUsers.includes(to) || dbRef.current.blockedByUsers.includes(to)) { say('Bu suhbatda xabar yuborib bo‘lmaydi.'); return false }
      if (kidsUnsafeText(x?.text)) { say('Haqoratli yoki 7+ ga mos bo‘lmagan xabar yuborilmadi.'); return false }
      if (x?.src) { const mediaError = kidsUnsafeDataUrl(x.src); if (mediaError) { say(mediaError); return false } }
      return save(d => { d.messages.push({ id: uid(), from: meId, to, t: Date.now(), read: false, ...x }) })
    },
    editMessage: (id, text) => {
      if (blockRestrictedAction()) return false
      if (kidsUnsafeText(text)) { say('Haqoratli yoki 7+ ga mos bo‘lmagan xabar yuborilmadi.'); return false }
      const message = dbRef.current.messages.find(item => item.id === id)
      if (!message || message.from !== meId || !text.trim()) return
      save(d => { const item = d.messages.find(value => value.id === id); item.text = text.trim(); item.edited = true })
    },
    deleteMessage: (id, everyone = false) => {
      const message = dbRef.current.messages.find(item => item.id === id)
      if (!message || (everyone && message.from !== meId)) return
      save(d => {
        if (everyone) {
          if (!d.deletedMessages.some(item => item.id === id)) d.deletedMessages.push({ id, from: message.from, to: message.to })
        } else {
          const item = d.messages.find(value => value.id === id)
          item.hiddenFor ||= []
          if (!item.hiddenFor.includes(meId)) item.hiddenFor.push(meId)
        }
      })
    },
    refreshMessages: async () => {
      try {
        const response = await fetch('/plat/social/')
        if (!response.ok) return
        const remote = await response.json()
        const localId = username => dbRef.current.users.find(user => user.username === username)?.id || username
        const current = dbRef.current.messages
        const currentById = new Map(current.map(message => [String(message.id), message]))
        const remoteById = new Map(remote.messages.map(message => [String(message.id), message]))
        const incoming = remote.messages.map(message => {
          const restored = { ...message, from: localId(message.from), to: localId(message.to), hiddenFor: (message.hiddenFor || []).map(localId) }
          const local = currentById.get(String(restored.id))
          return local?.to === meId && local.read && !restored.read ? { ...restored, read: true } : restored
        })
        const deleted = remote.deletedMessages.map(message => ({ ...message, from: localId(message.from), to: localId(message.to) }))
        const hiddenChats = remote.hiddenChats.map(chat => ({ ...chat, owner: localId(chat.owner), peer: localId(chat.peer) }))
        const blockedUsers = remote.blockedUsers.map(localId)
        const blockedByUsers = remote.blockedByUsers.map(localId)
        const changed = incoming.some(message => {
          const old = currentById.get(String(message.id))
          return !old || old.read !== message.read || old.text !== message.text || old.src !== message.src || old.edited !== message.edited || JSON.stringify(old.hiddenFor || []) !== JSON.stringify(message.hiddenFor || [])
        })
        const pendingReadSync = current.some(message => {
          const remoteMessage = remoteById.get(String(message.id))
          return message.to === meId && message.read && remoteMessage && !remoteMessage.read
        })
        if (!changed && JSON.stringify(dbRef.current.deletedMessages) === JSON.stringify(deleted)
          && JSON.stringify(dbRef.current.hiddenChats) === JSON.stringify(hiddenChats)
          && JSON.stringify(dbRef.current.blockedUsers) === JSON.stringify(blockedUsers)
          && JSON.stringify(dbRef.current.blockedByUsers) === JSON.stringify(blockedByUsers)
          && !pendingReadSync) return
        save(d => {
          const messages = new Map(d.messages.map(message => [message.id, message]))
          incoming.forEach(message => messages.set(message.id, message))
          d.messages = [...messages.values()]
          d.deletedMessages = deleted
          d.hiddenChats = hiddenChats
          d.blockedUsers = blockedUsers
          d.blockedByUsers = blockedByUsers
        })
      } catch { }
    },
    deleteChat: async peerId => {
      const target = dbRef.current.users.find(user => user.id === peerId)
      if (!target) return false
      try {
        const token = await ensureCsrfToken()
        const response = await fetch(`/plat/chats/${encodeURIComponent(target.username)}/`, {
          method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRFToken': token },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Chatni o‘chirib bo‘lmadi')
        save(d => {
          const hiddenMessageIds = new Set((result.hiddenMessageIds || []).map(String))
          d.hiddenChats = [...d.hiddenChats.filter(chat => !(chat.owner === meId && chat.peer === peerId)), { owner: meId, peer: peerId, cutoff: result.cutoff, messageIds: [...hiddenMessageIds] }]
          d.messages = d.messages.filter(message => {
            const matchesChat = (message.from === meId && message.to === peerId) || (message.from === peerId && message.to === meId)
            return !matchesChat || (!hiddenMessageIds.has(String(message.id)) && message.t > result.cutoff)
          })
        })
        say('Chat o‘chirildi')
        return true
      } catch (error) {
        say(error.message || 'Chatni o‘chirib bo‘lmadi')
        return false
      }
    },
    setUserBlocked: async (peerId, shouldBlock) => {
      const target = dbRef.current.users.find(user => user.id === peerId)
      if (!target) return false
      try {
        const token = await ensureCsrfToken()
        const response = await fetch(`/plat/users/${encodeURIComponent(target.username)}/block/`, {
          method: shouldBlock ? 'POST' : 'DELETE', credentials: 'same-origin', headers: { 'X-CSRFToken': token },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Blok sozlamasini saqlab bo‘lmadi')
        save(d => {
          if (shouldBlock) {
            d.follows = d.follows.filter(follow => !(
              (follow.a === meId && follow.b === peerId) ||
              (follow.a === peerId && follow.b === meId)
            ))
          }
          d.blockedUsers = shouldBlock
            ? [...new Set([...d.blockedUsers, peerId])]
            : d.blockedUsers.filter(id => id !== peerId)
        })
        say(shouldBlock ? `${target.username} bloklandi` : `${target.username} blokdan chiqarildi`)
        return true
      } catch (error) {
        say(error.message || 'Blok sozlamasini saqlab bo‘lmadi')
        return false
      }
    },
    reportReel: async (id, reason, details) => {
      try {
        const token = await ensureCsrfToken()
        const response = await fetch(`/plat/reels/${encodeURIComponent(id)}/report/`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
          body: JSON.stringify({ reason, details }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Shikoyat yuborilmadi')
        say('Shikoyat adminga yuborildi')
        return true
      } catch (error) {
        say(error.message || 'Shikoyat yuborilmadi')
        return false
      }
    },
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleCallMute,
    toggleCallCamera,
    readMsgs: from => save(d => { d.messages.forEach(m => { if (m.from === from && m.to === meId) m.read = true }) }),
    readNotifs: () => { if (dbRef.current.notifs.some(n => n.to === meId && !n.read)) save(d => { d.notifs.forEach(n => { if (n.to === meId) n.read = true }) }) },
    deleteAccount: async () => {
      try {
        const response = await fetch('/plat/delete-account/', { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken() } })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) { say(result.error || 'Akkauntni o‘chirib bo‘lmadi'); return false }
        localStorage.removeItem(KEY); sessionStorage.removeItem(ME); setMeId(null); setSocialReadyUser(null); dbRef.current = load(); setDb(dbRef.current); navigate('/'); return true
      } catch { say('Server bilan bog‘lanib bo‘lmadi'); return false }
    },
    deleteUser: async userId => {
      const target = dbRef.current.users.find(user => user.id === userId)
      if (!target) return false
      try {
        const response = await fetch(`/plat/users/${encodeURIComponent(target.username)}/delete/`, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRFToken': csrfToken() } })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) { say(result.error || 'Foydalanuvchini o‘chirib bo‘lmadi'); return false }
        save(d => {
          d.users = d.users.filter(user => user.id !== userId)
          d.posts = d.posts.filter(item => item.userId !== userId)
          d.reels = d.reels.filter(item => item.userId !== userId)
          d.stories = d.stories.filter(item => item.userId !== userId)
          d.follows = d.follows.filter(item => item.a !== userId && item.b !== userId)
          d.messages = d.messages.filter(item => item.from !== userId && item.to !== userId)
          d.notifs = d.notifs.filter(item => item.from !== userId && item.to !== userId)
        })
        say(`${target.username} o‘chirildi ✓`); return true
      } catch { say('Server bilan bog‘lanib bo‘lmadi'); return false }
    },
    edit: f => { if (f.username.length < 3) return 'Username kamida 3 ta belgi'; if (db.users.some(u => u.username === f.username && u.id !== meId)) return 'Bu username band'; save(d => { Object.assign(d.users.find(u => u.id === meId), { name: f.name, username: f.username, bio: f.bio, avatar: f.avatar }) }); say('Profil saqlandi ✓') },
  }
  useEffect(() => {
    if (!me || socialReadyUser !== meId) return
    const timer = setInterval(() => A.refreshMessages(), 3000)
    return () => clearInterval(timer)
  }, [meId, socialReadyUser])
  useEffect(() => {
    if (!meId) return
    let active = true
    let timer
    const pollCallSignals = async () => {
      try {
        if (!document.hidden) {
          const response = await fetch('/plat/calls/signals/', { credentials: 'same-origin' })
          if (response.ok) {
            const signals = await response.json()
            for (const signal of signals) await callSignalHandlerRef.current?.(signal)
          }
        }
      } catch { }
      if (active) timer = setTimeout(pollCallSignals, 1000)
    }
    pollCallSignals()
    return () => { active = false; clearTimeout(timer) }
  }, [meId])
  useEffect(() => {
    if (!meId) { setPresenceByUser({}); return }
    let active = true
    let timer
    const refreshPresence = async () => {
      try {
        if (!document.hidden) {
          const response = await fetch('/plat/presence/', { credentials: 'same-origin' })
          if (response.ok) {
            const data = await response.json()
            const presence = Object.fromEntries(data.users.map(item => {
              const id = dbRef.current.users.find(user => user.username === item.username)?.id || item.username
              return [id, { online: item.online, lastSeen: item.lastSeen }]
            }))
            if (active) setPresenceByUser(current => JSON.stringify(current) === JSON.stringify(presence) ? current : presence)
          }
        }
      } catch { }
      if (active) timer = setTimeout(refreshPresence, 15000)
    }
    refreshPresence()
    return () => { active = false; clearTimeout(timer) }
  }, [meId])
  const feed = db.posts
    .filter(p => p.userId === me?.id || db.follows.some(f => f.a === me?.id && f.b === p.userId))
    .sort((a, b) => b.t - a.t)
  const suggestionPool = db.users.filter(u => u.id !== me?.id && !db.follows.some(f => f.a === me?.id && f.b === u.id))
  const suggestionOffset = suggestionPool.length ? suggestionSeed % suggestionPool.length : 0
  const suggestions = [...suggestionPool.slice(suggestionOffset), ...suggestionPool.slice(0, suggestionOffset)].slice(0, 6)

  const open = {
    profile: id => { setPostId(null); setReelId(null); navigate(`/profile/${id}`) },
    post: setPostId,
    reel: id => { setReelId(id); navigate('/reels') },
    story: id => setStoryId(id),
    create: () => setCreate(true),
    createStory: () => setCreateStory(true),
  }

  return <Ctx.Provider value={{ db, me, byId, A, open, feed, suggestions, dark, reelId, serviceOpen, accessInfo, toast, unreadN, unreadM, peer, setPeer, callSession, callLocalStream, callRemoteStream, presenceByUser, createPost, setCreatePost, postId, setPostId, create, setCreate, createReel, setCreateReel, createStory, setCreateStory, storyId, setStoryId }}>{children}</Ctx.Provider>
}

export { Ctx, useC, load, uid, csrfToken, ensureCsrfToken, serializeSocialState, ago, hm, seg, readMedia, readImg, kidsUnsafeText, kidsUnsafeFile, kidsUnsafeDataUrl, isKidsHours, kidsHoursMessage, EMO }
