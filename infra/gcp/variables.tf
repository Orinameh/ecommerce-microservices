variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "ecommerce"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "cluster_name" {
  type    = string
  default = "ecommerce-gke"
}

variable "kubernetes_version" {
  type    = string
  default = "1.29"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "node_machine_type" {
  type    = string
  default = "e2-medium"
}

variable "node_min_count" { default = 1 }
variable "node_max_count" { default = 4 }
variable "node_initial_count" { default = 2 }

variable "artifact_repos" {
  type    = list(string)
  default = ["customer-service", "product-service", "order-service", "payment-service"]
}
