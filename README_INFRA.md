# SurgeShield Infrastructure & Auto-Scaling Guide

Welcome to the **SurgeShield Infrastructure Stack**. This repository contains the complete Docker Swarm orchestration, Traefik load balancer, Observability suite, and the **Custom Dockerode Autoscaler Microservice** (the centerpiece).

---

## 🌐 Quick Start Guide

### Step 1: Initialize Docker Swarm Mode
If Docker Swarm is not already initialized on your machine/server, run:
```bash
docker swarm init
```

### Step 2: Build Image Stubs & Autoscaler
```bash
docker build -t surgeshield/api:latest ./stubs/api
docker build -t surgeshield/worker:latest ./stubs/worker
docker build -t surgeshield/autoscaler:latest ./autoscaler
```

### Step 3: Deploy Swarm Stack
```bash
docker stack deploy -c docker-compose.yml surgeshield
```

### Step 4: Verify Running Services
```bash
docker service ls
```

---

## 📊 Dashboard & Service Port Map

| Component | Port / URL | Description |
| :--- | :--- | :--- |
| **API Ingress Gateway** | `http://localhost/api` | Traefik entrypoint for all API requests |
| **Traefik Dashboard** | `http://localhost:8080` | Live view of active Swarm routers & auto-discovered instances |
| **Grafana Dashboard** | `http://localhost:3001` | Live metrics (Login: `admin` / `admin`) |
| **Prometheus UI** | `http://localhost:9090` | PromQL metrics explorer & scrape status |
| **Alertmanager UI** | `http://localhost:9093` | Alert rules & notifications |
| **Autoscaler Status API** | `http://localhost:9091/status` | Current scaling decisions, metrics, and cooldown timers |

---

## ⚙️ Custom Autoscaler Engine (`/autoscaler`)

The autoscaler polls Prometheus every **5 seconds** and evaluates metrics against high/low watermarks.

### Scaling Thresholds:
* **API High Watermark**: CPU $> 70\%$ OR RPS per node $> 250 \rightarrow$ **Instant Scale-Up**.
* **API Low Watermark**: CPU $< 30\%$ AND RPS per node $< 50 \rightarrow$ **Cooldown Scale-Down**.
* **Hysteresis & Anti-Flapping**: Requires low watermark to hold true for **6 consecutive ticks (30 seconds)** before dropping replica count.

---

## ⚡ Demonstration & Load Testing

To trigger an instant traffic surge and demonstrate live auto-scaling in Grafana and Traefik:

### 1. Launch a Traffic Surge (Scale-Up Demo)
```bash
cd load-testing
npm install
node surgeGen.js --profile burst
```
* **Observe**: Traefik RPS spikes $\rightarrow$ Autoscaler logs scale-up $\rightarrow$ `surgeshield_api` scales from 2 to 8 replicas $\rightarrow$ Traefik routes traffic across all new containers without downtime.

### 2. Demonstrate Cooldown Scale-Down (Anti-Flapping Demo)
```bash
node surgeGen.js --profile cool
```
* **Observe**: Traffic drops to 2 RPS $\rightarrow$ Autoscaler logs cooldown ticks `1/6`, `2/6` ... `6/6` $\rightarrow$ After 30 seconds of low load, replica count smoothly drops back to 2 without flapping.

### 3. Idempotency Retries Test
```bash
node surgeGen.js --profile idempotency
```

---

## 🤝 Team Integration Guide

### For Backend Teammate (Member 2 - Node.js/Express)
Replace `./stubs/api` with your Express codebase! Make sure your app:
1. Reads `process.env.PORT` (default `3000`), `process.env.DATABASE_URL`, and `process.env.REDIS_URL`.
2. Implements `GET /health/live` (returns 200) and `GET /health/ready` (checks DB + Redis).
3. Exposes `GET /metrics` using `prom-client` express middleware.

### For Frontend Teammate (Member 1 - Next.js)
1. Point your client API calls to `http://localhost/api/*`. Traefik automatically balances traffic across active backend instances.
2. Send `X-Idempotency-Key: <UUID>` header with registration POST payloads.
