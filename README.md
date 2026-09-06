# SurgeShield 🛡️

**SurgeShield** is a resilient, self-scaling event-registration and ticketing platform designed to handle extreme traffic surges (10 ➔ 1,000+ RPS) without overbooking, duplicate registrations, or service degradation.

Built with **Node.js/Express**, **PostgreSQL 16**, **Redis 7**, **BullMQ**, **Traefik**, and **Docker Swarm**, SurgeShield features custom metrics-driven horizontal auto-scaling, sub-2ms fast-path seat locking, response idempotency caching, and transactional outbox messaging.

---

## 🏛️ System Architecture

SurgeShield uses a decoupled microservice architecture orchestrated via Docker Swarm mode. Traffic enters through Traefik Ingress and is distributed across auto-scaled API containers backed by Redis and PostgreSQL clusters.

```mermaid
graph TD
    Client["Client / Load Generator"] -->|"HTTP / REST (Port 80)"| Traefik["Traefik Ingress Gateway"]
    
    subgraph Swarm ["Docker Swarm Cluster"]
        Traefik -->|"Round-Robin Routing"| API["API Service Tier (Node.js/Express)"]
        API -->|"Tier 1: Fast Lock & Cache"| Redis["Redis 7 (Locks, Cache & BullMQ)"]
        API -->|"Tier 2: ACID Row Lock & Outbox"| Postgres[("PostgreSQL 16 DB")]
        
        OutboxSyncer["Outbox Syncer (SKIP LOCKED)"] -->|"Reads Pending Outbox"| Postgres
        OutboxSyncer -->|"Enqueues Jobs"| BullMQQueue["BullMQ Queue ('notifications')"]
        
        Worker["BullMQ Worker Pool"] -->|"Pops Jobs"| BullMQQueue
        Worker -->|"Updates Outbox Status"| Postgres
    end
    
    subgraph Monitoring ["Observability & Auto-Scaling"]
        cAdvisor["cAdvisor Metrics"] --> Prometheus["Prometheus Server"]
        API -->|"RED Metrics (/metrics)"| Prometheus
        Worker -->|"Queue Depth Metric (3001)"| Prometheus
        Traefik -->|"Ingress Metrics (8082)"| Prometheus
        
        Autoscaler["Custom Swarm Autoscaler"] -->|"Polls Metrics (5s)"| Prometheus
        Autoscaler -->|"Engine API (/var/run/docker.sock)"| API
        Autoscaler -->|"Engine API (/var/run/docker.sock)"| Worker
        
        Prometheus --> Grafana["Grafana Dashboards (Port 3001)"]
        Prometheus --> Alertmanager["Alertmanager (Port 9093)"]
    end
```

---

## 🔄 Sequence Diagrams

### 1. Dual-Tier Concurrency Control & Seat Booking Flow

SurgeShield enforces a **Zero-Overbooking Guarantee** using two layers of concurrency checks:
1. **Tier 1 (Redis In-Memory Lock)**: Provides sub-2ms fast rejection (`SET lock:seat:<eventId>:<seatId> <userId> NX EX 30`).
2. **Tier 2 (Postgres Guarded Row Lock)**: Uses `SELECT ... FOR UPDATE` and atomic SQL status updates inside serializable transactions.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / Browser
    participant Middleware as Idempotency Middleware
    participant LockTier as Redis Lock Tier
    participant DB as PostgreSQL 16
    participant Outbox as Outbox Table

    User->>Middleware: POST /api/bookings (with X-Idempotency-Key)
    Middleware->>LockTier: Check idempotency key (GET idempotency:user:key)
    alt Key Processing or Cached
        LockTier-->>User: Return 409 Processing OR Cached 201 Response
    else New Request
        Middleware->>LockTier: Set PROCESSING status (SET NX EX 30)
        
        loop For each requested seat
            Middleware->>LockTier: SET lock:seat:eventId:seatId (NX EX 30)
            alt Lock Acquired
                LockTier-->>Middleware: OK
            else Lock Failed (Seat Claimed)
                LockTier-->>User: 409 Conflict ("Seat claimed by another user")
            end
        end
        
        Middleware->>DB: BEGIN Transaction
        Middleware->>DB: SELECT * FROM seats WHERE id IN (...) FOR UPDATE
        alt Seats Available
            Middleware->>DB: INSERT INTO bookings RETURNING id
            Middleware->>DB: UPDATE seats SET status = 'booked' WHERE id IN (...) AND status = 'available'
            Middleware->>Outbox: INSERT INTO outbox_notifications (pending)
            DB-->>Middleware: COMMIT Transaction
            Middleware->>LockTier: Cache final HTTP 201 response payload (86400s)
            Middleware-->>User: 201 Created (Booking Confirmed)
        else Seats Booked / Conflict
            DB-->>Middleware: ROLLBACK Transaction
            Middleware->>LockTier: Release Redis Seat Locks
            Middleware-->>User: 409 Conflict ("Seats unavailable")
        end
    end
