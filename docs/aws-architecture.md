# LienRho — AWS Production Infrastructure (Issue #34)

> Planned architecture for moving LienRho from local dev → AWS production.
> Spec: `docs/aws_migration_plan.md` · Ticket: [#34](https://github.com/Haise-727/LienRho/issues/34)

## Architecture Diagram

```mermaid
flowchart TB
    U["User / Browser"] -->|"HTTPS (443)"| ALB["Application Load Balancer\n(public subnet)"]

    subgraph VPC["VPC (private by default)"]
        ALB --> FARGATE["ECS Fargate\nNext.js standalone :3000\n(public subnet, behind ALB)"]

        subgraph PRIV["Private Subnets"]
            AURORA["Amazon Aurora Serverless v2\nPostgreSQL :5432\nStitch Ledger / Offers / Bids"]
            REDIS["ElastiCache (Redis)\n:6379\nSETNX concurrency locks"]
            SEC["Secrets Manager\nDATABASE_URL / REDIS_URL /\nELEVENLABS_API_KEY"]
        end

        FARGATE -->|"5432 (SG-scoped)"| AURORA
        FARGATE -->|"6379 (SG-scoped)"| REDIS
        FARGATE -->|"reads at boot"| SEC
    end

    ECR["ECR repo: lienrho-web"] -.->|"image pull"| FARGATE

    GH["GitHub Actions\npush to main"] -->|"docker build + push"| ECR
    GH -->|"prisma migrate deploy"| AURORA
    GH -->|"force-new-deployment"| FARGATE
```

## What each box is (plain English)

| Component | AWS service | Job |
|---|---|---|
| **ALB** | Application Load Balancer | The public HTTPS front door. Only thing users touch. |
| **ECS Fargate** | Serverless containers | Runs the Next.js app. No servers to babysit. Scales by task count. |
| **Aurora Serverless v2** | Managed PostgreSQL | The database. Scales to 0 when idle, up under load. |
| **ElastiCache** | Managed Redis | Distributed locks for the CodeCrafters Pareto matcher. |
| **Secrets Manager** | Secure config store | Holds DB/Redis/API keys — never baked into the image. |
| **ECR** | Container registry | Where the built Docker image lives. |
| **GitHub Actions** | CI/CD | On merge to `main`: build → push → migrate → redeploy. |

## Security model
- Aurora + ElastiCache live in **private subnets** → not publicly reachable.
- Security Groups only allow `5432`/`6379` traffic **from the Fargate SG**.
- Secrets injected at runtime from Secrets Manager, not in the repo or image.

## CI/CD flow (what happens on every `main` push)
```mermaid
flowchart LR
    A["push to main"] --> B["lint + tsc --noEmit (gate)"]
    B --> C["docker build (standalone)"]
    C --> D["push to ECR"]
    D --> E["prisma migrate deploy (Aurora)"]
    E --> F["ecs update-service --force-new-deployment"]
    F --> G["live via ALB URL"]
```

## Open decisions (ask @Haise-727 / team)
1. **#34 (Fargate + Aurora) vs #30 (Amplify + Supabase)** — these contradict. #34 wins per the migration plan; close #30 or re-scope it.
2. **Region** — e.g. `ap-south-1` / `us-east-1`.
3. **Secrets** — Secrets Manager (recommended) vs SSM.
4. **Cost** — t4g.micro + Aurora Serverless v2 is a few $/day for the demo.
