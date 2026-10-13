import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, CheckCircle2, ChevronDown, Clock3,
  Download, GitCompare, Layers3, Play, Radio, RefreshCw, RotateCcw,
  Satellite, Send, ShieldCheck, Workflow, XCircle, Zap
} from 'lucide-react';

const API = '/api/algorithms/vector';
const SATELLITES = ['SAT-01', 'SAT-02', 'SAT-03', 'SAT-04', 'SAT-05'];
const TABS = [
  { id: 'overview', label: 'Mission overview', icon: Satellite },
  { id: 'simulator', label: 'Event simulator', icon: Workflow },
  { id: 'compare', label: 'Causality inspector', icon: GitCompare },
  { id: 'evidence', label: 'Evidence log', icon: ShieldCheck }
];
const NODE_TONES = {
  'SAT-01': { text: 'text-cyan-200', border: 'border-cyan-400/30', bg: 'bg-cyan-400/10', solid: '#22d3ee' },
  'SAT-02': { text: 'text-violet-200', border: 'border-violet-400/30', bg: 'bg-violet-400/10', solid: '#a78bfa' },
  'SAT-03': { text: 'text-emerald-200', border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', solid: '#34d399' },
  'SAT-04': { text: 'text-amber-200', border: 'border-amber-400/30', bg: 'bg-amber-400/10', solid: '#fbbf24' },
  'SAT-05': { text: 'text-rose-200', border: 'border-rose-400/30', bg: 'bg-rose-400/10', solid: '#fb7185' }
};
const tone = (node) => NODE_TONES[node] || NODE_TONES['SAT-01'];
const vectorArray = (vector) => SATELLITES.map((node) => Number(vector?.[node] ?? 0));
const vectorText = (vector) => '[' + vectorArray(vector).join(', ') + ']';
const relationDetails = {
  A_BEFORE_B: { title: 'A happened before B', color: 'emerald', detail: 'Every component of A is less than or equal to B, and at least one component is strictly smaller.' },
  B_BEFORE_A: { title: 'B happened before A', color: 'cyan', detail: 'Every component of B is less than or equal to A, and at least one component is strictly smaller.' },
  CONCURRENT: { title: 'Events are concurrent', color: 'amber', detail: 'Neither vector dominates the other. Each event contains history the other does not contain.' },
  EQUAL: { title: 'Vectors are equal', color: 'slate', detail: 'Equal vectors do not establish strict happened-before. Inspect event history as well.' }
};

function Panel({ children, className = '' }) {
  return <section className={'rounded-2xl border border-slate-800/90 bg-slate-900/70 shadow-[0_12px_35px_rgba(0,0,0,0.14)] ' + className}>{children}</section>;
}
function Heading({ eyebrow, title, detail, icon: Icon }) {
  return <div className="flex items-start gap-3"><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200"><Icon size={18}/></div><div><div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">{eyebrow}</div><h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>{detail && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">{detail}</p>}</div></div>;
}
function Metric({ label, value, detail, icon: Icon, accent = 'cyan' }) {
  const colors = { cyan: 'text-cyan-200 bg-cyan-400/10 border-cyan-400/20', green: 'text-emerald-200 bg-emerald-400/10 border-emerald-400/20', amber: 'text-amber-200 bg-amber-400/10 border-amber-400/20', violet: 'text-violet-200 bg-violet-400/10 border-violet-400/20' };
  return <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[.15em] text-slate-500">{label}</span><span className={'rounded-lg border p-1.5 ' + colors[accent]}><Icon size={15}/></span></div><div className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{value}</div><div className="mt-1 text-[11px] text-slate-500">{detail}</div></div>;
}
function Button({ children, onClick, disabled = false, variant = 'primary', className = '' }) {
  const styles = variant === 'primary'
    ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20'
    : variant === 'danger'
      ? 'border-rose-400/25 bg-rose-400/5 text-rose-200 hover:bg-rose-400/10'
      : 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80';
  return <button type="button" disabled={disabled} onClick={onClick} className={'inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ' + styles + ' ' + className}>{children}</button>;
}
function VectorPill({ vector, compact = false }) {
  return <span className={'inline-flex max-w-full flex-wrap items-center gap-1 font-mono ' + (compact ? 'text-[10px]' : 'text-xs')}>{vectorArray(vector).map((value, i) => <span key={SATELLITES[i]} title={SATELLITES[i]} className={'rounded-md border px-1.5 py-1 ' + (value > 0 ? tone(SATELLITES[i]).text + ' ' + tone(SATELLITES[i]).border + ' ' + tone(SATELLITES[i]).bg : 'border-slate-800 bg-slate-950/80 text-slate-500')}>{value}</span>)}</span>;
}
function VectorTable({ state }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-separate border-spacing-y-1.5 text-left"><thead><tr><th className="px-3 pb-2 text-[10px] uppercase tracking-wider text-slate-500">Satellite</th>{SATELLITES.map((node) => <th key={node} className={'px-2 pb-2 text-center text-[10px] ' + tone(node).text}>{node}</th>)}<th className="px-3 pb-2 text-right text-[10px] uppercase tracking-wider text-slate-500">Vector</th></tr></thead><tbody>{SATELLITES.map((node) => <tr key={node}><td className="rounded-l-xl border-y border-l border-slate-800 bg-slate-950/60 px-3 py-3"><span className={'flex items-center gap-2 text-xs font-semibold ' + tone(node).text}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone(node).solid }}/>{node}</span></td>{SATELLITES.map((component) => <td key={component} className="border-y border-slate-800 bg-slate-950/60 px-1 py-3 text-center"><span className={'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border font-mono text-xs ' + (node === component ? tone(node).text + ' ' + tone(node).border + ' ' + tone(node).bg : (state?.vectors?.[node]?.[component] > 0 ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-800/70 text-slate-600'))}>{state?.vectors?.[node]?.[component] ?? 0}</span></td>)}<td className="rounded-r-xl border-y border-r border-slate-800 bg-slate-950/60 px-3 py-3 text-right"><span className="whitespace-nowrap font-mono text-[10px] text-slate-300">{vectorText(state?.vectors?.[node])}</span></td></tr>)}</tbody></table></div>;
}
function Timeline({ events, onSelect, selectedId }) {
  const laneHeight = 78;
  const step = 158;
  const width = Math.max(720, 150 + events.length * step);
  const height = SATELLITES.length * laneHeight + 16;
  const positions = {};
  events.forEach((event, index) => { positions[event.event_id] = { x: 132 + index * step, y: SATELLITES.indexOf(event.node_id) * laneHeight + 39 }; });
  const sends = events.filter((event) => event.event_type === 'send');
  const receives = events.filter((event) => event.event_type === 'receive');
  return <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#070d18]">
    <div className="relative" style={{ width, height }}>
      {SATELLITES.map((node, index) => <div key={node} className="absolute left-0 right-0 border-t border-slate-800/80" style={{ top: index * laneHeight, height: laneHeight }}>
        <div className="sticky left-0 z-20 flex h-full w-[112px] flex-col justify-center border-r border-slate-800 bg-[#0a1120] px-3"><span className={'flex items-center gap-1.5 text-[10px] font-semibold ' + tone(node).text}><Satellite size={12}/>{node}</span><span className="mt-1 text-[9px] text-slate-600">logical process</span></div>
      </div>)}
      <svg className="pointer-events-none absolute inset-0 z-[1]" width={width} height={height} aria-label="Message causality arrows">
        <defs><marker id="vector-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#22d3ee"/></marker></defs>
        {sends.map((send) => {
          const receive = receives.find((event) => event.message_id === send.message_id);
          if (!receive || !positions[receive.event_id]) return null;
          const a = positions[send.event_id], b = positions[receive.event_id];
          return <g key={send.message_id}><path d={'M ' + (a.x + 15) + ' ' + a.y + ' C ' + (a.x + 45) + ' ' + a.y + ', ' + (b.x - 45) + ' ' + b.y + ', ' + (b.x - 15) + ' ' + b.y} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#vector-arrow)" opacity=".85"/><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7} fill="#67e8f9" fontSize="9" textAnchor="middle">{send.message_id}</text></g>;
        })}
      </svg>
      {events.map((event, index) => {
        const x = 124 + index * step, y = SATELLITES.indexOf(event.node_id) * laneHeight + 12;
        const selected = event.event_id === selectedId;
        const t = tone(event.node_id);
        return <button key={event.event_id} type="button" onClick={() => onSelect(event)} title={event.description} className={'absolute z-10 w-[132px] rounded-xl border p-2 text-left transition ' + (selected ? 'border-white/70 bg-slate-800 ring-2 ring-cyan-400/25' : t.border + ' ' + t.bg + ' hover:bg-slate-800')} style={{ left: x, top: y }}><div className="flex items-center justify-between gap-1"><span className="font-mono text-[9px] text-slate-500">{event.event_id}</span>{event.event_type === 'send' ? <Send size={11} className="text-cyan-200"/> : event.event_type === 'receive' ? <Radio size={11} className="text-emerald-200"/> : <Activity size={11} className={t.text}/>}</div><div className="mt-1 truncate text-[10px] font-medium text-slate-100">{event.description}</div><div className="mt-1 font-mono text-[10px] text-cyan-200">{vectorText(event.vector)}</div></button>;
      })}
      {events.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Run a scenario or create an event to populate the five process lanes.</div>}
    </div>
  </div>;
}
function ComparisonResult({ result }) {
  if (!result) return <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">Select two events to inspect their causal relationship.</div>;
  const detail = relationDetails[result.relation] || relationDetails.EQUAL;
  const colors = { emerald: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200', cyan: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200', amber: 'border-amber-400/25 bg-amber-400/10 text-amber-200', slate: 'border-slate-700 bg-slate-800/70 text-slate-200' };
  return <div className="space-y-4">
    <div className={'rounded-xl border p-4 ' + colors[detail.color]}><div className="flex items-center gap-2 text-sm font-semibold">{result.relation === 'CONCURRENT' ? <GitCompare size={17}/> : <CheckCircle2 size={17}/>} {detail.title}</div><p className="mt-2 text-xs leading-relaxed opacity-90">{result.explanation || detail.detail}</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[430px] text-left text-xs"><thead><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="py-2">Component</th><th className="py-2">Vector A</th><th className="py-2">Vector B</th><th className="py-2">A ≤ B</th><th className="py-2">B ≤ A</th></tr></thead><tbody>{(result.components || []).map((component) => <tr key={component.node_id} className="border-t border-slate-800"><td className={'py-2.5 font-medium ' + tone(component.node_id).text}>{component.node_id}</td><td className="py-2.5 font-mono">{component.a}</td><td className="py-2.5 font-mono">{component.b}</td><td className="py-2.5">{component.a_le_b ? <span className="text-emerald-300">Yes</span> : <span className="text-rose-300">No</span>}</td><td className="py-2.5">{component.b_le_a ? <span className="text-emerald-300">Yes</span> : <span className="text-rose-300">No</span>}</td></tr>)}</tbody></table></div>
  </div>;
}

export default function VectorClockLab() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('overview');
  const [source, setSource] = useState('SAT-01');
  const [destination, setDestination] = useState('SAT-03');
  const [receiveNode, setReceiveNode] = useState('SAT-03');
  const [messageId, setMessageId] = useState('');
  const [selectedA, setSelectedA] = useState('');
  const [selectedB, setSelectedB] = useState('');
  const [comparison, setComparison] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch(API + '/state');
    if (!response.ok) throw new Error('Unable to load vector-clock state.');
    const data = await response.json();
    setState(data);
    return data;
  }, []);

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [refresh]);

  const events = state?.events || [];
  const pending = state?.pending_messages || [];
  const eventOptions = useMemo(() => events.map((event) => ({ value: event.event_id, label: event.event_id + ' · ' + event.node_id + ' · ' + event.description })), [events]);

  const request = useCallback(async (path, body) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Request failed.');
      if (data.state) setState(data.state);
      else if (data.satellites && data.vectors) setState(data);
      else if (data.scenario_id && data.state) setState(data.state);
      else await refresh();
      return data;
    } catch (err) {
      setError(err.message || 'Unexpected request error.');
      return null;
    } finally { setBusy(false); }
  }, [refresh]);

  const loadScenario = async (scenario) => {
    const data = await request('/scenario/' + scenario, {});
    if (!data) return;
    setComparison(data.comparison || null);
    if (data.comparison) { setSelectedA(data.comparison.event_a); setSelectedB(data.comparison.event_b); }
    else if (data.send_event && data.receive_event) { setSelectedA(data.send_event.event_id); setSelectedB(data.receive_event.event_id); }
    setSelectedEvent(data.receive_event || data.send_event || null);
    setTab(scenario === 'concurrency' ? 'compare' : 'overview');
    setNotice(scenario === 'concurrency' ? 'Independent events created on SAT-01 and SAT-02. No messages were exchanged.' : 'Worked example loaded. Select the receive event to inspect the merge step by step.');
  };

  const createEvent = async (operation) => {
    const node = operation === 'receive' ? receiveNode : source;
    const body = { operation, node_id: node, description: description.trim() };
    if (operation === 'send') body.destination_id = destination;
    if (operation === 'receive') body.message_id = messageId;
    const data = await request('/event', body);
    if (data) {
      setSelectedEvent(data.event);
      setDescription('');
      if (operation === 'receive') setMessageId('');
      setNotice(operation === 'send' ? 'Message snapshot recorded. Deliver it to its destination to merge histories.' : operation === 'receive' ? 'Message delivered: merge completed, then the receiver incremented its own component.' : 'Local event recorded; only the selected satellite component advanced.');
    }
  };

  const compareSelected = async () => {
    if (!selectedA || !selectedB) { setError('Choose both events before comparing.'); return; }
    const data = await request('/compare', { event_a: selectedA, event_b: selectedB });
    if (data) { setComparison(data); setTab('compare'); }
  };

  const exportReport = () => {
    const payload = { exported_at: new Date().toISOString(), lab: 'Vector Clock Lab', component_order: SATELLITES, state, comparison };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'vector-clock-evidence.json'; link.click();
    URL.revokeObjectURL(url);
  };

  const latestEvent = selectedEvent || events[events.length - 1];
  const receiveStage = latestEvent?.event_type === 'receive' ? latestEvent : null;

  return <div className="mx-auto max-w-[1600px] space-y-5 pb-8">
    <div className="relative isolate overflow-hidden rounded-2xl border border-slate-800 bg-[#07101f]">
      <img src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1800&q=80" alt="Earth horizon from orbit" className="absolute inset-0 z-0 h-full w-full object-cover opacity-30" onError={(event) => { event.currentTarget.style.display = 'none'; }}/>
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#07101f] via-[#07101f]/95 to-[#07101f]/50"/>
      <div className="relative z-20 flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-7">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300"/> Simulation environment</span><span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-400">5 process nodes · logical time</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Vector Clock Lab</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Reconstruct distributed history across five satellites. Send vector snapshots, merge remote knowledge, and prove whether events are causally ordered or concurrent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => loadScenario('worked-example')} disabled={busy}><Play size={14}/> Load worked example</Button>
          <Button variant="secondary" onClick={() => loadScenario('concurrency')} disabled={busy}><GitCompare size={14}/> Concurrency experiment</Button>
          <Button variant="secondary" onClick={async () => { const data = await request('/reset', {}); if (data) { setComparison(null); setSelectedA(''); setSelectedB(''); setSelectedEvent(null); setNotice('Simulation reset. Every satellite vector is now zero.'); } }} disabled={busy}><RotateCcw size={14}/> Reset</Button>
        </div>
      </div>
    </div>

    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-200"><XCircle size={16} className="mt-0.5 shrink-0"/><span>{error}</span><button className="ml-auto text-rose-100 underline" onClick={() => setError('')}>Dismiss</button></div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-100"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/><span>{notice}</span><button className="ml-auto text-cyan-100/80 underline" onClick={() => setNotice('')}>Dismiss</button></div>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Participating nodes" value="05" detail="Fixed vector component order" icon={Satellite}/>
      <Metric label="Recorded events" value={String(state?.event_count ?? 0).padStart(2, '0')} detail="Local, send, and receive operations" icon={Activity} accent="green"/>
      <Metric label="Messages in ledger" value={String(state?.message_count ?? 0).padStart(2, '0')} detail={pending.length + ' awaiting delivery'} icon={Radio} accent="violet"/>
      <Metric label="Causal comparisons" value={comparison ? '01' : '—'} detail={comparison ? comparison.relation.replaceAll('_', ' ') : 'Select two events to compare'} icon={GitCompare} accent="amber"/>
    </div>

    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-1.5">
      {TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition ' + (tab === id ? 'bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-400/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200')}><Icon size={14}/>{label}</button>)}
    </div>

    {tab === 'overview' && <div className="space-y-5">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)]">
        <Panel className="min-w-0 p-4 md:p-5"><Heading eyebrow="Live logical state" title="Constellation vector matrix" detail="Each row is one satellite's local vector. Columns always follow SAT-01 → SAT-05; a highlighted diagonal cell marks that node's own counter." icon={Layers3}/><div className="mt-5"><VectorTable state={state}/></div><div className="mt-4 flex flex-wrap gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-cyan-300"/>Node-owned component</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-slate-500"/>Learned or zero component</span></div></Panel>
        <Panel className="p-4 md:p-5"><Heading eyebrow="Operation trace" title="The latest vector transition" detail="Inspect what changed during the selected event. Receive events expose both the merged vector and the final receiver vector." icon={ArrowDownRight}/>{latestEvent ? <div className="mt-5 space-y-3"><div className="flex items-center justify-between gap-3"><span className={'rounded-lg border px-2.5 py-1.5 text-xs font-semibold ' + tone(latestEvent.node_id).text + ' ' + tone(latestEvent.node_id).border + ' ' + tone(latestEvent.node_id).bg}>{latestEvent.node_id}</span><span className="font-mono text-[10px] text-slate-500">{latestEvent.event_id} · {latestEvent.event_type.toUpperCase()}</span></div><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Before event</div><div className="mt-2"><VectorPill vector={latestEvent.vector_before}/></div></div>{receiveStage && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><div className="text-[10px] uppercase tracking-wider text-amber-200">After component-wise maximum</div><div className="mt-2"><VectorPill vector={receiveStage.merged_vector}/></div><p className="mt-2 text-[11px] text-slate-400">The receiver has merged the sender's knowledge; its own counter has not yet been incremented.</p></div>}<div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"><div className="text-[10px] uppercase tracking-wider text-emerald-200">After event</div><div className="mt-2"><VectorPill vector={latestEvent.vector}/></div><p className="mt-2 text-[11px] leading-relaxed text-slate-400">{latestEvent.event_type === 'receive' ? 'Merge first, then increment ' + latestEvent.node_id + "'s own component." : latestEvent.event_type === 'send' ? 'The message payload is a snapshot of this vector at send time.' : 'Only the selected process component increments on a local event.'}</p></div><div className="text-xs text-slate-300">{latestEvent.description}</div></div> : <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center"><Clock3 className="mx-auto text-slate-600" size={25}/><p className="mt-3 text-xs text-slate-500">No events yet. Load a scenario or create your first event.</p></div>}</Panel>
      </div>
      <Panel className="p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><Heading eyebrow="Causal message graph" title="Five-lane event timeline" detail="Each event belongs to one satellite process. Dashed arrows connect a message send to its matching receive; physical time is deliberately not used to infer causality." icon={Workflow}/><span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400">{events.length} events · {state?.message_count || 0} messages</span></div><div className="mt-5"><Timeline events={events} selectedId={selectedEvent?.event_id} onSelect={(event) => { setSelectedEvent(event); setTab('overview'); }}/></div></Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-4"><Heading eyebrow="Algorithm rule" title="Send and receive semantics" detail="A message transports a vector snapshot; it does not transport a mutable reference to the sender's live clock." icon={Send}/><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3"><div className="text-xs font-semibold text-cyan-100">On send</div><p className="mt-1 text-xs leading-relaxed text-slate-400">Increment sender's component, then attach the resulting vector to the message.</p></div><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"><div className="text-xs font-semibold text-emerald-100">On receive</div><p className="mt-1 text-xs leading-relaxed text-slate-400">Take component-wise maximum, then increment the receiver's own component.</p></div></div></Panel>
        <Panel className="p-4"><Heading eyebrow="Learning objective" title="Partial order, not a global sequence" detail="A vector clock can distinguish causal dependency from concurrency. Two events may have different vectors without either being before the other." icon={GitCompare}/><div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs leading-7 text-slate-300">A ≺ B iff ∀i A[i] ≤ B[i]<br/><span className="text-cyan-200">and</span> ∃j A[j] &lt; B[j]</div></Panel>
      </div>
    </div>}

    {tab === 'simulator' && <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,.7fr)]">
      <Panel className="p-4 md:p-5"><Heading eyebrow="Manual operation console" title="Create a distributed event" detail="Choose an operation and satellite. Each action updates the backend ledger and the vector table from the returned state." icon={Zap}/><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="text-xs font-semibold text-white">1 · Local event</div><p className="mt-1 text-xs leading-relaxed text-slate-500">Advance one satellite's own component without exchanging a message.</p><label className="mt-4 block text-[10px] uppercase tracking-wider text-slate-500">Satellite</label><select value={source} onChange={(e) => { const next = e.target.value; setSource(next); if (next === destination) setDestination(SATELLITES.find((node) => node !== next)); }} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-200">{SATELLITES.map((node) => <option key={node}>{node}</option>)}</select><Button className="mt-3 w-full" onClick={() => createEvent('local')} disabled={busy}><Activity size={14}/> Record local event</Button></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="text-xs font-semibold text-white">2 · Send a message</div><p className="mt-1 text-xs leading-relaxed text-slate-500">Capture a vector snapshot after incrementing the sender's component.</p><label className="mt-4 block text-[10px] uppercase tracking-wider text-slate-500">Destination satellite</label><select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-200">{SATELLITES.filter((node) => node !== source).map((node) => <option key={node}>{node}</option>)}</select><Button className="mt-3 w-full" onClick={() => createEvent('send')} disabled={busy || source === destination}><Send size={14}/> Send vector message</Button></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 md:col-span-2"><div className="text-xs font-semibold text-white">3 · Deliver a pending message</div><p className="mt-1 text-xs leading-relaxed text-slate-500">The selected receiver must match the message destination. Duplicate deliveries are rejected.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="block text-[10px] uppercase tracking-wider text-slate-500">Pending message</label><select value={messageId} onChange={(e) => { setMessageId(e.target.value); const m = pending.find((item) => item.message_id === e.target.value); if (m) setReceiveNode(m.destination_id); }} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-200"><option value="">Choose pending message…</option>{pending.map((message) => <option key={message.message_id} value={message.message_id}>{message.message_id} · {message.source_id} → {message.destination_id}</option>)}</select></div><div><label className="block text-[10px] uppercase tracking-wider text-slate-500">Receiver</label><select value={receiveNode} onChange={(e) => setReceiveNode(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-200">{SATELLITES.map((node) => <option key={node}>{node}</option>)}</select></div></div><Button className="mt-3 w-full sm:w-auto" onClick={() => createEvent('receive')} disabled={busy || !messageId}><Radio size={14}/> Deliver and merge</Button></div></div>
      <div className="mt-4"><label className="block text-[10px] uppercase tracking-wider text-slate-500">Optional event description</label><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={180} placeholder="e.g. Thermal threshold crossed" className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-cyan-400/50"/></div></Panel>
      <Panel className="p-4 md:p-5"><Heading eyebrow="In-flight messages" title="Network queue" detail="Every queued message stores the exact vector captured at send time." icon={Radio}/><div className="mt-4 space-y-3">{state?.messages?.length ? state.messages.map((message) => <div key={message.message_id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-cyan-200">{message.message_id}</span><span className={'rounded-full border px-2 py-0.5 text-[9px] ' + (message.delivered ? 'border-emerald-400/20 text-emerald-200' : 'border-amber-400/20 text-amber-200')}>{message.delivered ? 'DELIVERED' : 'PENDING'}</span></div><div className="mt-2 flex items-center gap-2 text-xs text-slate-300"><span>{message.source_id}</span><ArrowRight size={13} className="text-slate-600"/><span>{message.destination_id}</span></div><div className="mt-2"><VectorPill vector={message.vector} compact/></div><div className="mt-2 text-[10px] text-slate-500">Snapshot from {message.send_event_id}</div></div>) : <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No messages have been sent. Send one to see its immutable payload here.</div>}</div></Panel>
    </div>}

    {tab === 'compare' && <div className="grid gap-5 2xl:grid-cols-[minmax(320px,.7fr)_minmax(0,1.3fr)]">
      <Panel className="p-4 md:p-5"><Heading eyebrow="Partial-order test" title="Choose two events" detail="Compare the vectors recorded at the events. The result is computed by the backend component by component." icon={GitCompare}/><div className="mt-5 space-y-4"><div><label className="block text-[10px] uppercase tracking-wider text-slate-500">Event A</label><select value={selectedA} onChange={(e) => setSelectedA(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-200"><option value="">Select event A…</option>{eventOptions.map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select></div><div className="flex justify-center"><span className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-500"><GitCompare size={16}/></span></div><div><label className="block text-[10px] uppercase tracking-wider text-slate-500">Event B</label><select value={selectedB} onChange={(e) => setSelectedB(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-200"><option value="">Select event B…</option>{eventOptions.map((event) => <option key={event.value} value={event.value}>{event.label}</option>)}</select></div><Button className="w-full" onClick={compareSelected} disabled={busy || !selectedA || !selectedB}><GitCompare size={14}/> Compare vector histories</Button><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-500">Tip: load the concurrency experiment to compare independent SAT-01 and SAT-02 events, or compare a message send with its receive event to prove causal order.</div></div></Panel>
      <Panel className="p-4 md:p-5"><Heading eyebrow="Explainable result" title="Causality verdict" detail="A verdict is backed by the actual vector components, not by timestamps or the visual left-to-right order." icon={ShieldCheck}/><div className="mt-5"><ComparisonResult result={comparison}/></div>{comparison && <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Vector A · {comparison.event_a || 'input'}</div><div className="mt-2"><VectorPill vector={comparison.vector_a}/></div></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Vector B · {comparison.event_b || 'input'}</div><div className="mt-2"><VectorPill vector={comparison.vector_b}/></div></div></div>}</Panel>
    </div>}

    {tab === 'evidence' && <div className="space-y-5"><Panel className="p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><Heading eyebrow="Append-only simulation trace" title="Mission evidence log" detail="Inspect each event's process, operation, vector before and after, and any message relationship. Export a JSON snapshot for reproducible analysis." icon={ShieldCheck}/><Button onClick={exportReport} disabled={!state}><Download size={14}/> Export JSON</Button></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Event</th><th className="px-3 py-3">Satellite / type</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Before</th><th className="px-3 py-3">After</th><th className="px-3 py-3">Message</th></tr></thead><tbody>{events.map((event) => <tr key={event.event_id} className="border-b border-slate-800/70 hover:bg-slate-800/30"><td className="px-3 py-3 font-mono text-xs text-slate-400">{event.event_id}</td><td className="px-3 py-3"><div className={'text-xs font-semibold ' + tone(event.node_id).text}>{event.node_id}</div><div className="mt-1 text-[9px] uppercase text-slate-500">{event.event_type}</div></td><td className="max-w-[230px] px-3 py-3 text-xs text-slate-300">{event.description}</td><td className="px-3 py-3"><span className="whitespace-nowrap font-mono text-[10px] text-slate-400">{vectorText(event.vector_before)}</span></td><td className="px-3 py-3"><span className="whitespace-nowrap font-mono text-[10px] text-cyan-200">{vectorText(event.vector)}</span></td><td className="px-3 py-3 font-mono text-[10px] text-slate-500">{event.message_id || '—'}</td></tr>)}</tbody></table>{events.length === 0 && <div className="p-8 text-center text-xs text-slate-500">The evidence log is empty. Run a scenario to populate it.</div>}</div></Panel><Panel className="p-4"><Heading eyebrow="Interpretation guardrails" title="What this report proves" detail="Vectors establish a partial order from the recorded event and message history. They are not physical timestamps, and concurrency does not mean events occurred at exactly the same instant." icon={ShieldCheck}/></Panel></div>}

    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-4 text-[10px] text-slate-600"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>{busy ? 'Updating simulation state…' : 'Backend-driven simulation state'}</span><span>Component order: SAT-01 · SAT-02 · SAT-03 · SAT-04 · SAT-05</span></div>
  </div>;
}
