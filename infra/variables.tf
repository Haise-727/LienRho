variable "project" {
  type    = string
  default = "lienrho"
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "db_name" {
  type    = string
  default = "lienrho"
}

variable "db_username" {
  type      = string
  default   = "lienrho_admin"
  sensitive = true
}

# Injected as secrets; override via -var or a .tfvars file.
variable "elevenlabs_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "nvidia_litellm_api_key" {
  type      = string
  default   = ""
  sensitive = true
}
