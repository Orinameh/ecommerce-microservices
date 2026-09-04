# Observability — LGTM for `infra/k8s` (logs, metrics, traces)

Separate from `docker-compose.yaml`; works with `k3d` or `EKS`/`GKE` via `infra/aws`/`gcp`. No app code change — `shared/utils/logger.ts:1` Winston already logs JSON, `k8s/*/deployment.yaml` probes `/health`.

## Stack (LGTM)

* **L**oki — logs (replaces `error.log`/`combined.log` file transport, now stdout)
* **G**rafana — dashboards
* **T**empo — traces (OTel)
* **M**imir / Prometheus — metrics
* **Promtail** — log shipper
* **kube-prometheus-stack** — Prometheus Operator + Grafana + Alertmanager

## Install (Helm, learning)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Namespace (or ArgoCD will CreateNamespace)
kubectl apply -f infra/observability/namespace.yaml

# Prometheus + Grafana (metrics)
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n observability -f infra/observability/prometheus/values.yaml

# Loki + Promtail (logs)
helm upgrade --install loki grafana/loki -n observability -f infra/observability/loki/values.yaml
helm upgrade --install promtail grafana/promtail -n observability

# Tempo (traces, optional for learning)
helm upgrade --install tempo grafana/tempo -n observability

# Apply ServiceMonitor / Datasources / Dashboards (or via ArgoCD)
kubectl apply -k infra/observability/
```

Helm values are intentionally minimal for learning — see `infra/observability/*/values.yaml` (create from `values.example.yaml` if needed). For prod, pin versions and set `persistence.enabled: true` + `storageClass`.

## What It Observes

* **Metrics** `infra/observability/prometheus/servicemonitor.yaml` scrapes `ecommerce` `ClusterIP` `/health` every 15s (or Service annotations). Add `prom-client` to `shared/utils/metrics.ts` for `http_requests_total`, `circuit_breaker_state` (`shared/utils/circuitBreaker.ts:122`), `outbox_pending` (`payment.service.ts:127`).
* **Logs** Promtail tails `stdout` from `Winston` (`shared/utils/logger.ts:28` `Console` only in prod) → Loki → Grafana `Explore`.
* **Traces** Add `opentelemetry-js` to `shared/utils/middleware.ts:68` `createLoggingMiddleware` → Tempo → Grafana.
* **Dashboards** `grafana/dashboard.yaml` `ecommerce.json` (Order Rate, Outbox Pending, Circuit State, RabbitMQ Depth, Mongo Connections). Import via `grafana_datasource: 1` label.

## Access

```bash
kubectl -n observability port-forward svc/kube-prometheus-stack-grafana 3000:80 &
# http://localhost:3000 admin/prom-operator
kubectl -n observability port-forward svc/loki 3100:3100 &
kubectl -n ecommerce port-forward svc/order-service 5003:5003 &
# Generate traffic
bash test-flow.sh
```

## ArgoCD Integration

`infra/argocd/application.yaml` `ecommerce-observability` syncs `infra/observability` → `observability` namespace automatically (see `infra/argocd/README.md`).

## Switching Back

```bash
helm -n observability uninstall kube-prometheus-stack loki promtail tempo
kubectl delete -k infra/observability/ --ignore-not-found
# compose still works
docker compose up --build
```
