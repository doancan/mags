---
name: infrastructure
description: Provides infrastructure and DevOps guidance including deployment, CI/CD, monitoring, containerization, and cloud architecture. Triggers on infrastructure, devops, deployment, docker, kubernetes, ci/cd, monitoring, observability, cloud, scaling, load balancing.
version: 1.0.0
user-invocable: false
---

# Infrastructure

## Deployment Checklist

Complete every item before deploying to production:

- **Environment parity:** Verify that staging mirrors production in configuration, dependency versions, and infrastructure topology. Test the exact artifact (container image, binary) that will be deployed to production.
- **Health checks:** Ensure every service exposes a health endpoint (`/health` or `/healthz`) that checks database connectivity, cache availability, and critical dependency status. Configure the orchestrator (Kubernetes, ECS) to use this endpoint for readiness and liveness probes.
- **Graceful shutdown:** Handle SIGTERM signals properly. Stop accepting new requests, finish in-flight requests (with a timeout of 30 seconds), close database connections, and flush logs before exiting.
- **Rollback plan:** Document the exact rollback procedure before deploying. For container deployments, keep the previous image tag available. For database changes, have a tested rollback migration. Verify the rollback procedure works in staging first.
- **Database migrations:** Run migrations before deploying new application code. Ensure migrations are backward-compatible with the currently running version (see Database Migrations section). Never run destructive migrations during deployment.
- **Feature flags:** Gate new features behind feature flags for critical releases. This allows disabling a feature without a full rollback. Use a feature flag service (LaunchDarkly, Unleash, or a simple config-based system).
- **DNS and SSL:** Verify DNS records point to the correct endpoints. Check SSL certificate expiration dates (must be more than 30 days out). Confirm TLS 1.2+ is enforced and older protocols are disabled.
- **Smoke tests:** Run automated smoke tests immediately after deployment. Test critical user paths: authentication, core business operations, and external integrations. Automate these in the CI/CD pipeline as a post-deploy step.
- **Monitoring and alerting:** Confirm that dashboards are updated for the new version. Verify alert thresholds are set for error rate spikes, latency increases, and resource exhaustion. Assign an on-call engineer for the deployment window.
- **Communication:** Notify the team before and after deployment. For user-facing changes, update status pages and changelogs.

## CI/CD Pipeline

Structure the pipeline in six stages, each with a clear gate:

1. **Build:** Compile code, resolve dependencies, generate artifacts. Fail on compilation errors, missing dependencies, or lint violations. Cache dependencies between runs. Output: a versioned, immutable build artifact.

2. **Test:** Run unit tests, integration tests, and static analysis (SAST). Fail on test failures or coverage decrease. Run tests in parallel where possible. Output: test report with coverage metrics.

3. **Package:** Build the deployable artifact (Docker image, binary, archive). Tag with the git commit SHA and semantic version. Push to an artifact registry (container registry, package repository). Scan the artifact for vulnerabilities.

4. **Deploy:** Deploy to the target environment using infrastructure-as-code. Use blue-green or canary deployment for production. Apply database migrations as a separate step before the application deployment. Never deploy directly from a developer machine.

5. **Verify:** Run smoke tests and health checks against the deployed environment. Verify key metrics (error rate, latency, resource usage) are within normal bounds. If verification fails, trigger automatic rollback.

6. **Monitor:** Watch dashboards for 15-30 minutes after deployment. Check for error rate increases, latency degradation, and abnormal resource consumption. Keep the deployer available for the monitoring window.

Pipeline rules:

- Every stage must pass before proceeding to the next.
- Production deployments require approval from at least one reviewer.
- All pipeline configuration lives in version control alongside the application code.
- Pipeline secrets are stored in the CI/CD platform's secret management, not in repository files.

## Container Best Practices

- **Multi-stage builds:** Separate build dependencies from runtime. The final image should contain only the compiled application and runtime dependencies. This reduces image size and attack surface.
  ```dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM node:20-alpine AS runtime
  WORKDIR /app
  COPY --from=build /app/dist ./dist
  COPY --from=build /app/node_modules ./node_modules
  USER node
  CMD ["node", "dist/main.js"]
  ```
- **Non-root user:** Never run containers as root. Create a dedicated user in the Dockerfile and switch to it with `USER`. Most base images provide a non-root user (e.g., `node` in Node.js images).
- **Pin versions:** Pin base image versions to a specific tag or SHA digest, not `latest`. Pin package manager versions in lock files. This ensures reproducible builds.
- **`.dockerignore`:** Exclude unnecessary files from the build context: `.git`, `node_modules`, `*.md`, `.env`, test files, documentation. A smaller build context means faster builds.
- **Health checks:** Define a `HEALTHCHECK` instruction in the Dockerfile or configure health checks in the orchestrator. The check should verify the application is ready to serve requests.
- **Minimize layers:** Combine related `RUN` commands with `&&` to reduce the number of layers. Order instructions from least to most frequently changed to maximize layer caching.
- **Log to stdout/stderr:** Do not write logs to files inside the container. Write to stdout and stderr so the container runtime (Docker, Kubernetes) can collect and forward logs.
- **No secrets in images:** Never copy `.env` files, credentials, or private keys into Docker images. Use runtime environment variables or mounted secrets.

## Observability

Implement all three pillars of observability:

**Metrics (Prometheus, Datadog, CloudWatch):**
- Track the four golden signals: latency, traffic, errors, and saturation.
- Instrument custom business metrics: signups per minute, orders processed, payment failures.
- Use histograms for latency (not averages). Track p50, p95, and p99 percentiles.
- Set alert thresholds based on SLOs, not arbitrary numbers. Alert on symptoms (error rate > 1%), not causes (CPU > 80%).
- Retain metrics for at least 30 days at full resolution, 1 year at reduced resolution.

