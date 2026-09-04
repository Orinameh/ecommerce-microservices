# =============================================================================
# AWS — EKS for ecommerce-microservices (keeps docker-compose for local)
# Mirrors docker-compose.yaml: 4 services + mongodb/rabbitmq (StatefulSet)
# =============================================================================

data "aws_availability_zones" "available" {}

# ---------------------------------------------------------------------------
# VPC — 3 AZs, public/private, single NAT for learning (prod: 1 per AZ)
# ---------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${var.project}-${var.env}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-igw" }
}

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = {
    Name                              = "${var.project}-private-${count.index}"
    "kubernetes.io/role/internal-elb" = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

resource "aws_subnet" "public" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 4)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = {
    Name                     = "${var.project}-public-${count.index}"
    "kubernetes.io/role/elb" = "1"
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${var.project}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "${var.project}-nat" }
  depends_on    = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.project}-public-rt" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = { Name = "${var.project}-private-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 3
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ---------------------------------------------------------------------------
# EKS — managed control plane, private subnets for nodes
# ---------------------------------------------------------------------------
resource "aws_iam_role" "eks_cluster" {
  name = "${var.cluster_name}-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "eks.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  version  = var.kubernetes_version
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids              = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator"]

  depends_on = [aws_iam_role_policy_attachment.eks_cluster_policy]
}

# Node role
resource "aws_iam_role" "eks_nodes" {
  name = "${var.cluster_name}-node-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_policy" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "eks_registry_policy" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-ng"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = aws_subnet.private[*].id
  instance_types  = var.node_instance_types

  scaling_config {
    desired_size = var.node_desired_size
    min_size     = var.node_min_size
    max_size     = var.node_max_size
  }

  update_config { max_unavailable = 1 }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_registry_policy,
  ]

  tags = { Name = "${var.cluster_name}-ng" }
}

# ---------------------------------------------------------------------------
# ECR — 4 repos, same Dockerfiles as docker-compose: services/*/Dockerfile
# Build & push: docker build -f services/order-service/Dockerfile -t <ecr_url>:$(git rev-parse --short HEAD) # or :v1.0.0 — never :latest . && docker push ...
# ---------------------------------------------------------------------------

# =============================================================================
# ROBUST PROD ARCH — commented, opt-in for learning (uncomment to expand cloud knowledge)
# This keeps current EKS (learning) working, but shows what a prod microservices arch adds.
# =============================================================================

# # 1. ALB Controller instead of nginx — managed, WAF, ACM
# # resource "helm_release" "aws_lb_controller" {
# #   name       = "aws-load-balancer-controller"
# #   repository = "https://aws.github.io/eks-charts"
# #   chart      = "aws-load-balancer-controller"
# #   namespace  = "kube-system"
# #   set { name = "clusterName", value = aws_eks_cluster.main.name }
# #   set { name = "vpcId", value = aws_vpc.main.id }
# # }
# # # Then Ingress: ingressClassName: alb, annotations: alb.ingress.kubernetes.io/scheme: internet-facing, target-type: ip, wafv2-acl-arn
# # # vs current nginx: ingressClassName: nginx (self-managed, extra hop)

# # 2. IRSA per microservice — least privilege, no node-wide ECR/Secrets
# # resource "aws_iam_role" "irsa_order" {
# #   name = "${var.cluster_name}-order-irsa"
# #   assume_role_policy = jsonencode({
# #     Version = "2012-10-17"
# #     Statement = [{ Effect = "Allow", Principal = { Federated = aws_iam_openid_connect_provider.main.arn },
# #                    Action = "sts:AssumeRoleWithWebIdentity",
# #                    Condition = { StringEquals = { "${replace(aws_iam_openid_connect_provider.main.url, "https://", "")}:sub" = "system:serviceaccount:ecommerce:order-service" } } }]
# #   })
# # }
# # # Attach: secretsmanager:GetSecretValue (app-secrets), ecr:BatchGetImage only for order-service
# # # In k8s: ServiceAccount ecommerce/order-service annotations: eks.amazonaws.com/role-arn: arn:aws:iam::...:role/order-irsa
# # # vs current: node role AmazonEKSWorkerNodePolicy (all pods share)

# # 3. Private EKS + 1 NAT/AZ (HA) + NetworkPolicy
# # # Current: single NAT (SPOF) + endpoint_public_access: true + 0.0.0.0/0
# # # Prod: count=3 NAT per AZ, endpoint_public_access=false (bastion/VPN via aws_eip + SSM), aws_security_group for nodes, then K8s NetworkPolicy:
# # # apiVersion: networking.k8s.io/v1 kind: NetworkPolicy metadata: ecommerce spec: podSelector: order-service ingress: - from: podSelector: ingress-nginx - from: payment-service egress: - to: product-service port:5002
# # # vs current: no NetworkPolicy, ecommerce can reach observability

# # 4. Managed data — replace StatefulSet
# # # vs current: StatefulSet mongodb:7.0 + rabbitmq:4.0 PVC 10Gi (single replica, no backup)
# # # Prod: aws_docdb_cluster (Mongo compat) 3AZ + aws_mq_broker (RabbitMQ) multi-AZ, or Atlas + Amazon MQ, with aws_db_instance automated_backup, point-in-time

# # 5. API Gateway + WAF in front of ALB
# # # aws_apigatewayv2_api -> ALB -> order-service:5003, handles Idempotency-Key validation (order.middleware.ts:56), JWT, throttling (vs shared/utils/middleware.ts:51 in-app)
# # # vs current: Ingress nginx only

# # OIDC provider needed for IRSA (uncomment with cluster)
# # data "tls_certificate" "eks" { url = aws_eks_cluster.main.identity[0].oidc[0].issuer }
# # resource "aws_iam_openid_connect_provider" "main" {
# #   url = aws_eks_cluster.main.identity[0].oidc[0].issuer
# #   client_id_list = ["sts.amazonaws.com"]
# #   thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
# # }
resource "aws_ecr_repository" "services" {
  for_each             = toset(var.ecr_repositories)
  name                 = "${var.project}/${each.value}"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
  tags = { Service = each.value }
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "keep last 10"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
      action       = { type = "expire" }
    }]
  })
}
