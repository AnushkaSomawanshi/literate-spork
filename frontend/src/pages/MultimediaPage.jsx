import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Square, Clock3, Cpu, Play, Radio, RefreshCw, Signal, Video, Wifi, XCircle } from 'lucide-react';

const initialStats = { bitrateKbps: null, fps: null, frames: 0, packetsLost: null, jitterMs: null, rttMs: null, resolution: '—' };
const stamp = () => new Date().toLocaleTimeString();
export default function MultimediaPage() {
  const [state, setState] = useState('DISCONNECTED');
  const [peerState, setPeerState] = useState('new');
  const [iceState, setIceState] = useState('new');
  const [signalingState, setSignalingState] = useState('stable');
  const [stats, setStats] = useState(initialStats);
  const [events, setEvents] = useState([{time:stamp(),level:'info',message:'Demo ready. Start a session to negotiate a real browser WebRTC peer connection.'}]);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('—');
  const [startedAt, setStartedAt] = useState(null);
  const sourceCanvas = useRef(null), remoteVideo = useRef(null), localPeer = useRef(null), remotePeer = useRef(null), streamRef = useRef(null), statsTimer = useRef(null), previousStats = useRef(null), activeRef = useRef(false);

  const log = useCallback((message, level='info') => setEvents(prev => [{time:stamp(),level,message},...prev].slice(0,30)), []);
  useEffect(() => {
    let raf, angle=0;
    const canvas=sourceCanvas.current, ctx=canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const draw=()=>{
      angle+=0.006;
      const w=canvas.width,h=canvas.height;
      ctx.fillStyle='#020817';ctx.fillRect(0,0,w,h);
      const glow=ctx.createRadialGradient(w*.5,h*1.35,10,w*.5,h*1.05,w*.85);
      glow.addColorStop(0,'#1a8bb7');glow.addColorStop(.42,'#07517e');glow.addColorStop(1,'#020817');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(w*.5,h*1.34,w*.84,Math.PI,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(65,219,255,.85)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(w*.5,h*1.34,w*.84,w*.84*.18,0,Math.PI,Math.PI*2);ctx.stroke();
      ctx.save();ctx.beginPath();ctx.ellipse(w*.5,h*1.34,w*.82,w*.82*.18,0,Math.PI,Math.PI*2);ctx.clip();
      for(let i=0;i<16;i++){const x=((i*113+angle*70)%(w+160))-80,y=h*.77+(i%5)*17;ctx.fillStyle=i%3?'rgba(74,202,167,.18)':'rgba(214,240,255,.25)';ctx.beginPath();ctx.ellipse(x,y,28+(i%4)*14,4+(i%3)*3,Math.sin(i)*.3,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      ctx.strokeStyle='rgba(69,218,244,.35)';ctx.lineWidth=1;ctx.setLineDash([5,7]);ctx.strokeRect(20,20,w-40,h-40);ctx.setLineDash([]);
      ctx.fillStyle='#70e7f7';ctx.font='bold 15px monospace';ctx.fillText('ORBIT CAM / SAT-02 · SIMULATED SOURCE',34,44);
      ctx.fillStyle='#d1e8f7';ctx.font='12px monospace';ctx.fillText('WEBRTC LOOPBACK DEMONSTRATION',34,64);
      ctx.fillStyle='#8caec4';ctx.fillText(new Date().toISOString(),34,h-28);
      ctx.fillStyle='#51e4bf';ctx.beginPath();ctx.arc(w-42,40,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c7e8f3';ctx.fillText('SOURCE',w-105,44);
      raf=requestAnimationFrame(draw);
    };
    draw();return()=>cancelAnimationFrame(raf);
  },[]);
  const stopSession = useCallback((writeLog=true) => {
    activeRef.current=false;
    if(statsTimer.current)clearInterval(statsTimer.current);statsTimer.current=null;
    if(remoteVideo.current) { remoteVideo.current.pause(); remoteVideo.current.srcObject=null; }
    [localPeer.current,remotePeer.current].forEach(pc=>{if(pc){pc.oniceconnectionstatechange=null;pc.onconnectionstatechange=null;pc.ontrack=null;pc.close();}});
    localPeer.current=null;remotePeer.current=null;
    if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;
    previousStats.current=null;setState('DISCONNECTED');setPeerState('closed');setIceState('closed');setSignalingState('closed');setStats(initialStats);
    if(writeLog)log('Peer connections closed and demo media track released.');
  },[log]);
  useEffect(()=>()=>{activeRef.current=false;if(statsTimer.current)clearInterval(statsTimer.current);[localPeer.current,remotePeer.current].forEach(pc=>pc?.close());streamRef.current?.getTracks().forEach(t=>t.stop());},[]);
  const startSession = async () => {
    if(state==='CONNECTING'||state==='CONNECTED')return;
    setError('');setState('CONNECTING');setStats(initialStats);setStartedAt(Date.now());setSessionId(`RTC-${Date.now().toString(36).toUpperCase()}`);
    log('Session requested. Creating browser-local WebRTC peers.');
    if(!window.RTCPeerConnection || !sourceCanvas.current?.captureStream){setState('FAILED');setError('This browser does not support RTCPeerConnection or canvas captureStream.');log('WebRTC APIs are unavailable in this browser.','error');return;}
    let a,b;
    try{
      const stream=sourceCanvas.current.captureStream(24);streamRef.current=stream;
      a=new RTCPeerConnection({iceServers:[]});b=new RTCPeerConnection({iceServers:[]});localPeer.current=a;remotePeer.current=b;activeRef.current=true;
      a.onicecandidate=e=>{if(e.candidate&&b.signalingState!=='closed')b.addIceCandidate(e.candidate).catch(err=>log(`Remote ICE candidate error: ${err.message}`,'error'));};
      b.onicecandidate=e=>{if(e.candidate&&a.signalingState!=='closed')a.addIceCandidate(e.candidate).catch(err=>log(`Local ICE candidate error: ${err.message}`,'error'));};
      a.oniceconnectionstatechange=()=>{setIceState(a.iceConnectionState);log(`ICE state: ${a.iceConnectionState}`,a.iceConnectionState==='failed'?'error':'info');if(a.iceConnectionState==='failed'||a.iceConnectionState==='disconnected'){setState(a.iceConnectionState==='failed'?'FAILED':'RECONNECTING');}};
      a.onconnectionstatechange=()=>{setPeerState(a.connectionState);if(a.connectionState==='connected'){setState('CONNECTED');log('Peer connection established.');}else if(a.connectionState==='failed'){setState('FAILED');setError('Peer connection failed. Restart the session and check browser WebRTC support.');log('Peer connection failed.','error');}};
      b.ontrack=e=>{if(remoteVideo.current){remoteVideo.current.srcObject=e.streams[0]||new MediaStream([e.track]);remoteVideo.current.play().then(()=>log('Remote media track received; video playback started.')).catch(()=>log('Remote track received; press play if browser blocks autoplay.','warning'));}};
      stream.getTracks().forEach(track=>a.addTrack(track,stream));
      b.ontrack=e=>{if(remoteVideo.current){remoteVideo.current.srcObject=e.streams[0]||new MediaStream([e.track]);remoteVideo.current.play().then(()=>log('Remote video track received through WebRTC.')).catch(()=>log('Remote track received; browser requires a play gesture.','warning'));}};
      a.onicegatheringstatechange=()=>setSignalingState(a.signalingState);
      log('Synthetic orbital camera track captured from canvas.');
      const offer=await a.createOffer();await a.setLocalDescription(offer);await b.setRemoteDescription(offer);log('SDP offer created and applied to receiving peer.');
      const answer=await b.createAnswer();await b.setLocalDescription(answer);await a.setRemoteDescription(answer);log('SDP answer exchanged locally; ICE candidate exchange is active.');
      setSignalingState(a.signalingState);
      // Loopback peers run in the same browser for a repeatable demonstration. No remote satellite or backend signaling is implied.
      statsTimer.current=setInterval(async()=>{
        if(!activeRef.current||!a) return;
        try{const report=await b.getStats();let inbound=null;report.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='video'&&!r.isRemote)inbound=r;});
          if(inbound){const now=performance.now(),bytes=inbound.bytesReceived||0,prev=previousStats.current;const bitrate=prev&&now>prev.time?Math.max(0,Math.round((bytes-prev.bytes)*8/(now-prev.time))):null;previousStats.current={time:now,bytes};setStats({bitrateKbps:bitrate==null?null:bitrate.toFixed(1),fps:inbound.framesPerSecond??null,frames:inbound.framesDecoded??inbound.framesReceived??0,packetsLost:inbound.packetsLost??null,jitterMs:inbound.jitter!=null?(inbound.jitter*1000).toFixed(1):null,rttMs:null,resolution:inbound.frameWidth&&inbound.frameHeight?`${inbound.frameWidth}×${inbound.frameHeight}`:'—'});}
        }catch(e){/* stats may be unavailable while ICE initializes */}
      },1000);
      // Loopback has no external network dependency; report connection only from the actual peer state.
      log('Waiting for ICE connectivity and incoming video frames.');
    }catch(e){setState('FAILED');setError(e?.message||'Unable to establish WebRTC demo session.');log(`Session setup failed: ${e?.message||'unknown error'}`,'error');}
  };
  const duration=startedAt&&state!=='DISCONNECTED'?Math.max(0,Math.floor(((Date.now())-startedAt)/1000)):0;
  return <div className="rtc-console space-y-5">
    <canvas ref={sourceCanvas} width="1280" height="720" className="rtc-source-canvas" aria-hidden="true"/>
    <header className="rtc-page-header"><div><div className="rtc-kicker"><Radio size={13}/> ORBITTRACK / COMMUNICATIONS</div><h2>Satellite Video Downlink</h2><p>WebRTC peer negotiation, simulated SAT-02 camera media, and live browser transport diagnostics.</p></div><div className="rtc-actions"><span className={`rtc-state-pill ${state.toLowerCase()}`}><i/>{state}</span>{state==='CONNECTED'||state==='CONNECTING'||state==='RECONNECTING'?<button className="rtc-button secondary" onClick={()=>stopSession()}><CircleStop size={15}/> Disconnect</button>:<button className="rtc-button primary" onClick={startSession}><Play size={15}/> {state==='FAILED'?'Retry session':'Start WebRTC session'}</button>}</div></header>
    <div className="rtc-demo-notice"><AlertTriangle size={16}/><span><strong>Demonstration mode:</strong> a synthetic orbital-camera scene is transmitted between two real RTCPeerConnection instances in this browser. This proves local WebRTC offer/answer, ICE, media-track delivery, and receiver stats; it is not a remote satellite or external ground-station link.</span></div>
    <div className="rtc-kpis">{[{label:'SIGNALING',value:signalingState},{label:'PEER CONNECTION',value:peerState},{label:'ICE CONNECTIVITY',value:iceState},{label:'SESSION DURATION',value:`${Math.floor(duration/60).toString().padStart(2,'0')}:${(duration%60).toString().padStart(2,'0')}`}].map(k=><div className="rtc-kpi" key={k.label}><span>{k.label}</span><strong>{k.value}</strong></div>)}</div>
    {error&&<div className="rtc-error"><XCircle size={16}/>{error}</div>}
    <div className="rtc-layout"><section className="rtc-panel rtc-video-panel"><div className="rtc-panel-head"><div><span className="rtc-eyebrow"><Video size={13}/> SAT-02 CAMERA SOURCE</span><h3>Orbital camera feed</h3></div><span className={`rtc-media-state ${state==='CONNECTED'?'active':''}`}>{state==='CONNECTED'?'MEDIA SESSION ACTIVE':'AWAITING MEDIA'}</span></div><div className="rtc-video-frame">{state==='CONNECTED'?<video ref={remoteVideo} autoPlay muted playsInline/>:<div className="rtc-video-placeholder"><div className="rtc-placeholder-icon"><Radio size={35}/></div><strong>{state==='CONNECTING'?'Negotiating peer connection':state==='FAILED'?'Session failed':'Camera awaiting connection'}</strong><span>{state==='CONNECTING'?'Creating SDP offer/answer and exchanging ICE candidates.':'Start a session to transmit the synthetic camera track through WebRTC.'}</span></div>}<div className="rtc-video-overlay"><span>SIMULATED SOURCE · SAT-02</span><span>{state==='CONNECTED'?'● RECEIVING':'○ NO REMOTE FRAMES'}</span></div></div><div className="rtc-video-foot"><span><Signal size={14}/> {stats.resolution} resolution</span><span><Activity size={14}/> {stats.fps!=null?`${Number(stats.fps).toFixed(1)} FPS`:'FPS —'}</span><span><Wifi size={14}/> {stats.bitrateKbps!=null?`${stats.bitrateKbps} kbps`:'Bitrate —'}</span></div></section>
    <section className="rtc-panel rtc-peer-panel"><div className="rtc-panel-head"><div><span className="rtc-eyebrow"><Cpu size={13}/> SESSION DIAGNOSTICS</span><h3>WebRTC peer information</h3></div></div><div className="rtc-peer-id"><span>SESSION ID</span><strong>{sessionId}</strong></div><div className="rtc-detail-list">{[{label:'Media source',value:'Canvas captureStream · 24 fps'},{label:'Peer model',value:'Browser-local loopback'},{label:'Signaling',value:signalingState},{label:'ICE gathering',value:localPeer.current?.iceGatheringState||'new'},{label:'Video frames decoded',value:stats.frames},{label:'Packets lost',value:stats.packetsLost??'—'},{label:'Jitter',value:stats.jitterMs!=null?`${stats.jitterMs} ms`:'—'},{label:'Round-trip time',value:stats.rttMs!=null?`${stats.rttMs} ms`:'Not reported by this receiver sample'}].map(x=><div key={x.label}><span>{x.label}</span><strong>{x.value}</strong></div>)}</div><p className="rtc-footnote">Statistics are read from the receiving peer's getStats() report. Unsupported or not-yet-available measurements are shown as unavailable.</p></section></div>
    <section className="rtc-panel rtc-events-panel"><div className="rtc-panel-head"><div><span className="rtc-eyebrow"><Clock3 size={13}/> SESSION TRACE</span><h3>Connection event timeline</h3></div><span className="rtc-event-count">{events.length} recent events</span></div><div className="rtc-event-list">{events.map((e,i)=><div className="rtc-event" key={e.time+i}><i className={e.level}/><time>{e.time}</time><span>{e.message}</span></div>)}</div></section>
    <section className="rtc-panel rtc-flow-panel"><div className="rtc-panel-head"><div><span className="rtc-eyebrow"><Activity size={13}/> PROTOCOL FLOW</span><h3>What the demonstration proves</h3></div></div><div className="rtc-flow">{[{n:'01',title:'Capture',desc:'Synthetic camera canvas → MediaStream track'},{n:'02',title:'Offer / answer',desc:'createOffer → setRemoteDescription → createAnswer'},{n:'03',title:'ICE',desc:'Candidate exchange between the two local peers'},{n:'04',title:'Receive',desc:'Remote ontrack → video element'},{n:'05',title:'Measure',desc:'Receiver getStats() → decoded frames and network counters'}].map(x=><div key={x.n}><span>{x.n}</span><strong>{x.title}</strong><p>{x.desc}</p></div>)}</div></section>
  </div>;
}
