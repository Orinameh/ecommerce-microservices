# =============================================================================
# GCP — GKE for ecommerce-microservices (keeps docker-compose for local)
# Mirrors docker-compose.yaml: 4 services + mongodb/rabbitmq
# =============================================================================

# ---------------------------------------------------------------------------
# VPC — auto subnet disabled, 1 subnet for nodes (mirrors AWS 3 AZ private)
# ---------------------------------------------------------------------------
resource "google_compute_network" "main" {
  name                    = "${var.project_name}-${var.env}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.project_name}-${var.env}-subnet"
  ip_cidr_range = var.vpc_cidr
  region        = var.region
  network       = google_compute_network.main.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }
}

resource "google_compute_router" "main" {
  name    = "${var.project_name}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "${var.project_name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# ---------------------------------------------------------------------------
# GKE — Autopilot disabled, Standard cluster (learning: 1 zone, prod: regional)
# ---------------------------------------------------------------------------
resource "google_container_cluster" "main" {
  name     = var.cluster_name
  location = var.zone # zonal for learning cost; use var.region for regional

  network    = google_compute_network.main.name
  subnetwork = google_compute_subnetwork.main.name

  min_master_version = var.kubernetes_version

  remove_default_node_pool = true
  initial_node_count       = 1

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "all"
    }
  }

  # For learning: disable binary auth etc
}

resource "google_container_node_pool" "main" {
  name       = "${var.cluster_name}-pool"
  location   = var.zone
  cluster    = google_container_cluster.main.name
  node_count = var.node_initial_count

  autoscaling {
    min_node_count = var.node_min_count
    max_node_count = var.node_max_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.node_machine_type
    disk_type    = "pd-standard"
    disk_size_gb = 50
    image_type   = "COS_CONTAINERD"

    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]

    labels = {
      project = var.project_name
      env     = var.env
    }

    workload_metadata_config { mode = "GKE_METADATA" }

    tags = ["gke-node", "${var.project_name}-${var.env}"]
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 1
  }
}

# ---------------------------------------------------------------------------
# Artifact Registry — 1 repo, 4 images (same Dockerfiles as compose)
# Build & push: docker build -f services/order-service/Dockerfile -t <region>-docker.pkg.dev/<project>/ecommerce/order-service:$(git rev-parse --short HEAD) # or :v1.0.0 — never :latest . && docker push ...
# ---------------------------------------------------------------------------
resource "google_artifact_registry_repository" "ecommerce" {
  location      = var.region
  repository_id = var.project_name
  description   = "ecommerce microservices"
  format        = "DOCKER"
}

# IAM for GKE nodes to pull (default SA already has, but explicit for learning)
resource "google_project_iam_member" "artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${var.project_id}.svc.id.goog"
}

# =============================================================================
# ROBUST PROD ARCH — commented, opt-in for learning
# =============================================================================

# # 1. GKE Ingress (GCLB) vs nginx
# # resource "google_compute_managed_ssl_certificate" "ecommerce" {
# #   name = "ecommerce-cert"
# #   managed { domains = ["ecommerce.example.com"] }
# # }
# # # Ingress: ingressClassName: gce, annotations: kubernetes.io/ingress.global-static-ip-name, networking.gke.io/managed-certificates: ecommerce-cert, vs nginx: ingressClassName: nginx

# # 2. Workload Identity per microservice (least privilege) — vs node cloud-platform scope
# # resource "google_service_account" "order_sa" {
# #   account_id = "order-service"
# #   display_name = "order-service"
# # }
# # resource "google_project_iam_member" "order_secret_accessor" {
# #   role = "roles/secretmanager.secretAccessor"
# #   member = "serviceAccount:${google_service_account.order_sa.email}"
# # }
# # resource "google_service_account_iam_member" "order_wi" {
# #   service_account_id = google_service_account.order_sa.name
# #   role = "roles/iam.workloadIdentityUser"
# #   member = "serviceAccount:${var.project_id}.svc.id.goog[ecommerce/order-service]"
# # }
# # # In k8s: ServiceAccount ecommerce/order-service annotations: iam.gke.io/gcp-service-account: order-service@project.iam.gserviceaccount.com
# # # vs current: node oauth_scopes cloud-platform (all pods share)

# # 3. Private GKE hardening
# # # Current: master_authorized 0.0.0.0/0 + zonal (cost)
# # # Prod: google_container_cluster regional (var.region, not var.zone), private_cluster_config enable_private_nodes true, master_authorized_networks: bastion CIDR, enable_shielded_nodes true, binary_authorization { evaluation_mode: PROJECT_SINGLETON_POLICY_ENFORCE }

# # 4. Managed data
# # # vs current: StatefulSet mongodb/rabbitmq PVC 10Gi
# # # Prod: google_firestore or Mongo Atlas + google_pubsub_topic (instead of RabbitMQ) or Memorystore, with backup

# # 5. Cloud Armor + API Gateway
# # # google_compute_security_policy (Cloud Armor WAF) fronting GCLB, plus Apigee/API Gateway for Idempotency-Key, JWT
