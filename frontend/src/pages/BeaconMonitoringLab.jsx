import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Antenna, ArrowDown, CheckCircle2, Clock3, Gauge,
  Pause, Play, Radio, RefreshCw, RotateCcw, Satellite, Send, ShieldAlert,
  ShieldCheck, Signal, Terminal, TimerReset, WifiOff, Zap
} from 'lucide-react';

const API = '/api/algorithms/beacon';
const SATELLITES = ['SAT-01', 'SAT-02', 'SAT-03', 'SAT-04', 'SAT-05'];
const tones = {
  ACTIVE: { text: 'text-emerald-300', bg: 'bg-emerald-400/10', border: 'border-emerald-400/25', dot: 'bg-emerald-400' },
  SUSPECTED: { text: 'text-amber-300', bg: 'bg-amber-400/10', border: 'border-amber-400/25', dot: 'bg-amber-400' },
  OFFLINE: { text: 'text-rose-300', bg: 'bg-rose-400/10', border: 'border-rose-400/25', dot: 'bg-rose-400' }
};
const prettyEvent = (event) => ({
  BEACON_RECEIVED: 'BEACON RECEIVED', BEACON_TRANSMISSION_PAUSED: 'TRANSMITTER PAUSED',
  NODE_SUSPECTED: 'NODE SUSPECTED', NODE_OFFLINE: 'NODE OFFLINE',
  NODE_RECOVERED: 'NODE RECOVERED', CONFIG_UPDATED: 'CONFIG UPDATED',
  LAB_RESET: 'LAB RESET', SIMULATION_ADVANCED: 'CLOCK ADVANCED'
}[event] || event?.replaceAll('_', ' ') || 'EVENT');

