"""Kubernetes observability and guarded self-healing demo."""
import os
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/kubernetes", tags=["Kubernetes Mission Lab"])
NAMESPACE = os.getenv("KUBERNETES_LAB_NAMESPACE", "mission-control-lab")
MANAGED_LABEL = "app.kubernetes.io/managed-by"
MANAGED_VALUE = "mission-control-kubernetes-lab"
_cache: dict[str, Any] = {}

def _clients():
    if _cache:
        return _cache
    try:
        from kubernetes import client, config
    except ImportError as exc:
        raise RuntimeError("Kubernetes Python client missing; rebuild backend dependencies.") from exc
    try:
        config.load_incluster_config()
        mode = "in-cluster service account"
    except Exception:
        try:
            config.load_kube_config()
            mode = "local kubeconfig"
        except Exception as exc:
            raise RuntimeError("No Kubernetes credentials. Enable Kubernetes in Docker Desktop and verify kubectl get nodes.") from exc
    _cache.update(core=client.CoreV1Api(), apps=client.AppsV1Api(), mode=mode)
    return _cache

def _iso(value):
    return value.isoformat() if value else None

def _pod(p):
    statuses = (p.status.container_statuses or []) if p.status else []
    labels = p.metadata.labels or {}
    return {"name": p.metadata.name, "namespace": p.metadata.namespace,
        "phase": p.status.phase if p.status else "Unknown",
        "ready": bool(statuses) and all(c.ready for c in statuses),
        "restarts": sum(c.restart_count for c in statuses),
        "node": p.spec.node_name if p.spec else None,
        "created": _iso(p.metadata.creation_timestamp), "labels": labels,
        "managed": labels.get(MANAGED_LABEL) == MANAGED_VALUE}

def _overview():
    c = _clients()
    nodes = c.core.list_node().items
    deployments = c.apps.list_namespaced_deployment(NAMESPACE).items
    pods = c.core.list_namespaced_pod(NAMESPACE).items
    services = c.core.list_namespaced_service(NAMESPACE).items
    events = c.core.list_namespaced_event(NAMESPACE).items
    return {"connected": True, "context": c["mode"], "namespace": NAMESPACE,
      "capturedAt": datetime.now(timezone.utc).isoformat(),
      "nodes": [{"name": n.metadata.name,
        "ready": any(x.type == "Ready" and x.status == "True" for x in (n.status.conditions or [])),
        "roles": [k.removeprefix("node-role.kubernetes.io/") for k in (n.metadata.labels or {}) if k.startswith("node-role.kubernetes.io/")] or ["worker"],
        "version": n.status.node_info.kubelet_version if n.status and n.status.node_info else "unknown"} for n in nodes],
      "deployments": [{"name": d.metadata.name, "desired": d.spec.replicas or 0,
        "ready": d.status.ready_replicas or 0, "available": d.status.available_replicas or 0,
        "updated": d.status.updated_replicas or 0} for d in deployments],
      "pods": [_pod(p) for p in pods],
      "services": [{"name": s.metadata.name, "type": s.spec.type, "clusterIP": s.spec.cluster_ip,
        "ports": [str(p.port) + "/" + str(p.protocol) for p in (s.spec.ports or [])]} for s in services],
      "events": [{"type": e.type or "Normal", "reason": e.reason or "Event",
        "object": e.involved_object.name, "message": e.message or "",
        "lastSeen": _iso(e.last_timestamp or e.event_time or e.metadata.creation_timestamp)}
        for e in sorted(events, key=lambda x: x.metadata.creation_timestamp or datetime.min.replace(tzinfo=timezone.utc), reverse=True)[:30]]}

@router.get("/health")
def kubernetes_health():
    try:
        c = _clients()
        return {"connected": True, "namespace": NAMESPACE, "credentialMode": c["mode"]}
    except Exception as exc:
        return {"connected": False, "namespace": NAMESPACE, "detail": str(exc)}

@router.get("/overview")
def kubernetes_overview():
    try:
        return _overview()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Kubernetes cluster unavailable: " + str(exc)) from exc

@router.delete("/pods/{pod_name}")
def delete_lab_pod(pod_name: str):
    if not pod_name or "/" in pod_name or pod_name in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid pod name")
    try:
        c = _clients()
        pod = c.core.read_namespaced_pod(name=pod_name, namespace=NAMESPACE)
        labels = pod.metadata.labels or {}
        if labels.get(MANAGED_LABEL) != MANAGED_VALUE:
            raise HTTPException(status_code=403, detail="Safety guard: Pod is not managed by this lab.")
        if not pod.metadata.owner_references or not any(o.kind == "ReplicaSet" for o in pod.metadata.owner_references):
            raise HTTPException(status_code=403, detail="Safety guard: only Deployment-managed Pods can be deleted.")
        c.core.delete_namespaced_pod(name=pod_name, namespace=NAMESPACE, body={"propagationPolicy": "Foreground"})
        return {"deleted": pod_name, "namespace": NAMESPACE, "message": "Pod deletion requested; its Deployment should create a replacement."}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not delete lab Pod: " + str(exc)) from exc
