# Kubernetes Mission Lab — Windows setup and demonstration

This feature adds a live Kubernetes dashboard to the existing React + FastAPI application. It reads actual cluster state from the Kubernetes API and provides a guarded Pod-deletion demonstration.

## Scope and safety

- The dashboard displays real Nodes, Deployments, Pods, Services and recent Events.
- The manifests create a separate mission-control-lab namespace with a two-replica NGINX Deployment and ClusterIP Service.
- Deleting a lab-owned Pod asks Kubernetes to remove it; the Deployment/ReplicaSet controller should create a replacement.
- The API is restricted to the configured namespace and will only delete a Pod carrying the lab ownership label and owned by a ReplicaSet.
- This is a Kubernetes learning workload, not a conversion of every Docker Compose service to Kubernetes. The existing application and its PostgreSQL/RabbitMQ/satellite services can continue to run with Docker Compose.
- For local development, run FastAPI on Windows so it can use the current user's kubeconfig. Do not commit kubeconfig files or mount an administrator kubeconfig into a shared container.

## Prerequisites and Docker Desktop

1. Install or update Docker Desktop.
2. Open Docker Desktop Settings and find Kubernetes. Enable Kubernetes, choose the available cluster option, and select Apply/Restart. The exact menu text depends on the Docker Desktop version.
3. Wait until Docker Desktop says Kubernetes is running.
4. Open PowerShell and verify these commands work: docker version; kubectl version --client; kubectl config current-context; kubectl get nodes.
5. Confirm the current context is the Docker Desktop cluster (commonly named docker-desktop) and the node reports Ready. Do not assume the context name; check it.

If kubectl is not installed, install the Kubernetes CLI using the official Kubernetes kubectl installation instructions or Docker Desktop documentation.

## Step 1 — get the PR branch

If you have not cloned the repository, run these from the folder where you keep projects:

    git clone https://github.com/AnushkaSomawanshi/literate-spork.git
    cd literate-spork
    git fetch origin
    git checkout feature/kubernetes-mission-control-lab
    git pull origin feature/kubernetes-mission-control-lab

If you already cloned the repo, skip clone and cd into the existing repository. Check the active branch using git branch --show-current.

## Step 2 — start supporting services

From the repository root in PowerShell:

    docker compose up -d postgres rabbitmq
    docker compose ps

We start only PostgreSQL and RabbitMQ here so a local FastAPI process can own port 8000 without competing with the backend container.

## Step 3 — run FastAPI on Windows

Use Python 3.11 if available. From the repository root:

    py -3.11 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    pip install fastapi "uvicorn[standard]" pydantic pydantic-settings sqlalchemy aiosqlite grpcio grpcio-tools httpx aio-pika asyncpg kubernetes
    $env:DATABASE_URL = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/satellite_db"
    $env:RABBITMQ_URL = "amqp://guest:guest@localhost:5672/"
    $env:KUBERNETES_LAB_NAMESPACE = "mission-control-lab"
    uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

Keep this terminal open. If PowerShell blocks activation, run Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass in that terminal, then activate again. If py -3.11 is unavailable, install Python 3.11 and reopen PowerShell.

The Kubernetes API client first tries in-cluster credentials, then the current user's kubeconfig. The Windows process must be running as the same user whose kubeconfig works with kubectl. Restart the backend after changing Kubernetes contexts.

## Step 4 — run the frontend

Open a second PowerShell window in the repository root:

    cd frontend
    npm ci
    $env:VITE_BACKEND_TARGET = "http://127.0.0.1:8000"
    npm run dev -- --host 127.0.0.1

Open the local URL Vite prints, normally http://localhost:3000. Select Kubernetes Mission Lab from the left navigation. The frontend proxy sends API requests to port 8000.

If the repository does not contain package-lock.json, use npm install instead of npm ci.

## Step 5 — deploy the demo workload

Open a third PowerShell window at the repository root. First verify the cluster context; then apply the lab YAML:

    kubectl config current-context
    kubectl get nodes
    kubectl apply -f k8s/mission-control-lab/
    kubectl -n mission-control-lab rollout status deployment/self-healing-demo
    kubectl -n mission-control-lab get deployment,pods,services -o wide

Expected state: Deployment self-healing-demo has 2 desired and 2 ready replicas, two Running Pods, and one ClusterIP Service. The dashboard refreshes automatically about every 10 seconds.

## Step 6 — demonstrate Kubernetes self-healing

1. In the browser, open Kubernetes Mission Lab. Show Nodes, Deployments, Pods, Services and Events.
2. In PowerShell run kubectl -n mission-control-lab get pods -o wide and note the two Pod names.
3. In the dashboard Pods table, click Delete Pod on a row marked LAB MANAGED and confirm the prompt.
4. Wait a few seconds or refresh. The old Pod should terminate and a new Pod with a different suffix should appear. The Deployment should return to 2/2 ready replicas.
5. Show the events or run the following commands:

    kubectl -n mission-control-lab get pods -w
    kubectl -n mission-control-lab get events --sort-by=.metadata.creationTimestamp
    kubectl -n mission-control-lab describe deployment self-healing-demo

Stop the watch with Ctrl+C. Explain that the Deployment declares the desired state of two replicas; the ReplicaSet controller continuously reconciles actual state toward that desired state. This is genuine Kubernetes controller behavior, not a simulated UI animation.

## Where to show Kubernetes in Docker Desktop

Open Docker Desktop and select Kubernetes in the left navigation if your version exposes it. Depending on Docker Desktop version, the resource explorer may be under Kubernetes or Containers. Expand the mission-control-lab namespace/workload and inspect self-healing-demo and its Pods. Menu names vary by release, so the portable evidence is the dashboard plus kubectl output. Docker Desktop commonly runs a local single-node learning cluster; do not describe it as a production multi-node cluster.

## API endpoints

- GET /api/kubernetes/health — connection and credential mode.
- GET /api/kubernetes/overview — actual Nodes, Deployments, Pods, Services and up to 30 recent namespace Events.
- DELETE /api/kubernetes/pods/{pod_name} — guarded deletion of a lab-owned Pod.
- FastAPI Swagger: http://127.0.0.1:8000/docs.

## Troubleshooting

Dashboard says cluster unavailable: check kubectl config current-context and kubectl get nodes in the same Windows user session. Ensure Kubernetes is running in Docker Desktop. Restart Uvicorn after changing the context.

Pods are Pending or ImagePullBackOff: run kubectl -n mission-control-lab describe pod POD_NAME and kubectl -n mission-control-lab get events. Check Docker Desktop can pull nginx:1.27-alpine.

Delete returns 403: this is intentional. Only Pods with the lab ownership label and a ReplicaSet owner can be deleted by the dashboard.

Route not found: verify the feature branch is checked out, restart the Vite dev server and select the sidebar entry.

Port 8000 is already in use: stop the existing process or run docker compose stop mission-control before starting Uvicorn on Windows.

## Cleanup

Remove only the lab workload:

    kubectl delete namespace mission-control-lab

Stop supporting Compose services when finished:

    docker compose down

Avoid docker compose down -v unless you intentionally want to delete volumes and their data.

## Verification checklist

- Docker Desktop Kubernetes reports running.
- kubectl get nodes shows a Ready node.
- The lab Deployment is 2/2 ready and two Pods are Running.
- The dashboard shows live Kubernetes API data.
- Deleting a lab Pod causes a replacement and returns the Deployment to 2/2.
- Unlabelled Pods are protected from the delete action.
- Cleanup removes only mission-control-lab.
