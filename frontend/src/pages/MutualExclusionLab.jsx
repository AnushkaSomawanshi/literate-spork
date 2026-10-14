import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, LockKeyhole, Radio,
  RadioTower, RefreshCw, RotateCcw, Satellite, Send, ShieldCheck, Unlock,
  Waves, Zap
} from 'lucide-react';

const API = '/api/algorithms/mutual-exclusion';
const SATELLITES = ['SAT-01', 'SAT-02', 'SAT-03', 'SAT-04', 'SAT-05'];
const COLORS = {
  'SAT-01': 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  'SAT-02': 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  'SAT-03': 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  'SAT-04': 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  'SAT-05': 'border-rose-400/30 bg-rose-400/10 text-rose-200'
};
const fmtTime = (value) => value == null ? '—' : 'T+' + value;

function Panel({ children, className = '' }) {
  return <section className={'rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/10 ' + className}>{children}</section>;
}
function Button({ children, onClick, disabled = false, kind = 'primary' }) {
  const style = kind === 'danger'
    ? 'border-rose-400/25 bg-rose-400/5 text-rose-200 hover:bg-rose-400/10'
    : kind === 'secondary'
      ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700'
      : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20';
  return <button type="button" onClick={onClick} disabled={disabled} className={'inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ' + style}>{children}</button>;
}
function Metric({ label, value, detail, icon: Icon, accent = 'cyan' }) {
  const tone = { cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200', green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200' }[accent];
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"><div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500"><span>{label}</span><span className={'rounded-lg border p-1.5 ' + tone}><Icon size={15}/></span></div><div className="mt-2 text-2xl font-semibold text-slate-100">{value}</div><div className="mt-1 text-[10px] text-slate-500">{detail}</div></div>;
}