function Panel({ children, className = '' }) {
  return <section className={'rounded-2xl border border-slate-800/90 bg-slate-900/70 shadow-[0_12px_35px_rgba(0,0,0,.14)] ' + className}>{children}</section>;
}
function SectionTitle({ eyebrow, title, detail, icon: Icon }) {
  return <div className="flex items-start gap-3"><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200"><Icon size={18}/></div><div><div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">{eyebrow}</div><h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>{detail && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">{detail}</p>}</div></div>;
}
function StatePill({ state }) {
  const t = tones[state] || tones.ACTIVE;
  return <span className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ' + t.text + ' ' + t.bg + ' ' + t.border}><span className={'h-1.5 w-1.5 rounded-full ' + t.dot + (state === 'ACTIVE' ? ' animate-pulse' : '')}/>{state}</span>;
}
function ActionButton({ children, onClick, variant = 'default', disabled = false }) {
  const style = variant === 'primary' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20'
    : variant === 'danger' ? 'border-rose-400/25 bg-rose-400/5 text-rose-200 hover:bg-rose-400/10'
    : 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80';
  return <button type="button" onClick={onClick} disabled={disabled} className={'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ' + style}>{children}</button>;
}
function Metric({ label, value, sub, icon: Icon, accent = 'cyan' }) {
  const colors = { cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200', green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200', rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200' };
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[.15em] text-slate-500">{label}</span><span className={'rounded-lg border p-1.5 ' + colors[accent]}><Icon size={15}/></span></div><div className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{value}</div><div className="mt-1 text-[11px] text-slate-500">{sub}</div></div>;
}

export default function BeaconMonitoringLab() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState('SAT-02');
  const [config, setConfig] = useState({ interval_seconds: 2, suspect_after_seconds: 6, offline_after_seconds: 12 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(API + '/status');
      if (!response.ok) throw new Error('Beacon service returned HTTP ' + response.status);
      const result = await response.json();
      setData(result);
      setError('');
    } catch (e) { setError(e.message || 'Could not connect to the beacon API.'); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const node = data?.nodes?.find(n => n.satellite_id === selected);
  const events = data?.events || [];
  const latestPayload = node?.last_payload;
  const doAction = async (action, satelliteId = selected, seconds = 1) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(API + '/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satellite_id: satelliteId, action, seconds })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Simulation action failed.');
      setData(result); setNotice(action === 'pause' ? satelliteId + ' beacon transmitter paused.' : action === 'resume' ? satelliteId + ' recovered after a fresh beacon.' : action === 'advance' ? 'Simulation advanced by ' + seconds + ' seconds.' : 'Beacon action completed.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const applyConfig = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(API + '/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Configuration rejected.');
      setData(result); setConfig(result.config); setNotice('Timing thresholds applied to the simulation.');
    } catch (e2) { setError(e2.message); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(API + '/reset', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Reset failed.');
      setData(result); setConfig(result.config); setSelected('SAT-02'); setNotice('Lab reset. All five simulated satellites are ACTIVE.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const timeline = useMemo(() => [...events].slice(0, 10), [events]);
  const tabs = [{ id: 'overview', label: 'Mission overview', icon: Satellite }, { id: 'experiment', label: 'Failure experiment', icon: Zap }, { id: 'protocol', label: 'Protocol inspector', icon: Terminal }, { id: 'evidence', label: 'Incident evidence', icon: ShieldCheck }];
  const count = data?.counts || { ACTIVE: 0, SUSPECTED: 0, OFFLINE: 0 };

  return <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
    <div className="relative isolate overflow-hidden rounded-3xl border border-cyan-900/50 bg-slate-950">
      <div className="absolute inset-0 -z-20 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1800&q=85')" }}/>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/35"/>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/95 via-transparent to-slate-950/15"/>
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_.6fr] lg:items-end">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-200"><Radio size={13}/> Distributed systems laboratory</span><span className="rounded-full border border-slate-600/70 bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-300">Protocol 04 · Liveness</span></div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Beacon Monitoring <span className="text-cyan-300">Lab</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Observe periodic liveness announcements across a five-satellite constellation. Pause a transmitter, watch the suspicion timer cross its threshold, observe offline classification, then restore communication with a fresh beacon.</p>
          <div className="mt-5 flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-black/30 px-3 py-2 text-xs text-slate-200"><Signal size={14} className="text-emerald-300"/> Sequence-numbered beacons</span><span className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-black/30 px-3 py-2 text-xs text-slate-200"><TimerReset size={14} className="text-amber-300"/> Two-stage timeout</span><span className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-black/30 px-3 py-2 text-xs text-slate-200"><ShieldCheck size={14} className="text-cyan-300"/> Isolated simulation</span></div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.2em] text-slate-400">Constellation link</span><span className="flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"/> SIMULATION READY</span></div>
          <div className="mt-4 grid grid-cols-5 gap-2">{(data?.nodes || []).map(n => <button key={n.satellite_id} onClick={() => setSelected(n.satellite_id)} title={'Inspect ' + n.satellite_id} className={'flex flex-col items-center gap-2 rounded-xl border p-2 transition ' + (selected === n.satellite_id ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-slate-800 bg-black/20 hover:border-slate-600')}><Satellite size={18} className={tones[n.state]?.text || 'text-slate-300'}/><span className="text-[9px] font-bold text-slate-300">{n.satellite_id.replace('SAT-', '')}</span><span className={'h-1.5 w-1.5 rounded-full ' + (tones[n.state]?.dot || 'bg-slate-500')}/></button>)}</div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs"><span className="text-slate-500">Current selection</span><span className="font-mono text-cyan-200">{selected}</span></div>
          <div className="mt-2 text-[10px] leading-relaxed text-slate-500">Illustrative orbital photography · simulated telemetry, not a live spacecraft feed.</div>
        </div>
      </div>
    </div>

    {error && <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><div><strong>Service notice</strong><p className="mt-1 text-xs">{error}</p></div></div>}
    {notice && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200">{notice}</div>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Active nodes" value={count.ACTIVE} sub="Fresh beacon within threshold" icon={CheckCircle2} accent="green"/>
      <Metric label="Suspected" value={count.SUSPECTED} sub="Suspicion timeout crossed" icon={ShieldAlert} accent="amber"/>
      <Metric label="Offline" value={count.OFFLINE} sub="Offline timeout crossed" icon={WifiOff} accent="rose"/>
      <Metric label="Beacon interval" value={(data?.config?.interval_seconds ?? 2) + ' s'} sub={'Lab elapsed ' + (data?.simulation_elapsed_seconds ?? 0).toFixed(1) + ' seconds'} icon={Gauge}/>
    </div>

    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">{tabs.map(t => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ' + (tab === t.id ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100' : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900')}><Icon size={15}/>{t.label}</button>; })}<div className="ml-auto flex items-center gap-2"><button onClick={() => setAutoRefresh(v => !v)} className={'rounded-lg border px-3 py-2 text-[10px] ' + (autoRefresh ? 'border-emerald-400/20 text-emerald-200' : 'border-slate-700 text-slate-400')}>{autoRefresh ? '● Live refresh' : 'Ⅱ Refresh paused'}</button><ActionButton onClick={reset} disabled={busy}><RotateCcw size={14}/> Reset lab</ActionButton></div></div>

    {tab === 'overview' && <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Panel className="p-5"><SectionTitle eyebrow="Live constellation" title="Node liveness board" detail="Select a satellite to inspect its last accepted beacon, current state, and time elapsed since reception." icon={Satellite}/>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{(data?.nodes || []).map(n => <button key={n.satellite_id} onClick={() => setSelected(n.satellite_id)} className={'rounded-2xl border p-4 text-left transition ' + (selected === n.satellite_id ? 'border-cyan-400/40 bg-cyan-400/[.06]' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700')}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className={'rounded-xl border p-2.5 ' + (tones[n.state]?.bg || '') + ' ' + (tones[n.state]?.border || '')}><Satellite size={19} className={tones[n.state]?.text}/></div><div><div className="text-sm font-semibold text-slate-100">{n.satellite_id}</div><div className="mt-1 text-[10px] text-slate-500">Sequence #{n.sequence} · Leader {n.leader_id}</div></div></div><StatePill state={n.state}/></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-black/20 p-2.5"><div className="text-[9px] uppercase tracking-wider text-slate-500">Silence duration</div><div className="mt-1 font-mono text-lg text-slate-200">{n.seconds_since_beacon.toFixed(1)}<span className="ml-1 text-[10px] text-slate-500">sec</span></div></div><div className="rounded-lg bg-black/20 p-2.5"><div className="text-[9px] uppercase tracking-wider text-slate-500">Battery summary</div><div className="mt-1 font-mono text-lg text-slate-200">{n.telemetry.battery}%</div></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={'h-full rounded-full transition-all ' + (n.state === 'OFFLINE' ? 'bg-rose-400' : n.state === 'SUSPECTED' ? 'bg-amber-400' : 'bg-emerald-400')} style={{ width: Math.min(100, n.seconds_since_beacon / Math.max(1, data.config.offline_after_seconds) * 100) + '%' }}/></div><div className="mt-2 flex justify-between text-[9px] text-slate-500"><span>Last beacon age</span><span>Offline threshold {data.config.offline_after_seconds}s</span></div></button>)}</div>
      </Panel>
      <div className="space-y-5">
        <Panel className="p-5"><SectionTitle eyebrow="Selected node" title={selected + ' · Beacon status'} detail="The monitor classifies liveness using elapsed time since the last accepted beacon." icon={Activity}/>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div><div className="text-[10px] uppercase tracking-wider text-slate-500">Current classification</div><div className="mt-2"><StatePill state={node?.state || 'ACTIVE'}/></div></div><div className="text-right"><div className="font-mono text-2xl text-white">{node?.seconds_since_beacon?.toFixed(1) ?? '—'}<span className="ml-1 text-xs text-slate-500">s</span></div><div className="text-[10px] text-slate-500">since last beacon</div></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><ActionButton onClick={() => doAction('pause')} disabled={busy || node?.paused} variant="danger"><Pause size={14}/> Pause transmitter</ActionButton><ActionButton onClick={() => doAction('resume')} disabled={busy || !node?.paused} variant="primary"><Play size={14}/> Resume / recover</ActionButton><ActionButton onClick={() => doAction('send')} disabled={busy}><Send size={14}/> Send beacon now</ActionButton><ActionButton onClick={() => doAction('advance', selected, 1)} disabled={busy}><Clock3 size={14}/> Step +1 second</ActionButton></div>
          {node?.paused && <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-200">Transmitter is paused. Time continues to pass; no fresh sequence will arrive until resumed.</p>}
        </Panel>
        <Panel className="p-5"><SectionTitle eyebrow="Detection policy" title="Two timeout thresholds" detail="A missing beacon creates suspicion first; only a longer silence produces OFFLINE." icon={TimerReset}/>
          <div className="mt-5 space-y-4"><div><div className="mb-1.5 flex justify-between text-xs"><span className="text-amber-200">Suspicion threshold</span><span className="font-mono text-slate-300">{data?.config?.suspect_after_seconds ?? 6}s</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-amber-400" style={{ width: (data?.config?.suspect_after_seconds / data?.config?.offline_after_seconds * 100 || 50) + '%' }}/></div></div><div><div className="mb-1.5 flex justify-between text-xs"><span className="text-rose-200">Offline threshold</span><span className="font-mono text-slate-300">{data?.config?.offline_after_seconds ?? 12}s</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-full w-full rounded-full bg-rose-400"/></div></div></div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-400"><strong className="text-slate-200">Important:</strong> SUSPECTED is a failure detector's estimate, not proof of a crash. Delay, packet loss, or congestion can look like failure.</div>
        </Panel>
      </div>
    </div>}

    {tab === 'experiment' && <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <Panel className="p-5"><SectionTitle eyebrow="Controlled experiment" title="Create a missed-beacon incident" detail="Use the controls to interrupt only one simulated transmitter while other satellites continue beaconing." icon={Zap}/>
        <label className="mt-5 block text-[10px] uppercase tracking-wider text-slate-500">Target satellite</label><div className="mt-2 grid grid-cols-5 gap-2">{SATELLITES.map(id => <button key={id} onClick={() => setSelected(id)} className={'rounded-lg border py-2 text-xs font-semibold ' + (selected === id ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100' : 'border-slate-800 bg-slate-950/60 text-slate-400')}>{id.slice(-2)}</button>)}</div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><ActionButton onClick={() => doAction('pause')} disabled={busy || node?.paused} variant="danger"><Pause size={14}/> 1 · Pause beacons</ActionButton><ActionButton onClick={() => doAction('advance', selected, 3)} disabled={busy}><Clock3 size={14}/> 2 · Advance +3s</ActionButton><ActionButton onClick={() => doAction('advance', selected, 3)} disabled={busy}><Clock3 size={14}/> 3 · Advance +3s</ActionButton><ActionButton onClick={() => doAction('advance', selected, 6)} disabled={busy}><TimerReset size={14}/> 4 · Advance +6s</ActionButton><ActionButton onClick={() => doAction('resume')} disabled={busy || !node?.paused} variant="primary"><Play size={14}/> 5 · Recover node</ActionButton><ActionButton onClick={reset} disabled={busy}><RotateCcw size={14}/> Restart scenario</ActionButton></div>
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500">Expected observation</div><ol className="mt-3 space-y-3 text-xs leading-relaxed text-slate-300"><li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 font-mono text-[10px] text-cyan-200">01</span>Node stops emitting periodic beacons, but its last received timestamp remains unchanged.</li><li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 font-mono text-[10px] text-amber-200">02</span>At the suspicion threshold, the monitor records <code>SUSPECTED</code>.</li><li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-400/10 font-mono text-[10px] text-rose-200">03</span>At the longer offline threshold, the monitor records <code>OFFLINE</code>.</li><li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 font-mono text-[10px] text-emerald-200">04</span>A fresh sequence on resume restores <code>ACTIVE</code>; other nodes remain independent.</li></ol></div>
      </Panel>
      <Panel className="p-5"><SectionTitle eyebrow="Timing configuration" title="Tune the detector" detail="Demo defaults are a 2-second beacon interval, suspicion after 6 seconds, and offline after 12 seconds." icon={Gauge}/>
        <form onSubmit={applyConfig} className="mt-5 space-y-5">{[{ key: 'interval_seconds', label: 'Beacon interval', min: .5, max: 10, step: .5, note: 'How often each active transmitter sends an announcement.' }, { key: 'suspect_after_seconds', label: 'Suspect after', min: 1, max: 60, step: 1, note: 'Elapsed silence before the node is marked SUSPECTED.' }, { key: 'offline_after_seconds', label: 'Offline after', min: 2, max: 120, step: 1, note: 'Longer silence before the node is classified OFFLINE.' }].map(item => <div key={item.key}><div className="flex items-center justify-between gap-3"><label htmlFor={item.key} className="text-sm font-medium text-slate-200">{item.label}</label><div className="flex items-center gap-1"><input id={item.key} type="number" min={item.min} max={item.max} step={item.step} value={config[item.key]} onChange={e => setConfig(c => ({ ...c, [item.key]: Number(e.target.value) }))} className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-right font-mono text-sm text-cyan-100 outline-none focus:border-cyan-400/50"/><span className="text-xs text-slate-500">sec</span></div></div><input aria-label={item.label + ' slider'} type="range" min={item.min} max={item.max} step={item.step} value={config[item.key]} onChange={e => setConfig(c => ({ ...c, [item.key]: Number(e.target.value) }))} className="mt-3 w-full accent-cyan-400"/><p className="mt-1 text-[10px] text-slate-500">{item.note}</p></div>)}<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 font-mono text-[11px] text-slate-400">VALIDATION: interval &gt; 0 · 0 &lt; suspect timeout &lt; offline timeout</div><button type="submit" disabled={busy || !(config.interval_seconds > 0 && config.suspect_after_seconds > 0 && config.suspect_after_seconds < config.offline_after_seconds)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-40"><CheckCircle2 size={15}/> Apply detector configuration</button></form>
      </Panel>
    </div>}

    {tab === 'protocol' && <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <Panel className="p-5"><SectionTitle eyebrow="Protocol inspector" title="Latest beacon payload" detail="Inspect the sequence, sender state, leader metadata, and telemetry summary for the selected satellite." icon={Terminal}/>
        <div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-400">{selected} · latest accepted message</span><StatePill state={node?.state || 'ACTIVE'}/></div>
        <pre className="mt-3 max-h-[440px] overflow-auto rounded-xl border border-slate-800 bg-[#050a12] p-4 text-[11px] leading-6 text-cyan-100">{JSON.stringify(latestPayload || { satellite_id: selected, sequence: 0, status: 'WAITING_FOR_BEACON' }, null, 2)}</pre>
        <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">Current sequence</div><div className="mt-1 font-mono text-xl text-white">{node?.sequence ?? 0}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">Leader term</div><div className="mt-1 font-mono text-xl text-white">{node?.leader_term ?? 1}</div></div></div>
      </Panel>
      <Panel className="p-5"><SectionTitle eyebrow="Algorithm walkthrough" title="How a beacon becomes a state" detail="The backend is the authoritative state machine; the browser renders its returned status and event history." icon={Activity}/>
        <div className="mt-5 space-y-3">{[{n:'01',title:'Receive and validate',body:'Accept a beacon from a known satellite, record its increasing sequence and last-received monotonic time.',color:'border-cyan-400/30 bg-cyan-400/5'},{n:'02',title:'Measure elapsed silence',body:'Compute elapsed = monotonic_now − last_received_monotonic. Wall-clock adjustments do not change timeout decisions.',color:'border-slate-700 bg-slate-950/60'},{n:'03',title:'Evaluate suspicion',body:'If elapsed ≥ suspect threshold but < offline threshold, publish NODE_SUSPECTED. This is an estimate, not proof of failure.',color:'border-amber-400/25 bg-amber-400/5'},{n:'04',title:'Escalate or recover',body:'If elapsed ≥ offline threshold, classify OFFLINE. A fresh beacon with a newer sequence resets the timer and restores ACTIVE.',color:'border-emerald-400/25 bg-emerald-400/5'}].map(s => <div key={s.n} className={'flex gap-3 rounded-xl border p-4 ' + s.color}><span className="font-mono text-xs text-slate-500">{s.n}</span><div><div className="text-sm font-semibold text-slate-100">{s.title}</div><p className="mt-1 text-xs leading-relaxed text-slate-400">{s.body}</p></div></div>)}</div>
        <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[.04] p-4"><div className="text-[10px] uppercase tracking-[.18em] text-cyan-200">State rule</div><div className="mt-2 grid gap-2 text-xs sm:grid-cols-3"><div className="rounded-lg bg-slate-950/70 p-3"><div className="text-emerald-200">ACTIVE</div><code className="mt-1 block text-slate-300">t &lt; S</code></div><div className="rounded-lg bg-slate-950/70 p-3"><div className="text-amber-200">SUSPECTED</div><code className="mt-1 block text-slate-300">S ≤ t &lt; O</code></div><div className="rounded-lg bg-slate-950/70 p-3"><div className="text-rose-200">OFFLINE</div><code className="mt-1 block text-slate-300">t ≥ O</code></div></div><p className="mt-3 text-[10px] text-slate-500">S = suspicion timeout · O = offline timeout · t = silence duration</p></div>
      </Panel>
    </div>}

    {tab === 'evidence' && <Panel className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><SectionTitle eyebrow="Operational evidence" title="Beacon incident timeline" detail="Newest events first. Use the sequence number and elapsed time to explain why each state transition occurred." icon={ShieldCheck}/><span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-slate-400">{events.length} retained events</span></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-slate-800 text-[9px] uppercase tracking-[.15em] text-slate-500"><th className="px-3 py-3">Elapsed</th><th className="px-3 py-3">Event</th><th className="px-3 py-3">Satellite</th><th className="px-3 py-3">Evidence / interpretation</th></tr></thead><tbody>{timeline.map((event, index) => <tr key={event.event_id || index} className="border-b border-slate-800/70 last:border-0"><td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-slate-400">+{event.elapsed_seconds}s</td><td className="px-3 py-3"><span className={'rounded-md border px-2 py-1 text-[9px] font-bold ' + (event.event_type === 'NODE_OFFLINE' ? tones.OFFLINE.text + ' ' + tones.OFFLINE.border : event.event_type === 'NODE_SUSPECTED' ? tones.SUSPECTED.text + ' ' + tones.SUSPECTED.border : event.event_type === 'NODE_RECOVERED' || event.event_type === 'BEACON_RECEIVED' ? tones.ACTIVE.text + ' ' + tones.ACTIVE.border : 'border-slate-700 text-slate-400')}>{prettyEvent(event.event_type)}</span></td><td className="px-3 py-3 font-mono text-xs text-cyan-100">{event.satellite_id || 'SYSTEM'}</td><td className="max-w-lg px-3 py-3 text-xs leading-relaxed text-slate-400">{event.message}{event.sequence ? <span className="ml-2 font-mono text-slate-500">seq #{event.sequence}</span> : null}</td></tr>)}</tbody></table></div>
      {!events.length && <div className="py-10 text-center text-sm text-slate-500">Events will appear as the simulation runs.</div>}
    </Panel>}

    <div className="grid gap-4 md:grid-cols-2">
      <Panel className="flex gap-3 p-4"><div className="h-fit rounded-xl border border-amber-400/20 bg-amber-400/10 p-2 text-amber-200"><AlertTriangle size={17}/></div><div><div className="text-sm font-semibold text-slate-100">Failure detector, not an oracle</div><p className="mt-1 text-xs leading-relaxed text-slate-400">A silent node may be crashed, partitioned, delayed, or unable to send. Thresholds trade detection speed against false suspicion.</p></div></Panel>
      <Panel className="flex gap-3 p-4"><div className="h-fit rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200"><Antenna size={17}/></div><div><div className="text-sm font-semibold text-slate-100">Safe, isolated classroom simulation</div><p className="mt-1 text-xs leading-relaxed text-slate-400">These controls pause only simulated beacon transmission. The lab does not stop containers or alter the main satellite registry's heartbeat status.</p></div></Panel>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4 text-[10px] text-slate-600"><span>MISSION CONTROL / DISTRIBUTED ALGORITHMS / BEACON MONITOR</span><span className="flex items-center gap-1.5"><RefreshCw size={11}/> {autoRefresh ? 'Refreshing each second' : 'Manual refresh mode'}</span></div>
  </div>;
}
