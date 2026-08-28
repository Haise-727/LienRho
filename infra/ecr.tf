resource "aws_ecr_repository" "web" {
  name                 = "lienrho-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.project}-ecr" }
}

# Keep only the 10 most recent images to avoid storage creep.
resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "keep last 10 images"
      action       = { type = "expire", details = { countType = "imageCountMoreThan", countNumber = 10 } }
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 10 }
    }]
  })
}
