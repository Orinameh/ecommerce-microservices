variable "project" {
  description = "Project name"
  type        = string
  default     = "ecommerce"
}

variable "env" {
  description = "Environment"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "ecommerce-eks"
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium"]
}

variable "node_min_size" { default = 2 }
variable "node_max_size" { default = 4 }
variable "node_desired_size" { default = 2 }

# ECR repos for the 4 services (same Dockerfiles as docker-compose: services/*/Dockerfile)
variable "ecr_repositories" {
  type    = list(string)
  default = ["customer-service", "product-service", "order-service", "payment-service"]
}
