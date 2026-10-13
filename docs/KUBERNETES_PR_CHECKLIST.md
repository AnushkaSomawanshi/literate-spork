# PR checklist — Kubernetes Mission Lab

## Implementation review
- Sidebar entry and React route /kubernetes-lab are wired.
- FastAPI router is registered under /api/kubernetes.
- Backend Docker image installs the Kubernetes Python client.
- Dashboard displays real cluster data and reports connection failures instead of fabricating data.
- Manifests are isolated in mission-control-lab.
- Pod deletion checks namespace, ownership label and ReplicaSet owner.
- Windows PowerShell setup, demo, troubleshooting and cleanup are documented in docs/KUBERNETES_LAB.md.

## Before merge
Run from the repository root:

    python -m compileall backend
    cd frontend
    npm run build
    cd ..
    kubectl apply --dry-run=client -f k8s/mission-control-lab/

Install frontend dependencies before npm run build (npm ci if package-lock.json exists, otherwise npm install). A client-side dry run does not replace testing against a running cluster.

## Manual acceptance
- API overview returns actual nodes and namespace resources.
- Dashboard renders Nodes, Deployments, Pods, Services and Events.
- Delete one labelled demo Pod; verify a replacement appears and Deployment returns to two ready replicas.
- An unlabelled Pod cannot be deleted through the lab API.
- The main branch was not edited directly; merge only after review and checks pass.
