output "alb_dns_name" {
  description = "Public URL of the application."
  value       = aws_lb.web.dns_name
}

output "ecr_repository_url" {
  description = "Push the Docker image here."
  value       = aws_ecr_repository.web.repository_url
}

output "aurora_endpoint" {
  description = "Aurora cluster endpoint (private)."
  value       = aws_rds_cluster.main.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache endpoint (private)."
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.web.name
}

output "migrate_task_definition" {
  value = aws_ecs_task_definition.migrate.family
}