```

---

### 2. Transactional Outbox & BullMQ Async Notification Flow

Notifications and calendar invites are decoupled from HTTP response paths using the **Transactional Outbox Pattern** combined with **BullMQ**.

```mermaid
sequenceDiagram
    autonumber
    participant API as API Replica
    participant DB as PostgreSQL (outbox_notifications)
    participant Queue as BullMQ Queue (Redis)
    participant Worker as BullMQ Worker Pool
    participant User as Recipient Email / Calendar

    Note over API,DB: Booking transaction commits outbox record with status 'pending'
    
    loop Every 5 Seconds (Outbox Syncer)
        API->>DB: SELECT * FROM outbox_notifications WHERE status = 'pending' FOR UPDATE SKIP LOCKED
        DB-->>API: Return pending rows (Locked to this replica)
        loop For each outbox row
            API->>Queue: notificationQueue.add('sendNotification', payload, jobId)
            Queue-->>API: Job Queued
            API->>DB: UPDATE outbox_notifications SET status = 'queued'
        end
    end
    
    loop Worker Job Consumer Loop
        Worker->>Queue: Pop Job from 'notifications'
        Queue-->>Worker: Job Data (bookingId, email, payload)
        Worker->>User: Dispatch Email & Generate .ics Calendar Invite
        alt Success
            Worker->>DB: UPDATE outbox_notifications SET status = 'processed', processed_at = NOW()
            Worker->>Queue: Mark Job Completed
        else Failure
            Worker->>DB: UPDATE outbox_notifications SET status = 'failed', error_message = err
            Worker->>Queue: Retry Job (Exponential Backoff)
        end
    end
```

---

### 3. Dynamic Auto-Scaling & Cooldown Hysteresis Loop

The custom Node.js autoscaler monitors Prometheus metrics and adjusts Swarm service replica counts in real-time while preventing anti-flapping through hysteresis cooldowns.

```mermaid
sequenceDiagram
    autonumber
    participant Prom as Prometheus
    participant Scaler as Custom Swarm Autoscaler
    participant Engine as Docker Engine API (/var/run/docker.sock)
    participant Swarm as Docker Swarm Cluster

    loop Every 5 Seconds (Evaluation Tick)
        Scaler->>Prom: Query Instant RPS (http_requests_total) & CPU/Node
        Prom-->>Scaler: Returns RPS = 350, Avg CPU/Node = 85%
        
        alt Surge Detected (RPS/Node > 30 OR CPU/Node > 70%)
            Note over Scaler: Reset cooldown ticks to 0
            Scaler->>Engine: Inspect service 'surgeshield_api' (Get Version Index)
            Engine-->>Scaler: Current Replicas: 2, Version: 142
            Scaler->>Engine: POST /services/api/update (Set Replicas: 5)
            Engine->>Swarm: Spawn +3 API tasks across overlay network
            Scaler-->>Scaler: Scale-up completed
        else Low Load State (RPS/Node < 10 AND CPU/Node < 40%)
            Note over Scaler: Increment cooldown ticks (lowWatermarkTicks += 1)
            alt Cooldown Reached (ticks >= 6 / 30 seconds)
                Scaler->>Engine: POST /services/api/update (Scale down replicas)
                Engine->>Swarm: Gracefully terminate excess containers
                Note over Scaler: Reset cooldown ticks to 0
            else Cooldown Pending
                Note over Scaler: Skip scale-down to prevent flapping
            end
        end
    end
```

---

### 4. End-to-End User Registration & Lifecycle Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Web / Mobile App
    participant Traefik as Traefik Ingress
    participant API as API Container
    participant Redis as Redis Cache
    participant DB as PostgreSQL
    participant Worker as Background Worker

    User->>Traefik: GET /api/events
    Traefik->>API: Route to API
    API->>DB: SELECT events WITH available seat counts
    DB-->>User: 200 OK (Event details & seat grid)

    User->>Traefik: POST /api/bookings (seatIds: [12, 13])
    Traefik->>API: Route to API
    API->>Redis: Acquire Redis seat lock (SET NX EX 30)
    API->>DB: SELECT FOR UPDATE & atomic UPDATE status = 'booked'
    API->>DB: INSERT INTO outbox_notifications
    API-->>User: 201 Created (Booking Confirmed)

    Note over Worker: Async Notification Processing
    Worker->>Redis: Pop BullMQ job
    Worker->>User: Send Confirmation Email & .ics Calendar File
    Worker->>DB: Mark Outbox Processed
```

