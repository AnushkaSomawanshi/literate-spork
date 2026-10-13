import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDown, ArrowRight, CheckCircle2, ChevronRight,
  CircleDot, Clock3, Download, FileSearch, GitBranch, GitCompare, History,
  Layers3, MessageSquare, Pause, Play, Radio, RefreshCw, Satellite, Search,
  Send, ShieldCheck, StepForward, Thermometer, Workflow, XCircle
} from 'lucide-react';

const API = '/api/algorithms/forensics';
const SATELLITES = ['SAT-01', 'SAT-02', 'SAT-03', 'SAT-04', 'SAT-05'];
const TABS = [
  { id: 'briefing', label: 'Incident briefing', icon: FileSearch },
  { id: 'reconstruct', label: 'Reconstruction', icon: Workflow },
  { id: 'causality', label: 'Causality analysis', icon: GitBranch },
  { id: 'report', label: 'Evidence report', icon: ShieldCheck }
];
const NODE_TONES = {
  'SAT-01': { text: 'text-cyan-200', border: 'border-cyan-400/30', bg: 'bg-cyan-400/10', solid: '#22d3ee' },
  'SAT-02': { text: 'text-violet-200', border: 'border-violet-400/30', bg: 'bg-violet-400/10', solid: '#a78bfa' },
  'SAT-03': { text: 'text-emerald-200', border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', solid: '#34d399' },
  'SAT-04': { text: 'text-amber-200', border: 'border-amber-400/30', bg: 'bg-amber-400/10', solid: '#fbbf24' },
  'SAT-05': { text: 'text-rose-200', border: 'border-rose-400/30', bg: 'bg-rose-400/10', solid: '#fb7185' }
};
const tone = (id) => NODE_TONES[id] || NODE_TONES['SAT-01'];
const formatLogical = (n) => n == null ? '—' : 'L=' + n;
const eventIcon = (event) => event.kind === 'anomaly' ? Thermometer : event.event_type === 'send' ? Send : event.event_type === 'receive' ? Radio : Activity;

function Panel({ children, className = '' }) {
  return <section className={'rounded-2xl border border-slate-800/90 bg-slate-900/70 shadow-[0_12px_35px_rgba(0,0,0,0.12)] ' + className}>{children}</section>;
}
function SectionHeading({ eyebrow, title, detail, icon: Icon }) {
  return <div className="flex items-start gap-3"><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">{Icon && <Icon size={18} />}</div><div><div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">{eyebrow}</div><h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>{detail && <p className="mt-1 text-sm text-slate-400">{detail}</p>}</div></div>;
}
function Metric({ label, value, detail, icon: Icon, toneName = 'cyan' }) {
  const colors = { cyan: 'text-cyan-200 bg-cyan-400/10 border-cyan-400/20', green: 'text-emerald-200 bg-emerald-400/10 border-emerald-400/20', amber: 'text-amber-200 bg-amber-400/10 border-amber-400/20', violet: 'text-violet-200 bg-violet-400/10 border-violet-400/20' };
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[.15em] text-slate-500">{label}</span><span className={'rounded-lg border p-1.5 ' + colors[toneName]}><Icon size={15}/></span></div><div className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{value}</div><div className="mt-1 text-[11px] text-slate-500">{detail}</div></div>;
}
function StatusPill({ children, variant = 'neutral' }) {
  const styles = { neutral: 'border-slate-700 bg-slate-800/70 text-slate-300', success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', warning: 'border-amber-400/20 bg-amber-400/10 text-amber-200', danger: 'border-rose-400/20 bg-rose-400/10 text-rose-200', info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200' };
  return <span className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ' + styles[variant]}>{children}</span>;
}
function EventBadge({ event, selected, onClick, index }) {
  const t = tone(event.node_id);
  const Icon = eventIcon(event);
  return <button onClick={onClick} title={event.description} className={'absolute z-10 w-[126px] rounded-xl border p-2 text-left transition-all ' + (selected ? 'border-white/70 bg-slate-800 ring-2 ring-cyan-400/30 shadow-lg' : t.border + ' ' + t.bg + ' hover:bg-slate-800')} style={{ left: 94 + index * 142, top: 14 }}><div className="flex items-center justify-between gap-1"><span className="text-[9px] text-slate-500">{event.event_id}</span><Icon size={12} className={t.text}/></div><div className="mt-1 truncate text-[10px] font-medium text-slate-100">{event.description}</div><div className="mt-1 font-mono text-[10px] text-cyan-200">{formatLogical(event.logical_timestamp)}</div></button>;
}
function TimelineCanvas({ trace, selectedEvent, onSelect }) {
  const events = trace?.events || [];
  const nodes = SATELLITES.filter((id) => events.some((e) => e.node_id === id));
  const laneHeight = 88;
  const canvasWidth = Math.max(850, 110 + events.length * 142);
  const canvasHeight = Math.max(130, nodes.length * laneHeight + 18);
  const byId = Object.fromEntries(events.map((event, index) => [event.event_id, { event, index }]));
  const nodeIndex = Object.fromEntries(nodes.map((id, index) => [id, index]));
  const eventPosition = (id) => {
    const item = byId[id];
    if (!item) return null;
    return { x: 94 + item.index * 142 + 63, y: nodeIndex[item.event.node_id] * laneHeight + 47 };
  };
  return <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#070d18]">
    <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
      {nodes.map((node, i) => <div key={node} className="absolute left-0 right-0 border-t border-slate-800/90" style={{ top: i * laneHeight, height: laneHeight }}>
        <div className="sticky left-0 z-20 flex h-full w-[88px] flex-col justify-center border-r border-slate-800 bg-[#0a1120] px-2">
          <div className={'flex items-center gap-1.5 text-[10px] font-semibold ' + tone(node).text}><Satellite size={12}/>{node}</div><div className="mt-1 text-[9px] text-slate-600">Process lane</div>
        </div>
      </div>)}
      <svg className="pointer-events-none absolute inset-0 z-[5]" width={canvasWidth} height={canvasHeight} aria-label="Causal and process-order edges">
        {(trace?.edges || []).map((edge) => {
          const a = eventPosition(edge.from); const b = eventPosition(edge.to);
          if (!a || !b) return null;
          const isMessage = edge.kind === 'message';
          const midX = (a.x + b.x) / 2;
          const color = isMessage ? '#34d399' : '#475569';
          return <g key={edge.from + '-' + edge.to}><path d={'M ' + a.x + ' ' + a.y + ' C ' + midX + ' ' + a.y + ', ' + midX + ' ' + b.y + ', ' + b.x + ' ' + b.y} fill="none" stroke={color} strokeWidth={isMessage ? 2 : 1.3} strokeDasharray={isMessage ? '0' : '4 4'} opacity={isMessage ? 0.9 : 0.55}/><circle cx={b.x} cy={b.y} r="3" fill={color}/></g>;
        })}
      </svg>
      {events.map((event, index) => {
        const row = nodeIndex[event.node_id] || 0;
        const t = tone(event.node_id);
        const Icon = eventIcon(event);
        return <button key={event.event_id} onClick={() => onSelect(event)} className={'absolute z-10 w-[126px] rounded-xl border p-2 text-left transition-all ' + (selectedEvent?.event_id === event.event_id ? 'border-white/80 bg-slate-800 ring-2 ring-cyan-400/30 shadow-xl' : t.border + ' ' + t.bg + ' hover:bg-slate-800')} style={{ left: 94 + index * 142, top: row * laneHeight + 14 }} title={event.description}>
          <div className="flex items-center justify-between gap-1"><span className="text-[9px] text-slate-500">{event.event_id}</span><Icon size={12} className={t.text}/></div>
          <div className="mt-1 truncate text-[10px] font-medium text-slate-100">{event.description}</div>
          <div className="mt-1 font-mono text-[10px] text-cyan-200">{formatLogical(event.logical_timestamp)}</div>
        </button>;
      })}
    </div>
  </div>;
}
function ClockCalculation({ event }) {
  if (!event) return <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">Select an event marker to inspect its clock transition and evidence.</div>;
  const receive = event.event_type === 'receive';
  const send = event.event_type === 'send';
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] uppercase tracking-widest text-slate-500">{event.event_id} · {event.node_id}</div><h3 className="mt-1 text-sm font-semibold text-slate-100">{event.description}</h3></div><StatusPill variant={receive ? 'success' : send ? 'info' : 'neutral'}>{event.event_type.toUpperCase()}</StatusPill></div>
    <div className="grid grid-cols-3 gap-2"><div className="rounded-lg bg-slate-950 p-2.5"><div className="text-[9px] uppercase text-slate-500">Before</div><div className="mt-1 font-mono text-xl text-slate-200">{event.clock_before}</div></div><div className="rounded-lg bg-slate-950 p-2.5"><div className="text-[9px] uppercase text-slate-500">{receive ? 'Message T' : 'Operation'}</div><div className="mt-1 font-mono text-xl text-cyan-200">{receive ? (event.message_id ? 'MSG' : '—') : send ? 'SEND' : 'LOCAL'}</div></div><div className="rounded-lg bg-emerald-400/10 p-2.5"><div className="text-[9px] uppercase text-emerald-200/70">After</div><div className="mt-1 font-mono text-xl text-emerald-200">{event.logical_timestamp}</div></div></div>
    {receive ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"><div className="text-[10px] uppercase tracking-wider text-emerald-200">Receive rule</div><div className="mt-2 font-mono text-sm text-white">L' = max({event.clock_before}, T) + 1</div><div className="mt-1 text-xs text-slate-400">The actual message timestamp and evaluated operands are shown in the trace's message record.</div></div> : <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="font-mono text-sm text-slate-200">L' = {event.clock_before} + 1 = {event.logical_timestamp}</div><div className="mt-1 text-xs text-slate-500">{send ? 'The resulting logical timestamp is copied into the outgoing message envelope.' : 'Every local event advances this satellite process counter.'}</div></div>}
    <div className="grid grid-cols-2 gap-2 text-xs"><div><div className="text-slate-500">Physical timestamp</div><div className="mt-1 font-mono text-slate-300">{event.physical_timestamp}</div></div><div><div className="text-slate-500">Message ID</div><div className="mt-1 font-mono text-slate-300">{event.message_id || '—'}</div></div></div>
    {event.parent_event_ids?.length > 0 && <div><div className="text-[10px] uppercase tracking-wider text-slate-500">Immediate causal predecessors</div><div className="mt-1 flex flex-wrap gap-1.5">{event.parent_event_ids.map(id => <span key={id} className="rounded-md border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-300">{id}</span>)}</div></div>}
  </div>;
}

export default function MissionForensics() {
  const [trace, setTrace] = useState(null);
  const [report, setReport] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tab, setTab] = useState('briefing');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [eventType, setEventType] = useState('local');
  const [sourceNode, setSourceNode] = useState('SAT-01');
  const [destinationNode, setDestinationNode] = useState('SAT-03');
  const [description, setDescription] = useState('Manual mission event');
  const [messageId, setMessageId] = useState('MSG-MANUAL-001');
  const [compareA, setCompareA] = useState('E-002');
  const [compareB, setCompareB] = useState('E-006');
  const [comparison, setComparison] = useState(null);
  const [ancestors, setAncestors] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const loadTrace = useCallback(async () => {
    try {
      const response = await fetch(API + '/trace');
      if (!response.ok) throw new Error('Mission Forensics API is unavailable.');
      const data = await response.json();
      setTrace(data);
      setSelectedEvent((current) => current ? data.events.find(e => e.event_id === current.event_id) || null : data.events[data.events.length - 1] || null);
      setError('');
    } catch (err) { setError(err.message || 'Could not load incident trace.'); }
  }, []);
  const loadReport = useCallback(async () => {
    try { const response = await fetch(API + '/report'); if (response.ok) setReport(await response.json()); } catch (_) {}
  }, []);
  useEffect(() => { loadTrace(); loadReport(); }, [loadTrace, loadReport]);
  useEffect(() => {
    let socket; let retry;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(protocol + '//' + window.location.host + '/ws');
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (['LAMPORT_EVENT_RECORDED', 'LAMPORT_TRACE_COMPLETED', 'FORENSICS_TRACE_RESET'].includes(data.event_type)) {
            if (data.trace) { setTrace(data.trace); setSelectedEvent(current => current ? data.trace.events.find(e => e.event_id === current.event_id) || data.trace.events[data.trace.events.length - 1] || null : data.trace.events[data.trace.events.length - 1] || null); }
            loadReport();
          }
        } catch (_) {}
      };
      socket.onclose = () => { retry = window.setTimeout(connect, 2500); };
    };
    connect();
    return () => { if (retry) window.clearTimeout(retry); if (socket) socket.close(); };
  }, [loadReport]);

  const events = trace?.events || [];
  const messages = trace?.messages || [];
  const complete = !!trace?.complete;
  const stepIndex = trace?.step_index || 0;
  const currentIncident = trace?.incident;
  const pendingReceives = messages.filter(m => !m.receive_event_id);
  const laneCount = new Set(events.map(e => e.node_id)).size;

  const startIncident = async () => {
    setBusy(true); setError(''); setNotice(''); setIsPlaying(false);
    try {
      const response = await fetch(API + '/incidents/thermal-alert/start', { method: 'POST' });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not start incident.');
      setTrace(data); setSelectedEvent(null); setComparison(null); setAncestors(null); setReport(null); setTab('reconstruct');
      setNotice('Incident initialized. Advance one event at a time to inspect the reconstruction.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const step = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(API + '/replay/step', { method: 'POST' });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Replay step failed.');
      setTrace(data.trace); if (data.event) setSelectedEvent(data.event);
      setNotice(data.complete ? 'All planned incident events have been recorded.' : 'Recorded ' + (data.event?.event_id || 'next event') + '. Inspect the clock update and message links.');
      await loadReport();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const runAll = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(API + '/replay/run', { method: 'POST' });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Replay failed.');
      setTrace(data); setSelectedEvent(data.events[data.events.length - 1] || null); setNotice('Replay complete. Compare events and inspect the reconstructed evidence.');
      await loadReport();
    } catch (err) { setError(err.message); } finally { setBusy(false); setIsPlaying(false); }
  };
  const reset = async () => { await startIncident(); setNotice('Incident reset to its deterministic baseline.'); };
  const recordManualEvent = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const body = { node_id: sourceNode, event_type: eventType, description };
      if (eventType === 'send') { body.message_id = messageId; body.destination_id = destinationNode; }
      if (eventType === 'receive') body.message_id = messageId;
      const response = await fetch(API + '/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not record event.');
      setTrace(data.trace); setSelectedEvent(data.event); setNotice('Recorded ' + data.event.event_id + ' using the backend Lamport clock.');
      await loadReport();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const compareEvents = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(API + '/causality?event_a=' + encodeURIComponent(compareA) + '&event_b=' + encodeURIComponent(compareB));
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not compare events.');
      setComparison(data); setTab('causality');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const tracePaths = async (event) => {
    if (!event) return;
    try {
      const response = await fetch(API + '/path/' + encodeURIComponent(event.event_id));
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not inspect causal paths.');
      setAncestors(data); setSelectedEvent(event);
    } catch (err) { setError(err.message); }
  };
  const exportTrace = () => {
    const payload = JSON.stringify({ trace, report }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = (trace?.run_id || 'mission-trace') + '.json'; link.click(); URL.revokeObjectURL(url);
  };
  useEffect(() => {
    if (!isPlaying || complete || busy) return undefined;
    const timer = window.setTimeout(() => { step(); }, 1100);
    return () => window.clearTimeout(timer);
  }, [isPlaying, complete, busy, stepIndex]);

  const counters = trace?.clocks || {};
  const physicalConflict = useMemo(() => {
    if (!events.length) return false;
    const index = Object.fromEntries(events.map((e, i) => [e.event_id, i]));
    return (trace?.messages || []).some(m => m.receive_event_id && index[m.receive_event_id] < index[m.send_event_id]);
  }, [events, trace?.messages]);

  return <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
    <header className="relative isolate overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950">
      <img src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1800&q=85" alt="Earth horizon from orbit" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07111f] via-[#07111f]/95 to-[#07111f]/45" />
      <div className="absolute -right-8 -top-20 -z-10 h-72 w-72 rounded-full border border-cyan-300/15" /><div className="absolute right-7 -top-12 -z-10 h-56 w-56 rounded-full border border-cyan-300/10" />
      <div className="relative grid gap-6 p-5 md:p-8 xl:grid-cols-[1fr_300px] xl:items-end">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] uppercase tracking-[.2em] text-cyan-100"><Search size={13}/> Distributed Systems / Mission Forensics</div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">Mission Incident<br className="hidden md:block"/> Reconstruction</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Reconstruct what happened across the constellation. Follow the messages, inspect Lamport clock updates, and distinguish proven causal order from misleading physical timestamps.</p>
          <div className="mt-5 flex flex-wrap gap-2"><StatusPill variant="info"><Satellite size={12}/> 5 satellite processes</StatusPill><StatusPill variant="neutral"><Clock3 size={12}/> Logical time, not wall time</StatusPill><StatusPill variant={complete ? 'success' : 'warning'}>{complete ? 'Trace complete' : 'Investigation in progress'}</StatusPill></div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">Active incident</div><div className="mt-2 text-lg font-semibold text-white">{currentIncident?.incident_id || 'INC-2048'}</div><div className="mt-1 text-sm text-slate-300">{currentIncident?.name || 'Thermal Alert / Emergency Imaging'}</div>
          <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/5 p-2"><div className="text-[9px] text-slate-500">TRACE ID</div><div className="mt-1 truncate font-mono text-xs text-cyan-100">{trace?.run_id || 'Not started'}</div></div><div className="rounded-lg bg-white/5 p-2"><div className="text-[9px] text-slate-500">EVIDENCE</div><div className="mt-1 text-lg font-semibold text-white">{events.length}</div></div></div>
          <button onClick={startIncident} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"><Play size={14}/> {events.length ? 'Restart investigation' : 'Begin investigation'}</button>
        </div>
      </div>
    </header>

    {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><div><div className="font-semibold">Investigation error</div><div className="mt-1">{error}</div></div></div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-100"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>{notice}</div>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Events reconstructed" value={events.length + ' / ' + (trace?.total_steps || 11)} detail="Recorded from backend event ledger" icon={Activity} toneName="cyan"/>
      <Metric label="Messages tracked" value={messages.length} detail={messages.filter(m => m.receive_event_id).length + ' delivered · ' + pendingReceives.length + ' pending'} icon={MessageSquare} toneName="green"/>
      <Metric label="Physical-time conflict" value={physicalConflict ? 'Detected' : 'Not yet shown'} detail="Message causality vs timestamp sort" icon={AlertTriangle} toneName={physicalConflict ? 'amber' : 'violet'}/>
      <Metric label="Processes in trace" value={laneCount + ' / 5'} detail="Independent per-satellite counters" icon={Layers3} toneName="cyan"/>
    </div>

    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-1.5">{TABS.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition ' + (tab === item.id ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}><Icon size={14}/>{item.label}</button>; })}</nav>

    {tab === 'briefing' && <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Panel className="p-5 md:p-6"><SectionHeading eyebrow="01 / Initial evidence" title="Incident briefing" detail="Inspect the evidence before reconstructing the sequence." icon={FileSearch}/><p className="mt-4 text-sm leading-6 text-slate-300">{currentIncident?.summary || 'Mission Control received a thermal anomaly, a relay receipt, and an emergency imaging request. Physical timestamps appear inconsistent with message flow.'}</p>
        <div className="mt-5 space-y-3">{[
          {id:'A',title:'Thermal anomaly',node:'SAT-01',body:'A payload-temperature threshold was crossed and an alert was prepared.',icon:Thermometer},
          {id:'B',title:'Relay timestamp conflict',node:'SAT-03',body:'The receive record appears earlier than the sender according to simulated physical time.',icon:Radio},
          {id:'C',title:'Emergency imaging request',node:'SAT-05',body:'The imaging payload receives a request and returns a readiness acknowledgement.',icon:Satellite},
          {id:'D',title:'Independent observation',node:'SAT-02',body:'An observation is recorded without a message path to the thermal incident.',icon:CircleDot}
        ].map(item => { const Icon = item.icon; return <div key={item.id} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-cyan-200"><Icon size={16}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] text-slate-500">EVIDENCE {item.id}</span><span className="text-[10px] text-cyan-200">{item.node}</span></div><div className="mt-1 text-sm font-medium text-slate-100">{item.title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{item.body}</div></div></div>; })}</div>
        <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><AlertTriangle size={16}/> Investigation question</div><p className="mt-2 text-xs leading-5 text-slate-300">Which event relationships are proven by process order and message delivery—and which apparent orderings are only artifacts of physical clock skew?</p><button onClick={() => setTab('reconstruct')} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-cyan-100">Open reconstruction workbench <ChevronRight size={14}/></button></div>
      </Panel>
      <div className="space-y-4"><Panel className="overflow-hidden"><div className="relative h-44"><img src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1000&q=80" alt="Earth from orbit" className="h-full w-full object-cover opacity-65" onError={e => {e.currentTarget.style.display='none';}}/><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent"/><div className="absolute bottom-4 left-4"><div className="text-[10px] uppercase tracking-widest text-cyan-200">Constellation context</div><div className="mt-1 text-lg font-semibold text-white">Four evidence sources</div></div></div><div className="grid grid-cols-2 gap-2 p-4">{SATELLITES.slice(0,4).map(id => <div key={id} className={'flex items-center gap-2 rounded-lg border p-2 ' + tone(id).border + ' ' + tone(id).bg}><Satellite size={14} className={tone(id).text}/><div><div className={'text-xs font-semibold ' + tone(id).text}>{id}</div><div className="text-[9px] text-slate-500">{events.filter(e => e.node_id === id).length} events recorded</div></div></div>)}</div></Panel>
        <Panel className="p-4"><SectionHeading eyebrow="Method" title="Evidence, not guesswork" detail="The algorithm derives ordering from local process edges and matching message IDs." icon={ShieldCheck}/><div className="mt-3 space-y-2 text-xs text-slate-400"><div className="flex gap-2"><CheckCircle2 size={14} className="text-emerald-300"/> Local execution order is preserved.</div><div className="flex gap-2"><CheckCircle2 size={14} className="text-emerald-300"/> Every receive references a recorded send.</div><div className="flex gap-2"><CheckCircle2 size={14} className="text-emerald-300"/> Logical timestamps never serve as the causal proof.</div></div></Panel>
      </div>
    </div>}

    {tab === 'reconstruct' && <div className="space-y-4">
      <Panel className="p-4 md:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><SectionHeading eyebrow="02 / Event trace" title="Reconstruction workbench" detail="Each row is a satellite process; arrows represent local-order and message edges." icon={Workflow}/><div className="flex flex-wrap gap-2"><button onClick={() => {setIsPlaying(v => !v);}} disabled={complete || busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40">{isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? 'Pause replay' : 'Auto replay'}</button><button onClick={step} disabled={busy || complete} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"><StepForward size={14}/> Next event</button><button onClick={runAll} disabled={busy || complete} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-40"><Play size={14}/> Run all</button><button onClick={reset} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"><RefreshCw size={13}/> Reset</button></div></div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all" style={{width: ((stepIndex / Math.max(1, trace?.total_steps || 11))*100) + '%'}}/></div><div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>Event {stepIndex} of {trace?.total_steps || 11}</span><span>{complete ? 'Trace complete' : 'Step-by-step replay'}</span></div>
        {events.length > 0 ? <div className="mt-4"><TimelineCanvas trace={trace} selectedEvent={selectedEvent} onSelect={setSelectedEvent}/><div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-emerald-400"/ >Message send → receive</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-slate-500"/>Local process order</span><span className="flex items-center gap-1.5">Select any event to inspect</span></div></div> : <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-8 text-center"><Satellite size={24} className="mx-auto text-slate-600"/><div className="mt-2 text-sm font-medium text-slate-200">No incident events recorded</div><div className="mt-1 text-xs text-slate-500">Begin the investigation, then step through the deterministic scenario.</div><button onClick={startIncident} className="mt-4 rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950">Initialize incident</button></div>}
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]"><Panel className="p-4 md:p-5"><SectionHeading eyebrow="Event inspector" title="Clock transition" detail="Values below are read from the recorded backend event." icon={Clock3}/><div className="mt-4"><ClockCalculation event={selectedEvent}/></div></Panel>
        <Panel className="p-4"><SectionHeading eyebrow="Current node state" title="Logical counters" detail="Independent per-satellite values" icon={Activity}/><div className="mt-4 space-y-2">{SATELLITES.map(node => <div key={node} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"><div className={'flex items-center gap-2 text-xs font-semibold ' + tone(node).text}><Satellite size={13}/>{node}</div><div className="font-mono text-sm text-slate-100">{formatLogical(counters[node] ?? 0)}</div></div>)}</div><div className="mt-4 border-t border-slate-800 pt-3"><div className="text-[10px] uppercase tracking-widest text-slate-500">Messages</div>{messages.length ? messages.map(m => <div key={m.message_id} className="mt-2 rounded-lg border border-slate-800 p-2"><div className="font-mono text-[10px] text-slate-300">{m.message_id}</div><div className="mt-1 text-[10px] text-slate-500">{m.source_id} → {m.destination_id} · T={m.logical_timestamp}</div><StatusPill variant={m.receive_event_id ? 'success' : 'warning'}>{m.receive_event_id ? 'Delivered' : 'Awaiting receive'}</StatusPill></div>) : <p className="mt-2 text-xs text-slate-500">No messages until the first send event.</p>}</div></Panel>
      </div>
      <Panel className="p-4"><SectionHeading eyebrow="Optional manual experiment" title="Generate a local, send, or receive event" detail="These controls execute the backend algorithm. Invalid message flows are rejected." icon={Activity}/><form onSubmit={recordManualEvent} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-[10px] uppercase tracking-wider text-slate-500">Satellite<select value={sourceNode} onChange={e => setSourceNode(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100">{SATELLITES.map(n => <option key={n}>{n}</option>)}</select></label>
        <label className="text-[10px] uppercase tracking-wider text-slate-500">Event type<select value={eventType} onChange={e => setEventType(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100"><option value="local">Local event</option><option value="send">Send message</option><option value="receive">Receive message</option></select></label>
        {eventType === 'send' && <label className="text-[10px] uppercase tracking-wider text-slate-500">Destination<select value={destinationNode} onChange={e => setDestinationNode(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100">{SATELLITES.filter(n => n !== sourceNode).map(n => <option key={n}>{n}</option>)}</select></label>}
        {eventType !== 'local' && <label className="text-[10px] uppercase tracking-wider text-slate-500">Message ID{eventType === 'receive' && <select value={messageId} onChange={e => setMessageId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100">{pendingReceives.filter(m => m.destination_id === sourceNode).map(m => <option key={m.message_id} value={m.message_id}>{m.message_id}</option>)}</select>}{eventType === 'send' && <input value={messageId} onChange={e => setMessageId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100"/>}</label>}
        <label className="text-[10px] uppercase tracking-wider text-slate-500 md:col-span-2 xl:col-span-1">Description<input value={description} onChange={e => setDescription(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100"/></label>
        <div className="flex items-end"><button disabled={busy || (eventType === 'receive' && !pendingReceives.some(m => m.destination_id === sourceNode && m.message_id === messageId))} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-40"><Activity size={13}/> Record event</button></div>
      </form><p className="mt-2 text-[10px] text-slate-500">A send requires a unique message ID and destination. A receive must match an outstanding message sent to the selected satellite.</p></Panel>
    </div>}

    {tab === 'causality' && <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]"><Panel className="p-5"><SectionHeading eyebrow="03 / Happened-before" title="Compare two events" detail="The result is computed from directed process and message edges—not timestamp arithmetic." icon={GitCompare}/><div className="mt-5 space-y-3"><label className="block text-[10px] uppercase tracking-wider text-slate-500">Event A<select value={compareA} onChange={e => setCompareA(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100">{events.map(e => <option key={e.event_id} value={e.event_id}>{e.event_id} · {e.node_id} · {e.description}</option>)}</select></label><label className="block text-[10px] uppercase tracking-wider text-slate-500">Event B<select value={compareB} onChange={e => setCompareB(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-100">{events.map(e => <option key={e.event_id} value={e.event_id}>{e.event_id} · {e.node_id} · {e.description}</option>)}</select></label><button onClick={compareEvents} disabled={busy || !events.length || compareA === compareB} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-40"><GitCompare size={14}/> Determine relationship</button></div><div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">A → B only if a directed path exists from A to B. If neither direction has a path, the trace establishes no causal ordering between them.</div>
      <div className="mt-5 border-t border-slate-800 pt-4"><div className="text-[10px] uppercase tracking-widest text-slate-500">Inspect a selected event</div><div className="mt-2 flex gap-2"><select value={selectedEvent?.event_id || ''} onChange={e => setSelectedEvent(events.find(x => x.event_id === e.target.value) || null)} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">{events.map(e => <option key={e.event_id} value={e.event_id}>{e.event_id} · {e.description}</option>)}</select><button onClick={() => tracePaths(selectedEvent)} className="rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:bg-slate-800">Trace paths</button></div></div></Panel>
      <Panel className="p-5"><SectionHeading eyebrow="Analysis result" title="Causal relationship" detail="Evidence-backed result and the path used to establish it." icon={GitBranch}/>{comparison ? <div className="mt-5 space-y-4"><div className={'rounded-xl border p-4 ' + (comparison.relation === 'NO_CAUSAL_PATH' ? 'border-amber-300/20 bg-amber-300/5' : 'border-emerald-300/20 bg-emerald-300/5')}><div className="text-[10px] uppercase tracking-wider text-slate-500">Relationship</div><div className="mt-2 text-lg font-semibold text-white">{comparison.relation === 'A_BEFORE_B' ? 'A happened before B' : comparison.relation === 'B_BEFORE_A' ? 'B happened before A' : 'No causal path established'}</div><p className="mt-2 text-xs leading-5 text-slate-300">{comparison.explanation}</p></div>{comparison.path?.length > 0 && <div><div className="text-[10px] uppercase tracking-widest text-slate-500">Directed path</div><div className="mt-2 flex flex-wrap items-center gap-2">{comparison.path.map((id,i) => <React.Fragment key={id}>{i > 0 && <ArrowRight size={13} className="text-emerald-300"/>}<button onClick={() => setSelectedEvent(events.find(e => e.event_id === id) || null)} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 font-mono text-xs text-emerald-100">{id}</button></React.Fragment>)}</div></div>}<div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400">Lamport timestamps alone do not prove causality. The relationship above is computed from recorded local-process order and message edges.</div></div> : <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center"><GitBranch size={26} className="mx-auto text-slate-600"/><div className="mt-3 text-sm font-medium text-slate-200">No comparison run yet</div><p className="mt-1 text-xs text-slate-500">Choose two events and calculate their relationship.</p></div>}
      {ancestors && <div className="mt-5 border-t border-slate-800 pt-4"><div className="text-sm font-semibold text-white">Event path inspection · {ancestors.event_id}</div><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Ancestors</div><div className="mt-2 flex flex-wrap gap-1">{ancestors.ancestors.length ? ancestors.ancestors.map(id => <span key={id} className="rounded border border-cyan-400/20 px-2 py-1 font-mono text-[10px] text-cyan-100">{id}</span>) : <span className="text-xs text-slate-500">None in trace</span>}</div></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[10px] uppercase text-slate-500">Descendants</div><div className="mt-2 flex flex-wrap gap-1">{ancestors.descendants.length ? ancestors.descendants.map(id => <span key={id} className="rounded border border-emerald-400/20 px-2 py-1 font-mono text-[10px] text-emerald-100">{id}</span>) : <span className="text-xs text-slate-500">None in trace</span>}</div></div></div></div>}
      </Panel></div>}

    {tab === 'report' && <div className="grid gap-4 xl:grid-cols-[1fr_320px]"><Panel className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><SectionHeading eyebrow="04 / Final findings" title="Incident reconstruction report" detail="Generated from the current event ledger and causal analysis." icon={ShieldCheck}/><button onClick={exportTrace} disabled={!trace} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"><Download size={14}/> Export JSON</button></div><div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="text-[10px] uppercase tracking-widest text-slate-500">{report?.incident_id || 'INC-2048'} · {trace?.run_id}</div><h3 className="mt-2 text-xl font-semibold text-white">{report?.title || 'Thermal Alert / Emergency Imaging'}</h3><p className="mt-2 text-sm leading-6 text-slate-400">The report is provisional until the deterministic event plan has completed. Findings below reflect the records currently available.</p></div><div className="mt-4 space-y-3">{(report?.findings || []).map(f => <div key={f.id} className="rounded-xl border border-slate-800 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-widest text-slate-500">{f.id}</div><h3 className="mt-1 text-sm font-semibold text-white">{f.title}</h3></div><StatusPill variant={f.status === 'confirmed' || f.status === 'recorded' ? 'success' : f.status === 'pending' ? 'warning' : 'neutral'}>{f.status}</StatusPill></div><p className="mt-2 text-xs leading-5 text-slate-400">{f.detail}</p>{f.evidence_event_ids?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{f.evidence_event_ids.map(id => <button key={id} onClick={() => {setSelectedEvent(events.find(e => e.event_id === id) || null);setTab('reconstruct');}} className="rounded-md border border-slate-700 px-2 py-1 font-mono text-[10px] text-cyan-200 hover:bg-slate-800">{id}</button>)}</div>}</div>)}</div><div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><div className="text-sm font-semibold text-amber-100">Interpretation limits</div><ul className="mt-2 space-y-2 text-xs leading-5 text-slate-400">{(report?.limitations || []).map(item => <li key={item} className="flex gap-2"><span className="text-amber-200">•</span><span>{item}</span></li>)}</ul></div></Panel><div className="space-y-4"><Panel className="p-4"><SectionHeading eyebrow="Trace metadata" title="Evidence ledger" icon={History}/><div className="mt-4 space-y-3 text-xs">{[['Run ID',trace?.run_id],['Events recorded',events.length],['Messages',messages.length],['Replay complete',complete ? 'Yes' : 'No'],['Causal edges',trace?.edges?.length || 0]].map(([k,v]) => <div key={k} className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2"><span className="text-slate-500">{k}</span><span className="max-w-[160px] truncate text-right font-mono text-slate-200">{v ?? '—'}</span></div>)}</div></Panel><Panel className="p-4"><SectionHeading eyebrow="Algorithm checks" title="Semantics checklist" icon={CheckCircle2}/><div className="mt-3 space-y-3 text-xs">{['Local events increment their process clock.','Send timestamps are retained in message records.','Receive uses max(local, message timestamp) + 1.','Causal claims use graph reachability.'].map((label,i) => <div key={label} className="flex items-start gap-2"><span className="mt-0.5 text-emerald-300"><CheckCircle2 size={14}/></span><span className="text-slate-300">{label}</span></div>)}</div><p className="mt-3 text-[10px] leading-4 text-slate-600">These checklist items describe the intended invariants. Automated tests are the source of verification, not this display.</p></Panel></div></div>}

    <footer className="flex flex-col gap-2 border-t border-slate-800 pt-4 text-[10px] text-slate-600 md:flex-row md:items-center md:justify-between"><span>MISSION FORENSICS · LAMPORT CLOCK ENGINE · SIMULATED PHYSICAL TIME</span><span className="flex items-center gap-1.5"><ShieldCheck size={12}/> No operating-system clocks are changed</span></footer>
  </div>;
}
