locals {
  database_url = "postgresql://${var.db_username}:${random_password.db.result}@${aws_rds_cluster.main.endpoint}:5432/${var.db_name}?sslmode=require"
  redis_url    = "rediss://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379"
}

resource "aws_secretsmanager_secret" "app" {
  name = "${var.project}/app"
  tags = { Name = "${var.project}-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    DATABASE_URL           = local.database_url
    DIRECT_URL             = local.database_url
    REDIS_URL              = local.redis_url
    ELEVENLABS_API_KEY     = var.elevenlabs_api_key
    NVIDIA_LITELLM_API_KEY = var.nvidia_litellm_api_key
  })
}
