import { useEffect, useRef, useState } from 'react'
import { Bookmark, Compass, Heart, Home, ImagePlus, KeyRound, LogOut, MessageCircle, Moon, MoreHorizontal, Pencil, PlusSquare, Search, Send, Share2, Smile, Sun, Trash2, User, X, ChevronLeft, Grid3X3, Check, Play, Plus, Users, Volume2, VolumeX, Camera, Settings, Contact } from 'lucide-react'
import { useC, kidsUnsafeFile, kidsUnsafeText, readMedia, readImg, ago, hm, seg, EMO, ensureCsrfToken, csrfToken } from '../context/AppContext'
import { ReelsCard } from '../components/Shared'

function ReelsPage() { const { db, reelId }=useC(); const reels=db.reels.slice().sort((a,b)=>b.t-a.t); if (reelId) { const selected=db.reels.find(r=>r.id===reelId); if(selected) { const rest=reels.filter(r=>r.id!==reelId); reels.splice(0,reels.length,selected,...rest) } } return <div className="reels-page h-[calc(100dvh-56px)] snap-y snap-mandatory overflow-y-auto no-scrollbar md:h-screen">{reels.length ? reels.map(r=><ReelsCard key={r.id} r={r}/>) : <div className="grid h-full place-items-center text-center text-current"><div><Play size={64} className="mx-auto mb-3"/><h2 className="text-xl font-bold">Hali Reels yo‘q</h2><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Birinchi Reels videosini qo‘shing.</p></div></div>}</div> }

export default ReelsPage
