import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  CheckCircle2, Clock3, Gauge, Play, RefreshCw, Satellite, ShieldCheck,
  Signal, SlidersHorizontal, TimerReset, Waves, XCircle
} from 'lucide-react';

const SATELLITES = ['SAT-01', 'SAT-02', 'SAT-03', 'SAT-04', 'SAT-05'];
const DEFAULT_OFFSETS = { 'SAT-01': 200, 'SAT-02': -150, 'SAT-03': 500, 'SAT-04': -300, 'SAT-05': 100 };

const fmt = (value) => value == null ? '—' : `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(0)} ms`;
const spreadLabel = (value) => value == null ? '—' : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)} ms`;

function Metric({ label, value, detail, tone = 'cyan', icon: Icon }) {
  const tones = {
    cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
    red: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
    green: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20'
  };
  return (
    <div className="glass-card rounded-2xl p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</span>
        {Icon && <span className={`rounded-lg border p-2 ${tones[tone] || tones.cyan}`}><Icon size={16} /></span>}
      </div>
      <div className={`mt-3 text-2xl md:text-3xl font-semibold font-mono tracking-tight ${tone === 'red' ? 'text-rose-300' : tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-slate-100'}`}>{value}</div>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </div>
  );
}

function OffsetBar({ satellite, offset, after = false, adjustment }) {
  const magnitude = Math.min(100, Math.abs(Number(offset || 0)) / 600 * 100);
  const positive = Number(offset || 0) >= 0;
  const color = after ? 'bg-emerald-400' : Math.abs(Number(offset || 0)) >= 300 ? 'bg-rose-400' : 'bg-cyan-400';
  return (
    <div className="grid grid-cols-[66px_minmax(0,1fr)_86px] items-center gap-3 py-2">
      <span className="text-xs font-semibold text-slate-300">{satellite}</span>
      <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-500/80 z-10" />
        <div className={`absolute top-0 h-full rounded-full ${color}`} style={{ width: `${magnitude / 2}%`, left: positive ? '50%' : `calc(50% - ${magnitude / 2}%)` }} />
      </div>
      <div className="text-right">
        <div className={`font-mono text-xs ${after ? 'text-emerald-300' : 'text-slate-200'}`}>{fmt(offset)}</div>
        {adjustment != null && <div className="font-mono text-[10px] text-slate-500">Δ {fmt(adjustment)}</div>}
      </div>
    </div>
  );
}

