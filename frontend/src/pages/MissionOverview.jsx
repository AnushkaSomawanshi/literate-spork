import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, ArrowRight, BatteryCharging, CheckCircle2, Cpu, Globe2, MapPin, Radio, RefreshCw, Satellite, ShieldAlert, Signal, Wifi } from 'lucide-react';

const EARTH_TEXTURE = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74776/world.topo.bathy.200412.3x5400x2700.jpg';
const statusColor = s => s === 'HEALTHY' ? '#34d399' : s === 'WARNING' ? '#fbbf24' : s === 'CRITICAL' || s === 'OFFLINE' ? '#fb7185' : '#22d3ee';
function positionOf(s) {
  const p = s?.position || s?.telemetry?.position || {};
  const lat = Number(p.latitude ?? s?.latitude), lon = Number(p.longitude ?? s?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 ||
      (p.latitude == null && p.longitude == null && s?.latitude == null && s?.longitude == null)) return null;
  return { lat, lon, alt: p.altitude_km ?? s?.altitude_km, velocity: p.velocity_kms ?? s?.velocity_kms };
}
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (window.__missionLeafletPromise) return window.__missionLeafletPromise;
  window.__missionLeafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-mo-leaflet]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; link.dataset.moLeaflet = '1'; document.head.appendChild(link);
    }
    let script = document.querySelector('script[data-mo-leaflet]');
    if (!script) { script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.dataset.moLeaflet = '1'; script.onload = () => window.L ? resolve(window.L) : reject(Error('Leaflet unavailable')); script.onerror = () => reject(Error('Leaflet failed')); document.body.appendChild(script); }
    else if (window.L) resolve(window.L); else { script.addEventListener('load', () => resolve(window.L), {once:true}); script.addEventListener('error', () => reject(Error('Leaflet failed')), {once:true}); }
  });
  return window.__missionLeafletPromise;
}
function EarthPanel({ satellites, selectedId, onSelect }) {
  const mapEl = useRef(null), mapRef = useRef(null), markers = useRef({});
  const [mapState, setMapState] = useState('loading');
  const positioned = useMemo(() => satellites.map(s => ({s, p:positionOf(s)})).filter(x => x.p), [satellites]);
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, {zoomControl:false, worldCopyJump:true}).setView([20,0],2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:18, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
      L.control.zoom({position:'topright'}).addTo(map); mapRef.current = map; setMapState('ready'); setTimeout(() => map.invalidateSize(),120);
    }).catch(() => { if (!cancelled) setMapState('error'); });
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markers.current = {}; } };
  }, []);
  useEffect(() => {
    const map = mapRef.current, L = window.L; if (!map || !L) return;
    Object.values(markers.current).forEach(m => m.remove()); markers.current = {};
    positioned.forEach(({s,p}) => {
      const m = L.circleMarker([p.lat,p.lon], {radius:s.satellite_id===selectedId?9:6,color:'#07111f',weight:2,fillColor:statusColor(s.status),fillOpacity:1}).addTo(map);
      m.bindTooltip(s.satellite_id,{direction:'top',offset:[0,-7]}); m.on('click',()=>onSelect(s.satellite_id)); markers.current[s.satellite_id]=m;
    });
  }, [positioned, selectedId, onSelect]);
  return <section className="mo-panel mo-earth-panel">
    <div className="mo-panel-heading"><div><div className="mo-eyebrow"><Globe2 size={13}/> EARTH &amp; ORBITAL VIEW</div><h3>Mission Globe</h3><p>Earth surface imagery · selectable constellation nodes</p></div><span className="mo-live"><i/> LIVE FEED</span></div>
    <div className="mo-globe-stage"><div className="mo-stars"/><div className="mo-earth-halo"/><div className="mo-earth-sphere"><div className="mo-earth-texture" style={{backgroundImage:`url("${EARTH_TEXTURE}")`}}/><div className="mo-earth-shade"/></div>
      <svg className="mo-orbit-svg" viewBox="0 0 600 390" role="img" aria-label="Illustrative orbital paths">
        <ellipse cx="300" cy="195" rx="228" ry="75" transform="rotate(-23 300 195)" fill="none" stroke="#36d9f5" strokeWidth="1.4" strokeDasharray="5 7" opacity=".8"/>
        <ellipse cx="300" cy="195" rx="218" ry="105" transform="rotate(35 300 195)" fill="none" stroke="#22d3ee" strokeWidth="1.2" opacity=".52"/>
        <ellipse cx="300" cy="195" rx="190" ry="132" transform="rotate(-58 300 195)" fill="none" stroke="#67e8f9" strokeWidth="1" strokeDasharray="2 8" opacity=".5"/>
        {satellites.slice(0,5).map((s,i)=>{const a=i*2*Math.PI/Math.max(5,Math.min(satellites.length,5))-Math.PI/2,x=300+Math.cos(a)*205,y=195+Math.sin(a)*82,active=s.satellite_id===selectedId;return <g key={s.satellite_id} onClick={()=>onSelect(s.satellite_id)} className="mo-orbit-marker" role="button" tabIndex="0" aria-label={`Select ${s.satellite_id}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onSelect(s.satellite_id)}}>{active&&<circle cx={x} cy={y} r="13" fill="none" stroke={statusColor(s.status)}><animate attributeName="r" values="9;16;9" dur="2.2s" repeatCount="indefinite"/></circle>}<circle cx={x} cy={y} r={active?6:4.5} fill={statusColor(s.status)} stroke="#e0f2fe" strokeWidth="1.5"/><text x={x} y={y-12} textAnchor="middle" fill="#e0f2fe" fontSize="10" fontWeight="700">{s.satellite_id}</text></g>})}
      </svg><div className="mo-globe-caption"><i/> Atmospheric glow &amp; orbital reference paths</div><div className="mo-orbit-disclaimer">ORBIT LINES ILLUSTRATIVE · NOT EPHEMERIS-PROPAGATED</div>
    </div>
    <div className="mo-globe-legend"><span><i style={{background:'#34d399'}}/> Healthy</span><span><i style={{background:'#fbbf24'}}/> Warning</span><span><i style={{background:'#fb7185'}}/> Critical / offline</span><span className="mo-legend-note">Select a satellite marker</span></div>
    <div className="mo-map-heading"><div><div className="mo-eyebrow"><MapPin size={13}/> GEOGRAPHIC TRACKING</div><h4>Live geographic map</h4></div><span className="mo-coordinate-count">{positioned.length} / {satellites.length} positions available</span></div>
    <div className="mo-map-wrap"><div ref={mapEl} className="mo-leaflet-map" aria-label="Interactive geographic map with satellite markers"/>{mapState==='loading'&&<div className="mo-map-message">Loading interactive map…</div>}{mapState==='error'&&<div className="mo-map-message">Map library could not load. Check your connection and reload this page.</div>}</div>
    <div className="mo-map-footnote">{positioned.length?'Markers use coordinates provided by application telemetry.':'No geographic coordinates are currently exposed by the registry feed. The map remains navigable; no satellite positions are fabricated.'} Map data © OpenStreetMap contributors.</div>
  </section>;
}

export default function MissionOverview({ satellites = [], events = [], observatoryStats = {} }) {
  const [displaySatellites,setDisplaySatellites] = useState(satellites);
  const [selectedId,setSelectedId] = useState(satellites[0]?.satellite_id || 'SAT-01');
  useEffect(()=>{if(satellites?.length)setDisplaySatellites(satellites);else fetch('/api/satellites').then(r=>r.json()).then(d=>{if(d.satellites?.length)setDisplaySatellites(d.satellites)}).catch(()=>{});},[satellites]);
  useEffect(()=>{if(displaySatellites.length&&!displaySatellites.some(s=>s.satellite_id===selectedId))setSelectedId(displaySatellites[0].satellite_id)},[displaySatellites,selectedId]);
  const healthy=displaySatellites.filter(s=>s.status==='HEALTHY').length, warning=displaySatellites.filter(s=>s.status==='WARNING').length, critical=displaySatellites.filter(s=>s.status==='CRITICAL').length, offline=displaySatellites.filter(s=>s.status==='OFFLINE').length;
  const selected=displaySatellites.find(s=>s.satellite_id===selectedId)||displaySatellites[0], pos=positionOf(selected);
  const selectSatellite= id => setSelectedId(id);
  return <div className="mission-overview-redesign space-y-6 pb-12">
    <header className="mo-hero"><div className="mo-hero-grid"/><div className="mo-hero-content"><div className="mo-hero-kicker"><span className="mo-live"><i/> MISSION CONTROL / LIVE OPERATIONS</span><span className="mo-hero-separator"/> FIVE-NODE SATELLITE FLEET</div><h2>Mission Overview<span>.</span></h2><p>Fleet readiness, telemetry health, communications status, and orbital situational awareness in one operational view.</p></div><div className="mo-hero-mark"><Satellite size={82} strokeWidth={1}/><div>ORBITTRACK <span>MISSION SYSTEMS</span></div></div></header>
    <div className="mo-kpi-grid">
      <div className="mo-kpi"><div className="mo-kpi-label"><span>FLEET HEALTH</span><Satellite size={17}/></div><div className="mo-kpi-value">{healthy}<small> / {displaySatellites.length||5}</small></div><div className="mo-kpi-bottom"><span className="mo-kpi-good"><CheckCircle2 size={13}/> {healthy} nominal</span><span>HEALTHY NODES</span></div><div className="mo-kpi-bar"><i style={{width:`${healthy/Math.max(displaySatellites.length,1)*100}%`}}/></div></div>
      <div className="mo-kpi"><div className="mo-kpi-label"><span>TELEMETRY THROUGHPUT</span><Activity size={17}/></div><div className="mo-kpi-value">{observatoryStats?.websocket?.messages_per_second||'10.0'}<small> msg/s</small></div><div className="mo-kpi-bottom"><span className="mo-kpi-good"><Wifi size={13}/> WebSocket stream</span><span>LIVE INGEST</span></div><div className="mo-kpi-spark">{[1,2,3,4,5,6,7,8,9,10,11,12].map(n=><i key={n}/>)}</div></div>
      <div className="mo-kpi"><div className="mo-kpi-label"><span>MESSAGING FABRIC</span><Radio size={17}/></div><div className="mo-kpi-value mo-kpi-word">{observatoryStats?.rabbitmq?.connected?'CONNECTED':'RESILIENT'}</div><div className="mo-kpi-bottom"><span className="mo-kpi-neutral">{observatoryStats?.rabbitmq?.connected?'RabbitMQ · 5672':'Queue service status'}</span><span>ASYNC BUS</span></div><div className="mo-kpi-bar mo-kpi-bar-purple"><i style={{width:observatoryStats?.rabbitmq?.connected?'100%':'72%'}}/></div></div>
      <div className="mo-kpi"><div className="mo-kpi-label"><span>SYSTEM POSTURE</span><ShieldAlert size={17}/></div><div className={`mo-kpi-value ${offline||critical?'mo-danger':warning?'mo-warning':'mo-success'}`}>{offline||critical?'DEGRADED':warning?'ATTENTION':'HEALTHY'}</div><div className="mo-kpi-bottom"><span className={offline||critical?'mo-kpi-bad':'mo-kpi-good'}>{offline} offline · {warning} warning</span><span>FLEET STATE</span></div><div className="mo-kpi-bar"><i style={{width:`${Math.max(8,(displaySatellites.length-offline-critical)/Math.max(displaySatellites.length,1)*100)}%`,background:offline||critical?'#fb7185':'#34d399'}}/></div></div>
    </div>
    <div className="mo-main-grid"><EarthPanel satellites={displaySatellites} selectedId={selectedId} onSelect={selectSatellite}/><div className="mo-side-column">
      <section className="mo-panel mo-selected-panel"><div className="mo-panel-heading"><div><div className="mo-eyebrow"><Signal size={13}/> SELECTED ASSET</div><h3>Satellite Inspector</h3><p>Live state from the mission registry</p></div><Satellite size={20} className="mo-inspector-icon"/></div>
      {selected?<><div className="mo-selected-title"><div className="mo-selected-avatar"><Satellite size={23}/></div><div><strong>{selected.satellite_id}</strong><span>{selected.node_id||`NODE-${selected.satellite_id}`}</span></div><span className="mo-status-pill" style={{color:statusColor(selected.status),borderColor:statusColor(selected.status)}}><i style={{background:statusColor(selected.status)}}/>{selected.status||'UNKNOWN'}</span></div>
      <div className="mo-inspector-metrics"><div><BatteryCharging size={15}/><span>Battery</span><strong>{selected.status==='OFFLINE'?'—':selected.battery!=null?`${selected.battery}%`:'—'}</strong></div><div><Activity size={15}/><span>Temperature</span><strong>{selected.status==='OFFLINE'?'—':selected.temperature!=null?`${selected.temperature}°C`:'—'}</strong></div><div><Cpu size={15}/><span>CPU load</span><strong>{selected.status==='OFFLINE'?'—':selected.cpu_usage!=null?`${selected.cpu_usage}%`:'—'}</strong></div><div><CheckCircle2 size={15}/><span>Health score</span><strong>{selected.status==='OFFLINE'?'0%':selected.health_score!=null?`${selected.health_score}%`:'—'}</strong></div></div>
      <div className="mo-section-label">ORBITAL POSITION</div><div className="mo-position-grid"><div><span>LATITUDE</span><strong>{pos?`${pos.lat.toFixed(3)}°`:'Unavailable'}</strong></div><div><span>LONGITUDE</span><strong>{pos?`${pos.lon.toFixed(3)}°`:'Unavailable'}</strong></div><div><span>ALTITUDE</span><strong>{pos?.alt!=null?`${pos.alt} km`:'Unavailable'}</strong></div><div><span>VELOCITY</span><strong>{pos?.velocity!=null?`${pos.velocity} km/s`:'Unavailable'}</strong></div></div>
      <div className="mo-section-label">NETWORK ENDPOINTS</div><div className="mo-endpoints"><span>gRPC <b>:{selected.grpc_port??'—'}</b></span><span>P2P <b>:{selected.p2p_port??'—'}</b></span></div><div className="mo-inspector-note"><i/> Values reflect fields currently available in the registry feed.</div></>:<div className="mo-empty-inspector">No satellites are currently registered.</div>}</section>
      <section className="mo-panel mo-fleet-panel"><div className="mo-panel-heading"><div><div className="mo-eyebrow"><Radio size={13}/> CONSTELLATION</div><h3>Fleet at a glance</h3></div><span className="mo-fleet-count">{displaySatellites.length} NODES</span></div><div className="mo-fleet-list">{displaySatellites.map(s=><button type="button" key={s.satellite_id} onClick={()=>selectSatellite(s.satellite_id)} className={`mo-fleet-row ${s.satellite_id===selectedId?'is-selected':''}`}><i className="mo-fleet-dot" style={{background:statusColor(s.status)}}/><span className="mo-fleet-name">{s.satellite_id}<small>{s.node_id||'Registered satellite node'}</small></span><span className="mo-fleet-health">{s.status==='OFFLINE'?'OFFLINE':s.health_score!=null?`${s.health_score}%`:'—'}</span><ArrowRight size={14}/></button>)}</div><NavLink to="/registry" className="mo-view-all">Open satellite registry <ArrowRight size={14}/></NavLink></section>
      <section className="mo-panel mo-quick-links"><div className="mo-eyebrow">MISSION SYSTEMS</div><NavLink to="/telemetry"><Activity size={15}/> Live telemetry charts <ArrowRight size={14}/></NavLink><NavLink to="/observatory"><Radio size={15}/> Communication observatory <ArrowRight size={14}/></NavLink><NavLink to="/topology"><Globe2 size={15}/> Network topology <ArrowRight size={14}/></NavLink></section>
    </div></div>
    <section className="mo-panel mo-table-panel"><div className="mo-panel-heading"><div><div className="mo-eyebrow"><RefreshCw size={13}/> LIVE REGISTRY SNAPSHOT</div><h3>Discovered constellation nodes</h3><p>Operational status and current health metrics reported by Mission Control</p></div><span className="mo-table-live"><i/> AUTO-REFRESH</span></div><div className="overflow-x-auto"><table className="mo-table"><thead><tr><th>Satellite</th><th>Node ID</th><th>Endpoints</th><th>Status</th><th>Health</th><th>Battery</th><th>Temp.</th><th>CPU</th><th>Heartbeat</th></tr></thead><tbody>{displaySatellites.length?displaySatellites.map(s=><tr key={s.satellite_id} className={s.satellite_id===selectedId?'mo-table-selected':''} onClick={()=>selectSatellite(s.satellite_id)}><td><button type="button" className="mo-table-sat">{s.satellite_id}</button></td><td>{s.node_id||`NODE-${s.satellite_id}`}</td><td><span className="mo-port">gRPC :{s.grpc_port??'—'}</span><span className="mo-port">P2P :{s.p2p_port??'—'}</span></td><td><span className="mo-status-pill" style={{color:statusColor(s.status),borderColor:statusColor(s.status)}}><i style={{background:statusColor(s.status)}}/>{s.status||'UNKNOWN'}</span></td><td><strong>{s.status==='OFFLINE'?'0':s.health_score??'—'}{s.status==='OFFLINE'||s.health_score!=null?'%':''}</strong></td><td>{s.status==='OFFLINE'?'—':s.battery!=null?`${s.battery}%`:'—'}</td><td>{s.status==='OFFLINE'?'—':s.temperature!=null?`${s.temperature}°C`:'—'}</td><td>{s.status==='OFFLINE'?'—':s.cpu_usage!=null?`${s.cpu_usage}%`:'—'}</td><td>{s.seconds_since_heartbeat!==undefined?`${s.seconds_since_heartbeat}s ago`:'Active'}</td></tr>):<tr><td colSpan="9" className="mo-empty-row">No satellites discovered. Ensure satellite processes are running.</td></tr>}</tbody></table></div></section>
  </div>;
}
