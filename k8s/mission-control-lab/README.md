# Kubernetes Mission Lab manifests

These manifests create an isolated mission-control-lab namespace with a two-replica NGINX Deployment and a ClusterIP Service. They do not modify existing Docker Compose containers.

From the repository root, apply with kubectl apply -f k8s/mission-control-lab/ and check with kubectl -n mission-control-lab rollout status deployment/self-healing-demo and kubectl -n mission-control-lab get deploy,pods,svc -o wide.

Each demo Pod carries app.kubernetes.io/managed-by=mission-control-kubernetes-lab. The API checks that label and ReplicaSet ownership before permitting deletion. Remove the lab using kubectl delete namespace mission-control-lab.