function Timeline({ title, events, mode, note }) {
  const corrected = mode === 'after';
  return (
    <section className="glass-card rounded-2xl p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 mt-1">{note}</p>
        </div>
        <span className={`text-[10px] uppercase tracking-wider rounded-full px-2.5 py-1 border whitespace-nowrap ${corrected ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' : 'text-rose-300 bg-rose-400/10 border-rose-400/20'}`}>{corrected ? 'Corrected view' : 'Clock-skewed view'}</span>
      </div>
      {!events?.length ? (
        <div className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-700 p-6 text-center">Run the experiment to generate the timeline.</div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => {
            const anomaly = event.kind === 'THERMAL_ANOMALY';
            return (
              <div key={event.event_id} className="relative flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${anomaly ? 'text-amber-300 bg-amber-400/10 border-amber-400/20' : 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20'}`}>
                    {anomaly ? <Activity size={17} /> : <Signal size={17} />}
                  </div>
                  {index < events.length - 1 && <div className="w-px flex-1 min-h-5 bg-slate-700 mt-2" />}
                </div>
                <div className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 p-3 mb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{event.satellite_id} · {anomaly ? 'Thermal event' : 'Relay event'}</span>
                    <span className="font-mono text-xs text-slate-200">{event.displayed_time}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-100">{event.label}</div>
                  <div className="mt-1 text-xs text-slate-500">Clock offset at recording: {fmt(event.clock_offset_ms)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {events?.length === 2 && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl p-3 text-xs ${corrected ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>
          {corrected ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {corrected ? 'The anomaly is correctly shown before the later relay event.' : 'Clock skew reverses the displayed order of the two events.'}
        </div>
      )}
    </section>
  );
}

export default function ClockSyncLab() {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [offsets, setOffsets] = useState(DEFAULT_OFFSETS);
  const [unavailable, setUnavailable] = useState('none');
  const [loading, setLoading] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/algorithms/clock-sync/status');
      if (!response.ok) throw new Error('Clock synchronization API is not available.');
      const data = await response.json();
      setStatus(data);
      setOffsets(data.offsets_ms || DEFAULT_OFFSETS);
      setResult(data.last_result || null);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load experiment state.');
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const currentOffsets = status?.offsets_ms || offsets;
  const currentSpread = result ? result.spread_after_ms : status?.spread_ms;
  const beforeSpread = result ? result.spread_before_ms : status?.spread_ms;
  const beforeEvents = result?.events_before || status?.events?.before;
  const afterEvents = result?.events_after || status?.events?.after;
  const steps = result?.steps || [];
  const logs = result?.log || [];
  const participantsCount = result?.participants?.length ?? SATELLITES.length;
  const scenarioChanged = useMemo(() => SATELLITES.some((id) => Number(offsets[id]) !== Number(currentOffsets[id])), [offsets, currentOffsets]);

  const runExperiment = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      if (scenarioChanged) {
        const configResponse = await fetch('/api/algorithms/clock-sync/scenario', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offsets_ms: offsets })
        });
        const configData = await configResponse.json();
        if (!configResponse.ok) throw new Error(configData.detail || 'Could not configure scenario.');
        setStatus(configData);
      }
      const response = await fetch('/api/algorithms/clock-sync/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unavailable_satellites: unavailable === 'none' ? [] : [unavailable] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Synchronization failed.');
      setResult(data);
      setOffsets(data.offsets_after_ms || offsets);
      setStatus(await (await fetch('/api/algorithms/clock-sync/status')).json());
      setNotice(data.success ? 'Synchronization round completed and verified.' : 'Round completed with a residual clock spread.');
    } catch (err) {
      setError(err.message || 'Could not run synchronization.');
    } finally { setLoading(false); }
  };

  const resetExperiment = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/algorithms/clock-sync/reset', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Reset failed.');
      setStatus(data); setOffsets(data.offsets_ms || DEFAULT_OFFSETS); setResult(null); setUnavailable('none');
      setNotice('Experiment reset to the repeatable baseline scenario.');
    } catch (err) { setError(err.message || 'Could not reset experiment.'); }
    finally { setLoading(false); }
  };

  const saveScenario = async () => {
    setSavingScenario(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/algorithms/clock-sync/scenario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offsets_ms: offsets })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Scenario update failed.');
      setStatus(data); setResult(null);
      setNotice('Custom offsets saved. Run synchronization to observe their effect.');
    } catch (err) { setError(err.message || 'Could not save scenario.'); }
    finally { setSavingScenario(false); }
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/50 p-5 md:p-8">
        <div className="absolute -right-12 -top-16 w-64 h-64 rounded-full border border-cyan-400/10" />
        <div className="absolute -right-2 -top-6 w-44 h-44 rounded-full border border-cyan-400/10" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-200">
              <Waves size={13} /> Distributed Systems · Live Experiment
            </div>
            <h1 className="mt-4 text-2xl md:text-4xl font-bold tracking-tight text-white">Mission Timeline Integrity Lab</h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base leading-relaxed text-slate-300">See how independent satellite clocks can mislead Mission Control—and how Berkeley synchronization restores a consistent operational timeline.</p>
          </div>
          <div className="relative min-w-[210px] rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Experiment state</div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span className={`h-2 w-2 rounded-full ${result?.success ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
              {result?.success ? 'Synchronized' : 'Awaiting synchronization'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Simulated clocks · no OS clock changes</div>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"><AlertTriangle size={18} className="shrink-0 mt-0.5" /><div><strong>API / experiment error</strong><div className="mt-1">{error}</div><div className="mt-2 text-xs text-rose-200/70">Confirm the backend is running and the clock-sync router is registered.</div></div></div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"><CheckCircle2 size={16} />{notice}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Metric label="Clock spread before" value={spreadLabel(result?.spread_before_ms ?? status?.spread_ms)} detail="Max offset − min offset" tone="red" icon={Clock3} />
        <Metric label="Clock spread after" value={spreadLabel(result?.spread_after_ms)} detail={result ? 'Measured across responding nodes' : 'Run experiment to measure'} tone={result?.success ? 'green' : 'cyan'} icon={Gauge} />
        <Metric label="Coordinator target" value={fmt(result?.target_offset_ms ?? status?.target_offset_ms)} detail="Mean of responding clock estimates" tone="cyan" icon={Activity} />
        <Metric label="Responding satellites" value={`${participantsCount}/5`} detail={result?.excluded_satellites?.length ? `${result.excluded_satellites.join(', ')} excluded` : 'All five available in baseline'} tone={result?.excluded_satellites?.length ? 'amber' : 'green'} icon={Satellite} />
      </section>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.05fr_0.95fr] gap-5">
        <section className="glass-panel rounded-2xl p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><Satellite className="text-cyan-300" size={19} /><h2 className="text-lg font-semibold text-slate-100">Constellation clock offsets</h2></div>
              <p className="mt-1 text-xs text-slate-500">Positive values run fast; negative values run slow relative to the scenario reference.</p>
            </div>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400">5 simulated nodes</span>
          </div>
          <div className="mt-5 grid grid-cols-[66px_minmax(0,1fr)_86px] gap-3 text-[10px] uppercase tracking-wider text-slate-500">
            <span>Satellite</span><div className="flex justify-between"><span>−600 ms</span><span>0</span><span>+600 ms</span></div><span className="text-right">Offset</span>
          </div>
          <div className="mt-2">
            {SATELLITES.map((id) => <OffsetBar key={id} satellite={id} offset={currentOffsets[id]} after={!!result} adjustment={result?.adjustments_ms?.[id]} />)}
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 text-amber-300 shrink-0" /><p className="text-xs leading-relaxed text-slate-400">The bars visualize each node's simulated clock offset. After a successful round, participating satellites converge on the calculated target. Excluded nodes retain their old offset.</p></div>
          </div>
          <div className="mt-5 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 mb-3"><SlidersHorizontal size={16} className="text-cyan-300" /><h3 className="text-sm font-semibold text-slate-200">Experiment controls</h3></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SATELLITES.map((id) => (
                <label key={id} className="block rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <span className="flex items-center justify-between text-xs text-slate-400"><span>{id} simulated offset</span><span className="font-mono text-slate-200">{fmt(offsets[id])}</span></span>
                  <input aria-label={`${id} clock offset in milliseconds`} type="range" min="-600" max="600" step="10" value={offsets[id]} onChange={(e) => setOffsets((prev) => ({ ...prev, [id]: Number(e.target.value) }))} className="mt-3 w-full accent-cyan-400" />
                  <div className="flex justify-between text-[10px] text-slate-600"><span>−600 ms</span><span>+600 ms</span></div>
                </label>
              ))}
            </div>
            <label className="mt-3 block text-xs text-slate-400">Simulate a non-responsive satellite
              <select value={unavailable} onChange={(e) => setUnavailable(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400">
                <option value="none">No failure — all satellites respond</option>
                {SATELLITES.map((id) => <option value={id} key={id}>{id} does not respond</option>)}
              </select>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={runExperiment} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} {loading ? 'Running round…' : 'Run synchronization'}
              </button>
              <button onClick={saveScenario} disabled={loading || savingScenario} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-cyan-400/40 hover:bg-slate-800/70 disabled:opacity-50">
                {savingScenario ? <RefreshCw size={15} className="animate-spin" /> : <SlidersHorizontal size={15} />} Save offsets
              </button>
              <button onClick={resetExperiment} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/70 disabled:opacity-50"><TimerReset size={15} /> Reset</button>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="glass-panel rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2"><Activity size={18} className="text-cyan-300" /><h2 className="text-lg font-semibold text-slate-100">Berkeley algorithm trace</h2></div>
            <p className="mt-1 text-xs text-slate-500">Follow the actual calculation and adjustment values returned by the backend.</p>
            <div className="mt-5 space-y-0">
              {[
                { title: 'Collect clock estimates', description: result ? `Received ${result.participants.length} satellite responses.` : 'Mission Control requests the current simulated offsets.', icon: Signal },
                { title: 'Calculate common target', description: result ? `Average of responding offsets: ${fmt(result.target_offset_ms)}.` : 'Compute the mean of the responding clocks.', icon: Gauge },
                { title: 'Distribute corrections', description: result ? `${Object.keys(result.adjustments_ms).length} adjustment values calculated and applied.` : 'Each participant receives target − current offset.', icon: ArrowDownRight },
                { title: 'Verify clock spread', description: result ? `${spreadLabel(result.spread_before_ms)} → ${spreadLabel(result.spread_after_ms)}.` : 'Measure max offset minus min offset after correction.', icon: ShieldCheck }
              ].map((step, index) => {
                const Icon = step.icon;
                const done = !!result;
                return <div key={step.title} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center"><div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${done ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-500'}`}>{done ? <CheckCircle2 size={17} /> : <Icon size={17} />}</div>{index < 3 && <div className={`mt-1 w-px flex-1 min-h-5 ${done ? 'bg-emerald-400/30' : 'bg-slate-800'}`} />}</div>
                  <div className="flex-1 pt-1"><div className="text-sm font-medium text-slate-200">{index + 1}. {step.title}</div><div className="mt-1 text-xs leading-relaxed text-slate-500">{step.description}</div></div>
                </div>;
              })}
            </div>
            {result && <div className={`mt-4 rounded-xl border p-3 ${result.success ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">{result.success ? <CheckCircle2 size={16} className="text-emerald-300" /> : <AlertTriangle size={16} className="text-amber-300" />}{result.success ? 'Synchronization verified' : 'Partial synchronization'}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{result.timeline_order_corrected ? 'The simulated event ordering now matches the scenario ground truth.' : 'The event order is not fully corrected. Check whether an event-producing satellite was excluded.'}</p>
            </div>}
          </div>

          <div className="glass-panel rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2"><Activity size={18} className="text-cyan-300" /><h2 className="text-lg font-semibold text-slate-100">Adjustment ledger</h2></div>
            <p className="mt-1 text-xs text-slate-500">Per-node correction = coordinator target − original offset.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500"><th className="pb-2 pr-3 font-medium">Node</th><th className="pb-2 pr-3 font-medium text-right">Before</th><th className="pb-2 pr-3 font-medium text-right">Adjustment</th><th className="pb-2 font-medium text-right">After</th></tr></thead>
                <tbody>
                  {SATELLITES.map((id) => {
                    const excluded = result?.excluded_satellites?.includes(id);
                    return <tr key={id} className="border-b border-slate-800/60 last:border-0">
                      <td className="py-3 pr-3 font-semibold text-slate-300">{id}{excluded && <span className="ml-1 text-[9px] text-amber-300">OFFLINE</span>}</td>
                      <td className="py-3 pr-3 text-right font-mono text-slate-400">{fmt(result?.offsets_before_ms?.[id])}</td>
                      <td className="py-3 pr-3 text-right font-mono text-cyan-300">{result?.adjustments_ms?.[id] != null ? fmt(result.adjustments_ms[id]) : '—'}</td>
                      <td className={`py-3 text-right font-mono ${excluded ? 'text-amber-300' : result ? 'text-emerald-300' : 'text-slate-500'}`}>{fmt(result?.offsets_after_ms?.[id])}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Timeline title="Before synchronization" events={beforeEvents} mode="before" note="What Mission Control believes based on unsynchronized timestamps." />
        <Timeline title="After synchronization" events={afterEvents} mode="after" note="Replayed timestamps after applying simulated clock corrections." />
      </section>

      <section className="glass-panel rounded-2xl p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="flex items-center gap-2"><Clock3 size={18} className="text-cyan-300" /><h2 className="text-lg font-semibold text-slate-100">Mission Control execution log</h2></div><p className="mt-1 text-xs text-slate-500">Readable evidence of the algorithm's decisions.</p></div>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-500">{logs.length} entries</span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs leading-6">
          {logs.length ? logs.map((line, index) => <div key={`${index}-${line}`} className="flex gap-3"><span className="shrink-0 text-slate-600">{String(index + 1).padStart(2, '0')}</span><span className={line.includes('Verification') || line.includes('corrected') ? 'text-emerald-300' : 'text-slate-300'}>{line}</span></div>) : <div className="text-slate-500">Awaiting experiment. Run synchronization to populate the coordinator log.</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 md:p-5">
        <div className="flex items-start gap-3"><AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-300" /><div><h3 className="text-sm font-semibold text-amber-100">What this experiment proves—and what it does not</h3><p className="mt-2 text-xs leading-relaxed text-slate-400">This is a deterministic Berkeley-algorithm simulation. It demonstrates coordinator averaging, correction distribution, measured clock spread, and how clock skew can reverse the apparent order of independent event timestamps. It does not change container or host operating-system clocks, model real network-delay uncertainty, or prove causality for every distributed event. For the default scenario, all five simulated offsets converge to +70 ms and the relative spread becomes 0 ms.</p></div></div>
      </section>
    </div>
  );
}