---

## 📂 Project Directory Structure

```
SurgeShield-WorkDay/
├── autoscaler/                 # Custom Dockerode Swarm Autoscaler
│   ├── src/
│   │   ├── index.js            # Autoscaler polling loop & status server (Port 9091)
│   │   ├── prometheusClient.js # PromQL metric fetcher
│   │   └── swarmScaler.js      # Docker Engine Unix Socket HTTP API client & hysteresis
│   └── Dockerfile
├── backend/                    # Core Production Express API & Worker Engine
│   ├── src/
│   │   ├── controllers/        # Bookings & Events HTTP controllers
│   │   ├── db/                 # SQL schemas & pool management
│   │   ├── middleware/         # Idempotency cache & error handlers
│   │   ├── routes/             # API routing endpoints (/api/events, /api/bookings)
│   │   ├── services/           # Dual-tier booking & outbox notification services
│   │   ├── db.js               # Central pg Connection Pool
│   │   ├── index.js            # Express REST server (Port 4000)
│   │   ├── redis.js            # ioredis client & lock helpers
│   │   └── worker.js           # BullMQ Worker process & metrics server (Port 3001)
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # Next.js Web Portal
│   ├── pages/                  # Event listings, seat selection grid, booking views
│   └── styles/
├── load-testing/               # Traffic Generator CLI
│   └── surgeGen.js             # Support for --profile burst, --profile cool, --profile idempotency
├── observability/              # Observability Configurations
│   ├── alertmanager/           # Alert routing & rules
│   ├── grafana/                # Provisioned dashboards (surgeshield-overview.json)
│   └── prometheus/             # Prometheus target scrape configs & PromQL rules
├── docker-compose.yml          # Production Docker Swarm Stack Specification
├── README_INFRA.md             # Teammate Infrastructure Integration Guide
└── README.md                   # Complete System Documentation
```

---

## ⚡ Quick Start & Deployment Guide

### Prerequisites
- [Docker Desktop](https://www.docker.com/) with Swarm Mode enabled (`docker swarm init`).
- [Node.js 20+](https://nodejs.org/).

### 1. Initialize Docker Swarm & Deploy Stack

```powershell
# 1. Initialize Docker Swarm (if not already active)
docker swarm init

# 2. Build Production Container Images
docker build -t surgeshield/api:latest ./backend
docker build -t surgeshield/worker:latest ./backend
docker build -t surgeshield/autoscaler:latest ./autoscaler

# 3. Deploy Stack to Docker Swarm
docker stack deploy -c docker-compose.yml surgeshield
```

### 2. Verify Services

Check running Docker Swarm services:
```powershell
docker service ls
```

---

## 📊 Observability & System Dashboards

| Service | Endpoint | Description |
| :--- | :--- | :--- |
| **Ingress Gateway** | `http://localhost` | Traefik Reverse Proxy & Load Balancer |
| **Traefik UI** | `http://localhost:8080` | Router & Service Health Dashboard |
| **Grafana** | `http://localhost:3001` | System Overview Dashboard (User: `admin` / `admin`) |
| **Prometheus UI** | `http://localhost:9090` | PromQL Query Browser & Targets |
| **Alertmanager** | `http://localhost:9093` | Alert Trigger Console |
| **Autoscaler Status** | `http://localhost:9091/status` | Live Replica Count & Cooldown Ticks |

---

## 🧪 Load Testing & Verification

Run the load testing script to test burst auto-scaling, scale-down cooldown, or idempotency checks:

```powershell
# Burst Test: High Concurrency (10,000+ Requests in 30s)
node load-testing/surgeGen.js --profile burst

# Idempotency Test: Verify 10 duplicate requests return identical cached response
node load-testing/surgeGen.js --profile idempotency

# Cooldown Test: Low traffic (2 RPS) to observe scale-down hysteresis
node load-testing/surgeGen.js --profile cool
```

---

## 🛡️ Concurrency & Resilience Guarantees

1. **Zero Overbooking Guarantee**: Combines Redis in-memory locks with PostgreSQL row locks (`SELECT FOR UPDATE`) and atomic SQL seat assignment (`UPDATE ... WHERE status = 'available'`).
2. **Strict Idempotency**: Intercepts duplicate client requests via Redis (`SET ... NX EX 30`) and enforces database uniqueness constraints on `idempotency_key`.
3. **Anti-Flapping Autoscaling**: Instant scale-up during traffic bursts combined with a 6-tick (30 second) hysteresis cooldown before step-down.
4. **Reliable Async Processing**: Uses PostgreSQL transactional outbox table with `FOR UPDATE SKIP LOCKED` and BullMQ workers for zero-message-loss processing.
