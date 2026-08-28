# AWS Migration Plan (Sprint 2)

This document outlines the transition plan for moving the LienRho capital marketplace from the Sprint 1 MVP architecture (Supabase shared DB + local Next.js) to the final Sprint 2 AWS Production deployment.

## Goal Description
To satisfy the enterprise infrastructure requirements of CSI ORIGIN 2026 Problem Statement 5, we must deploy the unified Next.js Full-Stack application to AWS. This ensures high availability, secure VPC isolation for the financial ledger, and scalable concurrency locks.

## Target Architecture
* **Frontend & API Runtime:** AWS ECS Fargate (Serverless Containers)
* **Database (Stitch Ledger):** Amazon Aurora Serverless v2 (PostgreSQL)
* **Concurrency Locks (CodeCrafters):** Amazon ElastiCache (Redis)
* **Asset Storage:** Amazon S3 (Encrypted PDFs & ElevenLabs Audio caching)

---

## Phase 1: Database Migration (Supabase → Aurora)
**Owner:** Ragav Hariharan (Track 1)

1. **Provision Aurora:** 
   - Spin up an Amazon Aurora Serverless v2 PostgreSQL cluster via the AWS Console (or Terraform).
   - Ensure it is placed in private subnets within your VPC for financial security.
2. **Update Prisma:**
   - Change the `DATABASE_URL` in the production environment variables to point to the Aurora cluster endpoint.
   - Run `npx prisma migrate deploy` in your CI/CD pipeline to build the tables on Aurora.
   - *Note: Do not use `db push` in production; use proper Prisma migrations.*
   - **Ready:** `frontend/prisma/migrations/0_init` is the baseline migration,
     and Supabase is marked as having it applied. `migrate deploy` has been
     verified against an empty database — it creates all 13 tables, and the
     seed then runs clean and balanced. No baselining work is left for cutover.

## Phase 2: Caching & Locks (Local Docker → ElastiCache)
**Owner:** Track 2 Developer

1. **Provision ElastiCache:**
   - Create a Redis OSS ElastiCache cluster (t4g.micro is sufficient for the hackathon).
   - Ensure the Security Group allows inbound traffic on port `6379` from the ECS Fargate security group.
2. **Update Locks:**
   - Change the `REDIS_URL` environment variable to the ElastiCache endpoint.
   - Verify the `SETNX` distributed locks in the CodeCrafters Pareto algorithm still function correctly with the managed Redis instance.

## Phase 3: Application Containerization (Next.js → ECS Fargate)
**Owner:** DevOps / Track 4 Developer

1. **Dockerize Next.js:**
   - Create a `Dockerfile` at the root of the repo utilizing the Next.js standalone output feature to minimize image size.
2. **Push to ECR:**
   - Create an Amazon Elastic Container Registry (ECR) repository named `lienrho-web`.
   - Build and push the Docker image:
     ```bash
     docker build -t lienrho-web .
     docker tag lienrho-web:latest <account_id>.dkr.ecr.<region>.amazonaws.com/lienrho-web:latest
     docker push <account_id>.dkr.ecr.<region>.amazonaws.com/lienrho-web:latest
     ```
3. **Deploy to Fargate:**
   - Create an ECS Task Definition that references the ECR image.
   - Inject `DATABASE_URL`, `REDIS_URL`, and `ELEVENLABS_API_KEY` as secure environment variables (via AWS Secrets Manager).
   - Expose container port `3000`.
   - Setup an Application Load Balancer (ALB) to route HTTP traffic to the Fargate tasks.

## Verification & Cutover
- **Network Isolation:** Ensure Aurora and ElastiCache are NOT publicly accessible. They should only accept traffic from the Fargate Tasks.
- **Data Integrity:** Run the Track 1 `seed.ts` script against Aurora to ensure the Stitch ledger and mock providers are ready for the final demo pitch.