**Logs (structured JSON, ELK, Loki):**
- Use structured logging (JSON format) with consistent field names across all services.
- Include in every log entry: `timestamp`, `level`, `service`, `correlation_id`, `message`.
- Add `user_id`, `request_id`, and `trace_id` to request-scoped log entries.
- Use log levels consistently: ERROR for failures requiring action, WARN for degraded but functional states, INFO for significant business events, DEBUG for development troubleshooting (disabled in production).
- Never log sensitive data: passwords, tokens, credit card numbers, PII.

**Traces (OpenTelemetry, Jaeger, Zipkin):**
- Instrument all service-to-service calls, database queries, and external API calls with trace spans.
- Propagate trace context (W3C Trace Context headers) across service boundaries.
- Add custom attributes to spans: `user.id`, `order.id`, `payment.method`.
- Set up sampling to keep costs manageable: 100% for errors, 10-20% for successful requests in production.
- Use trace data to identify latency bottlenecks and dependency failures.

**Dashboards:**
- Create a service overview dashboard showing all golden signals for each service.
- Create a deployment dashboard showing deploy events overlaid on error and latency graphs.
- Create an on-call dashboard with active alerts, recent incidents, and system health status.

## Environment Management

- **Dev/staging/prod parity:** All environments must use the same operating system, database engine, cache engine, and message broker. Differences between environments cause bugs that only appear in production. Use infrastructure-as-code to ensure parity.
- **Feature flags over environment branches:** Do not maintain environment-specific code branches or configuration files with conditional logic. Use feature flags to control behavior differences. The same artifact must be deployable to any environment.
- **Configuration management:** Store configuration in environment variables or a configuration service. Never hardcode environment-specific values (URLs, credentials, feature toggles) in application code. Use a layered config approach: defaults < config file < environment variables < runtime overrides.
- **Environment provisioning:** Automate environment creation with infrastructure-as-code (Terraform, Pulumi, CloudFormation). Developers should be able to spin up a complete local environment with a single command (`docker compose up` or equivalent).
- **Data management:** Use anonymized production data or realistic seed data for staging. Never copy raw production data with PII to non-production environments. Automate test data generation.

## Database Migrations

- **Backward-compatible migrations only:** Every migration must be compatible with both the old and new version of the application code. This enables zero-downtime deployments where old and new instances run simultaneously.
- **Expand-contract pattern:** For breaking schema changes, use a three-phase approach:
  1. **Expand:** Add the new column/table alongside the old one. Deploy code that writes to both.
  2. **Migrate:** Backfill data from old to new. Verify data integrity.
  3. **Contract:** Remove the old column/table. Deploy code that only uses the new structure.
- **Rollback scripts:** Every migration must have a corresponding rollback. Test rollbacks in staging before deploying to production. Automated rollback should be possible without data loss.
- **Never rename or drop columns directly:** Add a new column, migrate data, update code, then drop the old column in a later release. This prevents downtime during deployment.
- **Migration ordering:** Use sequential numbering or timestamps for migration files. Never reorder or modify a migration that has been applied to any environment.
- **Test migrations:** Run migrations against a copy of the production schema (structure only, no data) in CI. Verify both up and down migrations succeed.

## Disaster Recovery

- **Backup strategy:** Automate database backups with point-in-time recovery. Take full backups daily and incremental backups every hour. Store backups in a different region or availability zone than the primary database. Encrypt backups at rest.
- **RTO/RPO targets:** Define Recovery Time Objective (how long until the system is back) and Recovery Point Objective (how much data loss is acceptable) for each service tier. Critical services: RTO 1 hour, RPO 15 minutes. Non-critical: RTO 4 hours, RPO 1 hour.
- **Failover testing:** Test failover procedures quarterly. Simulate database failure, region failure, and dependency outage. Document the results and fix any issues found. Automate failover where possible.
- **Runbook documentation:** Maintain runbooks for every critical incident type: database failure, service outage, security breach, dependency failure. Each runbook must include: symptoms, diagnosis steps, resolution steps, escalation contacts, and communication templates.
- **Chaos engineering:** Introduce controlled failures in staging to validate resilience: kill random pods, inject network latency, simulate disk full conditions. Graduate to production chaos testing only after staging tests pass consistently.

## Anti-Patterns

- **Manual deployments:** Deploying by SSH-ing into a server and running commands. Every deployment must be automated, reproducible, and auditable through the CI/CD pipeline.
- **No rollback plan:** Deploying without a tested way to revert. Every deployment must have a documented and tested rollback procedure. If you cannot roll back, you are not ready to deploy.
- **Alert fatigue:** Too many alerts, too noisy thresholds, or alerts that require no action. Every alert must be actionable. If an alert fires and the response is "ignore it," fix the alert threshold or remove it.
- **Snowflake servers:** Servers configured manually with unique, undocumented configurations. Every server must be provisioned from code and be replaceable. If a server dies, you must be able to recreate it automatically.
- **Secrets in Docker images:** Baking API keys, database passwords, or certificates into container images. Images are stored in registries and can be inspected. Use runtime secrets injection.
- **No health checks:** Services without health endpoints that the orchestrator can query. Without health checks, the system cannot detect or recover from failures automatically.
- **Ignoring resource limits:** Running containers without CPU and memory limits. A single misbehaving container can starve others. Set resource requests and limits for every container.
- **Log and forget:** Writing logs but never setting up alerts, dashboards, or review processes. Logs are only valuable when they are monitored and acted upon.