export default function MutualExclusionLab() {
  const [state, setState] = useState(null);
  const [satellite, setSatellite] = useState('SAT-01');
  const [description, setDescription] = useState('Emergency thermal alert uplink');
  const [tab, setTab] = useState('mission');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (path, body) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(API + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Request failed');
      if (data.state) setState(data.state);
      else setState(data);
      return data;
    } catch (e) {
      setError(e.message || 'Mission-control API is unavailable. Start the backend and try again.');
      return null;
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { request('/state'); }, [request]);

  const loadScenario = async () => {
    const data = await request('/scenario/simultaneous-requests', {});
    if (data) setNotice('Radio traffic scenario loaded. Inspect the request, reply, and deferred-reply trace.');
  };
  const requestAccess = async () => {
    const data = await request('/request', { satellite_id: satellite, description: description.trim() || 'Request priority uplink access' });
    if (data) setNotice(satellite + ' broadcast a REQUEST. Entry is granted only after all four peer permissions arrive.');
  };
  const release = async () => {
    const owner = state?.resource_owner;
    if (!owner) return;
    const data = await request('/release/' + owner, {});
    if (data) setNotice(owner + ' released the shared uplink. Deferred replies were processed.');
  };
  const reset = async () => {
    const data = await request('/reset', {});
    if (data) setNotice('Simulation reset. All satellites are idle and the uplink is available.');
  };

  const processes = state?.processes || {};
  const events = state?.events || [];
  const owner = state?.resource_owner;
  const activeCount = Object.values(processes).filter(p => p.in_critical_section).length;
  const pending = Object.entries(processes).filter(([, p]) => p.requesting && !p.in_critical_section);
  const tabs = [['mission', 'Mission console'], ['protocol', 'Protocol walkthrough'], ['evidence', 'Radio & event log']];

  return <div className="mx-auto max-w-[1500px] space-y-5 pb-8">
    <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-cyan-400/10"/><div className="pointer-events-none absolute -right-4 -top-12 h-48 w-48 rounded-full border border-cyan-400/10"/>
      <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-7">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300"/> Simulation environment</span><span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-400">5 satellite processes · Ricart–Agrawala</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Shared Resource Access Lab</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Mission Control radio discipline: coordinate access to a shared priority uplink so only one satellite controls the channel at a time.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1.5"><Radio size={12}/> REQUEST / REPLY</span><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1.5"><Clock3 size={12}/> Logical timestamp priority</span><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1.5"><ShieldCheck size={12}/> Critical-section safety</span></div>
        </div>
        <div className="flex flex-wrap gap-2"><Button onClick={loadScenario} disabled={busy}><Zap size={14}/> Simultaneous requests</Button><Button kind="secondary" onClick={() => request('/state')} disabled={busy}><RefreshCw size={14}/> Refresh</Button><Button kind="secondary" onClick={reset} disabled={busy}><RotateCcw size={14}/> Reset lab</Button></div>
      </div>
    </div>

    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-200"><AlertTriangle size={15}/><span>{error}</span><button className="ml-auto underline" onClick={() => setError('')}>Dismiss</button></div>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-100"><CheckCircle2 size={15}/><span>{notice}</span><button className="ml-auto underline" onClick={() => setNotice('')}>Dismiss</button></div>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Participating satellites" value="05" detail="One process per satellite" icon={Satellite}/>
      <Metric label="Resource owner" value={owner || 'NONE'} detail={owner ? 'Exclusive uplink control' : 'Priority uplink available'} icon={LockKeyhole} accent={owner ? 'amber' : 'green'}/>
      <Metric label="Waiting requests" value={String(pending.length).padStart(2, '0')} detail="Awaiting permissions / entry" icon={RadioTower}/>
      <Metric label="Safety invariant" value={state?.safety_ok ? 'PASS' : 'CHECK'} detail={activeCount + ' process(es) in critical section'} icon={ShieldCheck} accent={state?.safety_ok ? 'green' : 'amber'}/>
    </div>

    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-1.5">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={'shrink-0 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition ' + (tab === id ? 'bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-400/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200')}>{label}</button>)}</div>

    {tab === 'mission' && <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
      <Panel className="p-4 md:p-5">
        <div className="flex items-start gap-3"><span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200"><RadioTower size={18}/></span><div><div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">Shared mission resource</div><h2 className="mt-1 text-lg font-semibold text-white">Priority uplink channel</h2><p className="mt-1 text-sm leading-relaxed text-slate-400">Simulated radio resource for emergency alerts and telemetry bursts. Only the current owner may enter the critical section.</p></div></div>
        <div className={'my-5 rounded-2xl border p-4 ' + (owner ? 'border-amber-400/30 bg-amber-400/5' : 'border-emerald-400/20 bg-emerald-400/5')}>
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left"><div className={'rounded-2xl border p-4 ' + (owner ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200')}>{owner ? <LockKeyhole size={28}/> : <Unlock size={28}/>}</div><div className="flex-1"><div className="text-[10px] uppercase tracking-widest text-slate-500">Channel status</div><div className="mt-1 text-xl font-semibold text-white">{owner ? 'CHANNEL RESERVED' : 'CHANNEL AVAILABLE'}</div><div className="mt-1 text-xs text-slate-400">{owner ? owner + ' currently has exclusive access.' : 'No satellite currently holds the critical section.'}</div></div><span className={'rounded-full border px-3 py-1.5 text-[10px] font-semibold ' + (owner ? 'border-amber-400/30 text-amber-200' : 'border-emerald-400/30 text-emerald-200')}>{owner ? 'IN USE' : 'READY'}</span></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SATELLITES.map(node => { const p = processes[node] || {}; return <div key={node} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"><div className="flex items-center justify-between gap-2"><span className={'rounded-lg border px-2 py-1 text-xs font-semibold ' + COLORS[node]}><Satellite size={12} className="mr-1 inline"/>{node}</span><span className={'rounded-full border px-2 py-1 text-[9px] ' + (p.in_critical_section ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : p.requesting ? 'border-cyan-400/25 bg-cyan-400/5 text-cyan-200' : 'border-slate-700 text-slate-500')}>{p.status || 'IDLE'}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-slate-900 p-2"><div className="text-[9px] uppercase text-slate-500">Logical clock</div><div className="mt-1 font-mono text-sm text-slate-200">{fmtTime(state?.logical_clock?.[node])}</div></div><div className="rounded-lg bg-slate-900 p-2"><div className="text-[9px] uppercase text-slate-500">Permissions</div><div className="mt-1 font-mono text-sm text-slate-200">{p.permissions_count || 0}/4</div></div></div><div className="mt-2 text-[10px] text-slate-500">{p.in_critical_section ? 'Transmitting under exclusive access' : p.deferred_replies?.length ? 'Deferring ' + p.deferred_replies.length + ' reply(s)' : p.requesting ? 'Waiting for peer coordination' : 'Listening for mission traffic'}</div></div>; })}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel className="p-4 md:p-5"><div className="flex items-start gap-3"><span className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-2.5 text-violet-200"><Send size={18}/></span><div><div className="text-[10px] uppercase tracking-[.2em] text-violet-300/70">Uplink request console</div><h2 className="mt-1 text-lg font-semibold text-white">Request channel access</h2><p className="mt-1 text-sm text-slate-400">Choose the satellite sending a request to the constellation.</p></div></div>
          <label className="mt-5 block text-[10px] uppercase tracking-wider text-slate-500">Requesting satellite</label><select value={satellite} onChange={e => setSatellite(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-200">{SATELLITES.map(node => <option key={node}>{node}</option>)}</select>
          <label className="mt-4 block text-[10px] uppercase tracking-wider text-slate-500">Radio transmission purpose</label><select value={description} onChange={e => setDescription(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-slate-200"><option>Emergency thermal alert uplink</option><option>High-resolution image upload</option><option>Routine telemetry batch</option><option>Ground-station command acknowledgement</option><option>Orbital correction status packet</option></select>
          <Button onClick={requestAccess} disabled={busy || !!processes[satellite]?.requesting || !!processes[satellite]?.in_critical_section}><Radio size={14}/> Broadcast REQUEST</Button>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-500">Ricart–Agrawala requires permission from every other participating satellite. For five healthy nodes, the requester needs four REPLY messages before entering the critical section.</div>
          {owner && <Button kind="danger" onClick={release} disabled={busy}><Unlock size={14}/> Release {owner}'s uplink</Button>}
        </Panel>
        <Panel className="p-4"><div className="flex items-start gap-3"><Waves size={18} className="text-cyan-200"/><div><h3 className="text-sm font-semibold text-white">Radio discipline</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">Requests use logical timestamps. Equal timestamps are broken by satellite ID. A node defers its reply when its own outstanding request has priority or it currently holds the channel.</p></div></div></Panel>
      </div>
    </div>}

    {tab === 'protocol' && <div className="grid gap-5 lg:grid-cols-2">
      <Panel className="p-4 md:p-5"><div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">Protocol walkthrough</div><h2 className="mt-1 text-lg font-semibold text-white">From radio request to exclusive transmission</h2><p className="mt-1 text-sm text-slate-400">Ricart–Agrawala is a distributed permission-based mutual exclusion algorithm.</p><div className="mt-5 space-y-3">{[['01','REQUEST','A satellite increments its logical clock and broadcasts a timestamped request to all other participating satellites.'],['02','PRIORITY CHECK','Each peer compares request priority using (logical timestamp, satellite ID). The earlier tuple has priority.'],['03','REPLY or DEFER','A peer replies immediately unless it is in the critical section or its own request has priority.'],['04','ENTER CRITICAL SECTION','The requester enters only after collecting replies from all four other satellites.'],['05','RELEASE & DEFERRED REPLIES','After transmission, the owner releases the channel and sends replies it previously deferred.']].map(([n,title,detail]) => <div key={n} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/5 font-mono text-xs text-cyan-200">{n}</span><div><div className="text-xs font-semibold text-white">{title}</div><p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p></div></div>)}</div></Panel>
      <Panel className="p-4 md:p-5"><div className="text-[10px] uppercase tracking-[.2em] text-emerald-300/70">Safety & liveness</div><h2 className="mt-1 text-lg font-semibold text-white">What the lab verifies</h2><div className="mt-4 space-y-3"><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><ShieldCheck size={16}/> Mutual exclusion safety</div><p className="mt-1 text-xs leading-relaxed text-slate-400">At most one process may be marked inside the critical section at any moment. The dashboard checks this invariant after each operation.</p></div><div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Activity size={16}/> Liveness assumptions</div><p className="mt-1 text-xs leading-relaxed text-slate-400">Progress assumes participating nodes remain responsive and messages eventually arrive. A crashed or unreachable node can prevent a requester from receiving all permissions in the basic algorithm.</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="text-xs font-semibold text-white">What this simulation is—and isn't</div><p className="mt-1 text-xs leading-relaxed text-slate-400">This is an in-memory teaching model of the protocol. It does not reserve real radio hardware, persist state across backend restarts, or provide failure-tolerant distributed locking.</p></div></div></Panel>
    </div>}

    {tab === 'evidence' && <Panel className="p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">Protocol evidence</div><h2 className="mt-1 text-lg font-semibold text-white">Radio traffic & event ledger</h2><p className="mt-1 text-sm text-slate-400">Every simulation step is recorded with its protocol type, satellite, and relevant request metadata.</p></div><span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400">{events.length} events recorded</span></div>
      <div className="mt-5 space-y-2">{events.slice().reverse().map(event => <div key={event.event_id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-start"><div className="flex items-center gap-2 sm:w-32"><span className="font-mono text-[10px] text-slate-500">{event.event_id}</span><span className={'rounded-md border px-2 py-1 text-[9px] font-semibold ' + (event.type === 'ENTER' ? 'border-emerald-400/25 bg-emerald-400/5 text-emerald-200' : event.type === 'DEFER' ? 'border-amber-400/25 bg-amber-400/5 text-amber-200' : 'border-slate-700 text-slate-300')}>{event.type}</span></div><div className="flex-1"><div className="text-xs text-slate-200">{event.message}</div><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500"><span>{event.satellite}</span>{event.timestamp != null && <span>Logical timestamp: {event.timestamp}</span>}{event.request_for && <span>For: {event.request_for}</span>}{event.permissions != null && <span>Permissions: {event.permissions}/4</span>}</div></div></div>)}{events.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center"><Radio className="mx-auto text-slate-600" size={25}/><p className="mt-3 text-xs text-slate-500">No radio traffic yet. Request access or load the simultaneous-request scenario.</p></div>}</div>
    </Panel>}

    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4 text-[10px] text-slate-600"><span className="flex items-center gap-2"><span className={'h-1.5 w-1.5 rounded-full ' + (state ? 'bg-emerald-400' : 'bg-amber-400')}/>{busy ? 'Updating protocol simulation…' : 'Backend-driven protocol simulation'}</span><span>Shared resource: simulated priority uplink · Nodes: SAT-01—SAT-05</span></div>
  </div>;
}
