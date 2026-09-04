# Kubernetes — Interchangeable with Docker Compose (Base/Overlays)

This folder is **separate** from `docker-compose.yaml`. Keep `docker compose up --build` for local dev; use `k8s/` when you want Kubernetes. No app code or Dockerfile changes — same images `services/*/Dockerfile` (`oven/bun→node:26-alpine`).

Structure follows **kustomize best practice** `base/` (DRY common) + `overlays/{dev,production}` (env patches) — as you sketched.

```
infra/k8s/
├── base/          # common — no env drift
│   ├── namespace.yaml, configmap.yaml, secrets.example.yaml, ingress.yaml
│   ├── mongodb/{service,statefulset}.yaml
│   ├── rabbitmq/{service,statefulset}.yaml
│   ├── customer-service/{deployment,service}.yaml (5001)
│   ├── product-service/{deployment,service}.yaml (5002)
│   ├── order-service/{deployment,service}.yaml (5003)
│   ├── payment-service/{deployment,service}.yaml (5004)
│   ├── transaction-worker/deployment.yaml
│   └── kustomization.yaml # images: ghcr.io/your-org/*:v1.0.0 (never :latest; overlay overrides to SHA)
└── overlays/
    ├── dev/kustomization.yaml        # replicas:1, same images
    └── production/kustomization.yaml # replicas:2-3, SHA via CI, commonLabels env:production
```

## Prereqs
- Docker + k3d / minikube / kind + kubectl + kustomize
- Images: `docker build -f services/<service>/Dockerfile -t ghcr.io/your-org/<service>:$(git rev-parse --short HEAD) .` (or `:v1.0.0` semver — never `:latest`; CI `.github/workflows/ci.yml` does this automatically)

## Quick Start

```bash
# 1. Secrets (gitignored)
cp infra/k8s/base/secrets.example.yaml infra/k8s/base/secrets.yaml
# edit MONGODB_URI, MONGO_INITDB_ROOT_PASSWORD, RABBITMQ_DEFAULT_PASS
# or: kubectl -n ecommerce create secret generic app-secrets --from-env-file=.env

# 2. Apply — dev (k3d, 1 replica) or production (EKS/GKE, 2-3 replicas)
# Dev:
kubectl apply -k infra/k8s/overlays/dev
# Production:
kubectl apply -k infra/k8s/overlays/production

# Or apply base directly (same as dev without patches):
# kubectl apply -k infra/k8s/base

# Alternative manual (without kustomize):
# kubectl apply -f infra/k8s/base/namespace.yaml
# kubectl apply -f infra/k8s/base/configmap.yaml
# kubectl apply -f infra/k8s/base/secrets.yaml
# kubectl apply -f infra/k8s/base/mongodb/
# ...

# 3. Wait
kubectl -n ecommerce rollout status statefulset/mongodb
kubectl -n ecommerce rollout status deployment/order-service

# 4. Test (port-forward or ingress)
kubectl -n ecommerce port-forward svc/order-service 5003:5003 &
kubectl -n ecommerce port-forward svc/product-service 5002:5002 &
kubectl -n ecommerce port-forward svc/customer-service 5001:5001 &
kubectl -n ecommerce port-forward svc/payment-service 5004:5004 &
bash test-flow.sh # same as compose — Idempotency-Key required, amount=price per order.service.ts:48
```

## Switching Back
```bash
# Stop k8s (dev)
kubectl delete -k infra/k8s/overlays/dev --ignore-not-found
# or production
kubectl delete -k infra/k8s/overlays/production --ignore-not-found
# Start compose (unchanged)
docker compose up --build
```

## Notes
- `base/configmap.yaml` mirrors `docker-compose.yaml` env (`MONGODB_URI` from Secret, `RABBITMQ_URL` etc); `overlays/production` patches `replicas:2→3` + `images` SHA via CI.
- `mongodb`/`rabbitmq` are `StatefulSet` with PVCs (was `mongodb_data`/`rabbitmq_data` volumes).
- Healthchecks map to `docker-compose.yaml` `wget /health` probes.
- Ingress `ecommerce.local` → `/api/*` (compose exposes `localhost:5001-5004` directly).
- Images must be pushed to registry for remote clusters: `docker push ghcr.io/your-org/<service>:$(git rev-parse --short HEAD)` (CI pushes SHA + immutable tag via `docker/metadata-action`, never `:latest`). For ECR/GAR see `infra/aws`/`gcp` README.

## Why Base/Overlays

* Flat `infra/k8s/kustomization.yaml` works for single env but drifts when `dev` (1 replica, no persistence) vs `production` (3 replicas, `resources`, `HPA`, `NetworkPolicy`). `base` keeps DRY, `overlays` isolate env patches — Kubernetes best practice and required for ArgoCD `Application` per env (`infra/argocd/application.yaml` → `path: infra/k8s/overlays/production`).
* Verified: `kubectl apply --dry-run=client -k infra/k8s/base` + `-k infra/k8s/overlays/dev` + `-k infra/k8s/overlays/production` all ok.
