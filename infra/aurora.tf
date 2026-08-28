resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project}-db-subnet" }
}

resource "aws_rds_cluster" "main" {
  cluster_identifier   = "${var.project}-aurora"
  engine               = "aurora-postgresql"
  engine_mode          = "provisioned"
  engine_version       = "15.4"
  database_name        = var.db_name
  master_username      = var.db_username
  master_password      = random_password.db.result
  storage_encrypted    = true
  skip_final_snapshot  = true

  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.db.id]
  enable_http_endpoint       = false
  apply_immediately          = true

  serverlessv2_scaling_configuration {
    max_capacity = 4
    min_capacity = 0.5
  }

  tags = { Name = "${var.project}-aurora" }
}

resource "aws_rds_cluster_instance" "main" {
  count              = 1
  identifier         = "${var.project}-aurora-1"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version
  publicly_accessible = false
}

resource "random_password" "db" {
  length  = 24
  special = false
}
