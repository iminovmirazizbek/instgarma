import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import { useC } from '../context/AppContext'
import { Av } from './Shared'

const formatDuration = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

export default function CallOverlay() {
  const { callSession, callLocalStream, callRemoteStream, db, A } = useC()
  const localVideo = useRef(null)
  const remoteVideo = useRef(null)
  const remoteAudio = useRef(null)
  const [duration, setDuration] = useState(0)
  const user = callSession && db.users.find(item => item.id === callSession.peerId)
  const incoming = callSession?.direction === 'incoming' && callSession.status === 'ringing'
  const videoCall = callSession?.mode === 'video'

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = callLocalStream || null
  }, [callLocalStream])

  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = callRemoteStream || null
    if (remoteAudio.current) remoteAudio.current.srcObject = callRemoteStream || null
  }, [callRemoteStream, videoCall])

  useEffect(() => {
    if (callSession?.status !== 'connected') {
      setDuration(0)
      return
    }
    const update = () => setDuration(Math.floor((Date.now() - callSession.connectedAt) / 1000))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [callSession?.status, callSession?.connectedAt])

  if (!callSession) return null
  const statusText = incoming
    ? `${videoCall ? 'Video' : 'Audio'} qo‘ng‘iroq qilmoqda...`
    : callSession.status === 'connected'
      ? formatDuration(duration)
      : callSession.status === 'failed'
        ? 'Aloqa uzildi'
        : callSession.status === 'reconnecting'
          ? 'Qayta ulanmoqda...'
          : 'Chaqirilmoqda...'

  return <div className="fixed inset-0 z-[125] grid place-items-center bg-[#050812]/90 p-3 text-white backdrop-blur-md sm:p-6">
    <section className="relative flex h-[min(88dvh,760px)] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-[#38517b] bg-[#101a30] shadow-[0_28px_100px_rgba(0,0,0,.65)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(38,55,86,.8),transparent_58%)]" />
      {videoCall && callRemoteStream && <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />}
      {!videoCall && <audio ref={remoteAudio} autoPlay />}
      {videoCall && callLocalStream && <video ref={localVideo} autoPlay muted playsInline className="absolute right-4 top-4 z-10 aspect-video w-[min(28vw,190px)] rounded-xl border border-white/20 bg-black object-cover shadow-xl sm:right-6 sm:top-6" />}
      <div className={`relative z-[1] flex flex-1 flex-col items-center justify-center px-5 text-center ${videoCall && callRemoteStream ? 'mt-auto bg-gradient-to-t from-[#070b19] via-[#070b19]/85 to-transparent pb-5 pt-28' : ''}`}>
        {!videoCall || !callRemoteStream ? <Av u={user} s={104} /> : null}
        <h2 className="mt-5 text-xl font-semibold">{user?.name || user?.username || 'Foydalanuvchi'}</h2>
        <p className="mt-2 text-sm text-white/65">{statusText}</p>
        {videoCall && callSession.cameraOff && <p className="mt-2 text-xs text-white/50">Kamera o‘chiq</p>}
      </div>
      <div className="relative z-[2] flex items-center justify-center gap-4 border-t border-white/10 bg-[#090e1d]/75 px-4 py-5 backdrop-blur sm:gap-6 sm:py-6">
        {incoming ? <>
          <button type="button" onClick={A.rejectCall} aria-label="Qo‘ng‘iroqni rad etish" title="Rad etish" className="grid h-14 w-14 place-items-center rounded-full bg-red-600 transition hover:bg-red-500"><PhoneOff size={23} /></button>
          <button type="button" onClick={A.acceptCall} aria-label="Qo‘ng‘iroqqa javob berish" title="Javob berish" className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 transition hover:bg-emerald-400"><Phone size={23} /></button>
        </> : <>
          <button type="button" onClick={A.toggleCallMute} aria-label={callSession.muted ? 'Mikrofonni yoqish' : 'Mikrofonni o‘chirish'} title={callSession.muted ? 'Mikrofonni yoqish' : 'Mikrofonni o‘chirish'} className={`grid h-12 w-12 place-items-center rounded-full transition ${callSession.muted ? 'bg-white text-[#101a30]' : 'bg-white/10 hover:bg-white/20'}`}>{callSession.muted ? <MicOff size={21} /> : <Mic size={21} />}</button>
          {videoCall && <button type="button" onClick={A.toggleCallCamera} aria-label={callSession.cameraOff ? 'Kamerani yoqish' : 'Kamerani o‘chirish'} title={callSession.cameraOff ? 'Kamerani yoqish' : 'Kamerani o‘chirish'} className={`grid h-12 w-12 place-items-center rounded-full transition ${callSession.cameraOff ? 'bg-white text-[#101a30]' : 'bg-white/10 hover:bg-white/20'}`}>{callSession.cameraOff ? <VideoOff size={21} /> : <Video size={21} />}</button>}
          <button type="button" onClick={A.endCall} aria-label="Qo‘ng‘iroqni tugatish" title="Tugatish" className="grid h-14 w-14 place-items-center rounded-full bg-red-600 transition hover:bg-red-500"><PhoneOff size={23} /></button>
        </>}
      </div>
    </section>
  </div>
}
