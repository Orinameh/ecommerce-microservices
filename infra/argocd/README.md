# ArgoCD — GitOps for `infra/k8s` (base/overlays) + `infra/observability`

Keeps `docker-compose` for local, `infra/k8s/overlays/production` is source of truth for GitOps. No code change. Base/overlays as per `infra/k8s/README.md`.

## Install (k3d / EKS / GKE)

```bash
# Helm (recommended)
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm upgrade --install argocd argo/argo-cd -n argocd --create-namespace -f infra/argocd/values.yaml
kubectl -n argocd rollout status deployment/argocd-server

# or Kustomize
# kubectl create namespace argocd
# kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access UI
kubectl -n argocd port-forward svc/argocd-server 8080:80 &
# http://localhost:8080 or http://argocd.ecommerce.local (ingress)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
# user: admin
```

## Applications

`infra/argocd/application.yaml` defines 2 `Application` CRs:

* `ecommerce` → `infra/k8s/overlays/production` (base + overlays pattern) → namespace `ecommerce` (customer/product/order/payment + mongodb/rabbitmq + worker). For dev: change to `infra/k8s/overlays/dev`. Syncs `README:71` flow.
* `ecommerce-observability` → `infra/observability` → `observability` (Prometheus/Grafana/Loki).

```bash
kubectl apply -f infra/argocd/namespace.yaml
kubectl apply -f infra/argocd/application.yaml
# ArgoCD will CreateNamespace + ServerSideApply infra/k8s/overlays/production and infra/observability
argocd app sync ecommerce
argocd app sync ecommerce-observability
```

Set `spec.source.repoURL` to your GitHub fork before applying.

## CI

`README:148` `github workflows` → build `services/*/Dockerfile` with immutable tag `v1.0.0` or `$(git rev-parse --short HEAD)` (never `:latest` per `infra/k8s/*/deployment.yaml:18`), push to `ghcr.io` / `ECR` / `Artifact Registry`, then ArgoCD auto-syncs (no `kubectl apply`).

## Switching

```bash
# ArgoCD manages k8s
kubectl delete application -n argocd ecommerce --cascade=false # keep workloads
# back to compose
docker compose up --build
```
