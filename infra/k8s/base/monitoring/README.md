# Monitoring — up-to-date (2026-09)

Stack: `kube-prometheus-stack` (Prometheus Operator) + `prom-client@15.1.3` + Grafana + Alertmanager.

## 1. Install once (requires CRDs)
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kube-prom prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=admin \
  --set grafana.ingress.enabled=true \
  --version 71.x # latest 2026

# Verify CRDs
kubectl get crd servicemonitors.monitoring.coreos.com prometheusrules.monitoring.coreos.com
```

## 2. App instrumentation (already scaffolded)

* `shared/utils/metrics.ts` — `prom-client@15.1.3` `collectDefaultMetrics`, `http_request_duration_seconds` (golden signals), `http_requests_total`, `db_query_duration_seconds`, `rabbitmq_*`. Low-cardinality labels only.
* Integrate per service `src/index.ts`:
```ts
import { registry, setupMetrics, metricsMiddleware } from "../../shared/utils/metrics";
import express from "express";
const app = express();
setupMetrics(process.env.SERVICE_NAME || "customer-service");
app.use(metricsMiddleware);
// expose /metrics before auth, not via public ingress
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});
app.get("/health", (_req, res) => res.json({status:"ok"})); // already probed
```

* Rebuild: `docker build -f services/customer-service/Dockerfile .` — no extra deps (shared already has `prom-client@15.1.3`).

## 3. Deploy monitors
```bash
# Base already includes monitoring/* via kustomization.yaml:23
kubectl apply -k infra/k8s/base
# Or isolated:
kubectl apply -k infra/k8s/base/monitoring
# Production overlay auto-includes via ../../base
kubectl apply -k infra/k8s/overlays/production
```

Check:
```bash
kubectl -n ecommerce get servicemonitor,prometheusrule
kubectl -n monitoring get prometheus
# Targets: Prometheus UI → Status → Targets → ecommerce-services (should be UP)
# Alerts: Prometheus → Alerts → EcommerceHighErrorRate etc.
```

## 4. Grafana
* `Grafana → Dashboards → Ecommerce Microservices — Golden Signals` (auto-imported via `grafana_dashboard: "1"` label, ConfigMap `ecommerce-grafana-dashboard:3`).
* Import also `NodeJS` dashboard ID `11159` for `nodejs_*` metrics.

## 5. Alerting (Slack/PagerDuty)
* Copy `alertmanager-config.yaml.example` → create Secret via SealedSecrets/ESO (never commit webhook):
```bash
kubectl create secret generic alertmanager-kube-prom-kube-pm-alertmanager -n monitoring --from-file=alertmanager.yaml
# Or via Helm values: infra/k8s/base/monitoring/alertmanager-values.yaml
```
* Test: `curl -XPOST http://alertmanager.monitoring:9093/api/v1/alerts -d '[{"labels":{"alertname":"Test","severity":"warning"}}]'`

## 6. Runbook
* Alerts have `runbook_url` + `summary` annotations. Keep `for: 5m` to avoid flaps, `group_by: [alertname, service]`.
* Tune `PROMETHEUS_RULES` thresholds: error 5% → 99.95% SLO burn, p95 500ms per your SLO.

## 7. Optional
* Logs: Alloy/Promtail → Loki (Winston already JSON). 
* Traces: OTEL → Tempo (add `shared/utils/tracing.ts`).

No commit of secrets — use `secrets.example.yaml` + `ExternalSecrets`.
