# SurgeShield 🛡️ - System & Requirement Mermaid Diagrams

This document contains complete, production-grade **Mermaid diagrams** for **SurgeShield**, covering the **Overall System Architecture** as well as individual architectural and sequence diagrams for every platform requirement specified in the problem statement.

---

## 📐 Table of Contents

1. [Overall System Architecture Diagram](#1-overall-system-architecture-diagram)
2. [Requirement 1: Remain Available During Sudden Traffic Spikes](#requirement-1-remain-available-during-sudden-traffic-spikes)
3. [Requirement 2: Prevent Excessive Latency and Failed Requests](#requirement-2-prevent-excessive-latency-and-failed-requests)
4. [Requirement 3: Automatically Add Capacity During Peak Traffic](#requirement-3-automatically-add-capacity-during-peak-traffic)
5. [Requirement 4: Remove Excess Capacity After Traffic Stabilizes](#requirement-4-remove-excess-capacity-after-traffic-stabilizes)
6. [Requirement 5: Prevent Duplicate Registrations](#requirement-5-prevent-duplicate-registrations)
7. [Requirement 6: Prevent Overbooking When Multiple Users Request Last Available Seats](#requirement-6-prevent-overbooking-when-multiple-users-request-last-available-seats)
8. [Requirement 7: Detect Failed or Unhealthy Service Instances](#requirement-7-detect-failed-or-unhealthy-service-instances)
9. [Requirement 8: Handle Temporary Failures in Downstream Dependencies](#requirement-8-handle-temporary-failures-in-downstream-dependencies)
10. [Requirement 9: Process Notifications Asynchronously](#requirement-9-process-notifications-asynchronously)
11. [Requirement 10: Alert the Operations Team When User Experience or System Health is at Risk](#requirement-10-alert-the-operations-team-when-user-experience-or-system-health-is-at-risk)
12. [Requirement 11: Provide Dashboards That Explain What Happened During Traffic Surges](#requirement-11-provide-dashboards-that-explain-what-happened-during-traffic-surges)

---

## 1. Overall System Architecture Diagram

This diagram presents the full microservices topology of SurgeShield, showcasing traffic flow from external clients through the Traefik Ingress Gateway into the auto-scaled API and Worker container tiers backed by Redis 7 and PostgreSQL 16, alongside the custom metrics-based Docker Swarm autoscaler and full Prometheus/Grafana/Alertmanager observability stack.

```mermaid
graph TD
    subgraph Client ["Client"]
        WebBrowser["Web Browser<br/>(Browse, Search, Book Seats, etc.)"]
    end

    subgraph IngressTier ["Ingress Tier"]
        Traefik["Traefik Reverse Proxy & Load Balancer<br/>(Port 80/443)<br/>• SSL/TLS Termination<br/>• Round-Robin Load Balancing<br/>• Active Health Probes"]
    end

    subgraph SwarmCluster ["Docker Swarm Cluster"]
        subgraph APITier ["API Service Tier (Node.js / Express)"]
            API1["API Replica 1"]
            API2["API Replica 2"]
            APIN["API Replica N"]
        end

        subgraph DataTier ["Data & Caching Tier"]
            Redis[("Redis 7 Cluster / Single Master<br/>• Fast Seat Locks (SET NX)<br/>• Idempotency Cache<br/>• BullMQ Job Store")]
            Postgres[("PostgreSQL 16 DB<br/>• ACID Transactions<br/>• Row-level Locks (FOR UPDATE)<br/>• Transactional Outbox Table")]
        end

        subgraph AsyncPipeline ["Async Pipeline"]
            Syncer["Outbox Syncer Poller<br/>• Polls Outbox Table<br/>• (SKIP LOCKED)"]
            BullMQ["BullMQ Queue<br/>('notifications')"]
            Worker1["Worker Replica 1"]
            Worker2["Worker Replica 2"]
            WorkerN["Worker Replica N"]
        end

        subgraph ExternalServices ["External Services"]
            Email["Email Service<br/>(Send Emails)"]
            Calendar["Calendar Service<br/>(Create Calendar Invites)"]
            SMS["SMS/Push Service<br/>(Send SMS / Push Notifications)"]
        end
    end

    subgraph ObservabilityStack ["Observability & Auto-Scaling Stack"]
        Autoscaler["Custom Swarm Autoscaler<br/>(Port 9091)<br/>• Evaluates PromQL metrics every 5s<br/>• Docker Engine Socket API"]
        Prometheus["Prometheus Server<br/>(Port 9090)<br/>• RED Metrics Aggregator<br/>• Time Series Database"]
        Grafana["Grafana<br/>(Port 3001)<br/>• Dashboards<br/>• Visualization"]
        Alertmanager["Alertmanager<br/>(Port 9093)<br/>• Alerting Rules<br/>• Notifications (Email, Slack, etc.)"]
    end

    %% Client & Ingress
    WebBrowser -->|"HTTP/HTTPS"| Traefik
    Traefik --> API1 & API2 & APIN

    %% API Tier Connections
    API1 & API2 & APIN -->|"Fast Lock / Idempotency"| Redis
    API1 & API2 & APIN -->|"SQL Queries & Transactions"| Postgres

    %% Async Pipeline Connections
    Postgres -->|"Outbox Events (poll from DB)"| Syncer
    Syncer -->|"Enqueues Notification Jobs"| BullMQ
    BullMQ -->|"Pops Jobs"| Worker1 & Worker2 & WorkerN
    Worker1 & Worker2 & WorkerN -->|"Calls External Services"| ExternalServices

    %% Metrics Collection
    API1 & API2 & APIN -.->|"API Metrics (RPS, Latency, Errors)"| Prometheus
    Worker1 & Worker2 & WorkerN -.->|"Worker Metrics (Queue Depth, Processing Time)"| Prometheus
    Traefik -.->|"Ingress Metrics (Traefik)"| Prometheus
    DataTier -.->|"Container Metrics (CPU / Memory - cAdvisor)"| Prometheus

    %% Autoscaler & Observability Control
    Prometheus -->|"Queries PromQL Metrics"| Autoscaler
    Autoscaler -.->|"Control Replicas via /var/run/docker.sock"| APITier & AsyncPipeline
    Prometheus --> Grafana
    Prometheus --> Alertmanager
```

---

## Requirement 1: Remain Available During Sudden Traffic Spikes

> **Goal**: Ensure 99.9%+ availability when traffic spikes from 10 to 1,000+ RPS without cascading failures or web server crashes.

```mermaid
flowchart TD
    ClientTraffic["Sudden Traffic Surge<br/>(1,000+ Requests/sec)"] --> TraefikIngress["Traefik Ingress Gateway"]

    subgraph IngressProtection ["Ingress Protection & Traffic Control"]
        TraefikIngress --> DynamicLB["Dynamic Round-Robin Load Balancer"]
        TraefikIngress --> ConnLimit["Connection Buffering & Rate Throttling"]
        TraefikIngress --> HealthCheckFilter["Active Service Discovery & Health Filter"]
    end

    subgraph ScaledAPICluster ["Horizontally Scaled Container Pool"]
        DynamicLB --> API_1["API Container 1"]
        DynamicLB --> API_2["API Container 2"]
        DynamicLB --> API_3["API Container 3"]
        DynamicLB --> API_N["API Container N"]
    end

    subgraph IsolatedStorage ["Decoupled High-Throughput Storage"]
        API_1 & API_2 & API_3 & API_N --> RedisFastPath["Redis Fast-Path Tier<br/>(Sub-2ms Response / Atomic Locks)"]
        API_1 & API_2 & API_3 & API_N --> DBPool["PostgreSQL Connection Pool<br/>(Max Connection Throttling)"]
    end

    RedisFastPath -->|"Instant Rejection of Conflicts"| Fast409["409 Conflict / 429 Rate Limit<br/>(Protects Core DB from Overwhelm)"]
```

---

## Requirement 2: Prevent Excessive Latency and Failed Requests

> **Goal**: Prevent tail latency degradation ($p_{99} < 100\text{ms}$) by using in-memory fast rejection and DB connection pooling.

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Client
    participant Middleware as Express Idempotency & Rate Limit Middleware
    participant Redis as Redis 7 In-Memory Cache
    participant DBPool as PostgreSQL Connection Pool
    participant DB as PostgreSQL Database

    Client->>Middleware: POST /api/bookings (Seat Request)
    Middleware->>Redis: 1. GET idempotency:key & GET lock:seat:id
    alt Fast-Path Cache Hit OR Lock Taken (Sub-2ms)
        Redis-->>Middleware: Lock Busy / Cached Response
        Middleware-->>Client: 409 Conflict OR Cached 201 Response (Fast Exit < 5ms)
    else Fast-Path Clear
        Redis-->>Middleware: OK (Lock Granted)
        Middleware->>DBPool: 2. Acquire Pooled DB Connection
        alt Connection Pool Exhausted
            DBPool-->>Middleware: Pool Timeout
            Middleware-->>Client: 503 Service Unavailable (Fast Fail)
        else Connection Acquired
            DBPool->>DB: 3. SELECT FOR UPDATE & INSERT (ACID Tx)
            DB-->>DBPool: Transaction Success
            DBPool-->>Middleware: Release Connection back to Pool
            Middleware->>Redis: 4. Store Response Payload in Cache
            Middleware-->>Client: 201 Created (Confirmed)
        end
    end
```

---

## Requirement 3: Automatically Add Capacity During Peak Traffic

> **Goal**: Evaluate metrics every 5 seconds and scale out container replicas automatically when RPS or CPU utilization exceeds thresholds.

```mermaid
flowchart TD
    subgraph MetricCollection ["1. Telemetry Aggregation"]
        API_Pods["API Services"] -->|Scrape /metrics| Prom["Prometheus Time Series DB"]
        Nodes["Swarm Nodes"] -->|cAdvisor Metrics| Prom
    end

    subgraph AutoScalerEngine ["2. Custom Autoscaler Evaluation (Every 5s)"]
        Prom -->|PromQL Query| ScalerLoop["Swarm Autoscaler Loop"]
        ScalerLoop --> CalcMetrics{"Calculate Load Metrics:<br/>• RPS/Node > 30 OR<br/>• CPU Util > 70%?"}
    end

    subgraph ScaleUpAction ["3. Scale-Out Execution"]
        CalcMetrics -->|YES: Surge Detected| ComputeReplicas["Calculate Needed Replicas<br/>Target: ceil(Current * (RPS / TargetRPS))"]
        ComputeReplicas --> DockerSocket["Issue Swarm Service Update via Unix Socket<br/>(/var/run/docker.sock)"]
        DockerSocket --> ScaleSwarm["Docker Swarm Engine Spawns +N New Tasks"]
        ScaleSwarm --> TraefikRegister["Traefik Automatically Detects & Registers New Endpoints"]
    end

    CalcMetrics -->|NO| Idle["Maintain Current Capacity"]
```

---

## Requirement 4: Remove Excess Capacity After Traffic Stabilizes

> **Goal**: Gracefully scale down excess service containers after traffic drops, using a hysteresis cooldown timer to prevent anti-flapping.

```mermaid
sequenceDiagram
    autonumber
    participant Prom as Prometheus
    participant Scaler as Custom Swarm Autoscaler
    participant Hysteresis as Cooldown Hysteresis State
    participant Engine as Docker Swarm Engine API

    loop Every 5 Seconds (Evaluation Cycle)
        Scaler->>Prom: Query Instant RPS & CPU Metrics
        Prom-->>Scaler: Returns Low RPS (e.g. 4 RPS/Node, CPU 15%)
        
        Scaler->>Hysteresis: Check Load State
        alt Load < Low Watermark (RPS/Node < 10 AND CPU < 40%)
            Hysteresis->>Hysteresis: Increment Cooldown Ticks (lowWatermarkTicks += 1)
            alt Ticks < 6 (Cooldown Pending < 30s)
                Hysteresis-->>Scaler: Cooldown in progress (Skip Scale-Down)
                Note over Scaler: Prevent Flapping / Rapid Oscillations
            else Ticks >= 6 (Cooldown Expired: 30 Seconds Stable Low Load)
                Hysteresis->>Scaler: Trigger Scale-Down Approved
                Scaler->>Engine: POST /services/surgeshield_api/update (Set Replicas: Min Pool Size)
                Engine->>Engine: Gracefully Terminate Excess API Containers
                Scaler->>Hysteresis: Reset lowWatermarkTicks = 0
            end
        else Load Spikes Again
            Hysteresis->>Hysteresis: Immediate Reset lowWatermarkTicks = 0
            Note over Hysteresis: Instantly aborts pending scale-down
        end
    end
```

---

## Requirement 5: Prevent Duplicate Registrations

> **Goal**: Idempotency key handling prevents double submissions caused by network retries or fast double-clicking.

```mermaid
sequenceDiagram
    autonumber
    actor Client as User Client
    participant IdemMW as Idempotency Middleware
    participant Redis as Redis Idempotency Store
    participant DB as PostgreSQL Core DB

    Client->>IdemMW: POST /api/bookings (Header: X-Idempotency-Key: "UUID-1234")
    IdemMW->>Redis: SET idempotency:UUID-1234 "PROCESSING" NX EX 30
    
    alt Key Already Exists in Redis
        Redis-->>IdemMW: Failed to set (Key Exists)
        IdemMW->>Redis: GET idempotency:UUID-1234
        alt Value is "PROCESSING"
            Redis-->>IdemMW: Status: PROCESSING
            IdemMW-->>Client: 409 Conflict ("Request currently processing, please wait")
        else Value is Cached JSON Response
            Redis-->>IdemMW: Cached Response Payload
            IdemMW-->>Client: Return Cached 201 Created (Identical Response)
        end
    else Key Acquired (First Time Request)
        Redis-->>IdemMW: OK (Lock Acquired)
        IdemMW->>DB: Execute Booking Transaction
        DB-->>IdemMW: Booking Successfully Created (ID: 998)
        IdemMW->>Redis: SET idempotency:UUID-1234 '{ "status": 201, "bookingId": 998 }' EX 86400
        IdemMW-->>Client: 201 Created (Booking Confirmed)
    end
```

---

## Requirement 6: Prevent Overbooking When Multiple Users Request Last Available Seats

> **Goal**: Dual-Tier Concurrency Control ensures absolute zero overbooking under high-concurrency race conditions.

```mermaid
flowchart TD
    subgraph IncomingRace ["High Concurrency Race Condition"]
        UserA["User A: Request Seat #45"]
        UserB["User B: Request Seat #45"]
    end

    subgraph Tier1 ["Tier 1: Redis Fast In-Memory Atomic Lock (Sub-2ms)"]
        UserA --> LockA["SET lock:seat:101:45 'userA' NX EX 30"]
        UserB --> LockB["SET lock:seat:101:45 'userB' NX EX 30"]
        
        LockA -->|SUCCESS| PassTier1_A["Pass to Tier 2 (User A)"]
        LockB -->|FAIL: Lock Exists| FailTier1_B["Instant 409 Conflict Rejection (User B)<br/>Response Time < 2ms"]
    end

    subgraph Tier2 ["Tier 2: PostgreSQL Guarded Row Lock & ACID Transaction"]
        PassTier1_A --> DBTx["BEGIN Transaction (User A)"]
        DBTx --> SelectForUpdate["SELECT status FROM seats WHERE id = 45 FOR UPDATE"]
        SelectForUpdate --> CheckStatus{"Is status == 'available'?"}
        
        CheckStatus -->|YES| CommitTx["UPDATE seats SET status = 'booked'<br/>INSERT INTO bookings ...<br/>COMMIT Transaction"]
        CheckStatus -->|NO| RollbackTx["ROLLBACK Transaction<br/>Release Redis Lock"]
        
        CommitTx --> SuccessUserA["201 Created: Seat #45 Confirmed for User A"]
        RollbackTx --> FailUserA["409 Conflict: Seat Unavailable"]
    end
```

---

## Requirement 7: Detect Failed or Unhealthy Service Instances

> **Goal**: Continuous health monitoring and dynamic target updates remove failed instances automatically.

```mermaid
flowchart TD
    subgraph HealthMonitoring ["Health Check Mechanisms"]
        DockerHealthcheck["Docker Engine HEALTHCHECK<br/>(GET /healthz every 5s)"]
        TraefikProbes["Traefik Active Health Probe<br/>(HTTP status check every 3s)"]
        PromScraper["Prometheus Target Scraper<br/>(Scrape target every 5s)"]
    end

    subgraph InstanceState ["API Container Instance"]
        Instance["API Replica #3"]
    end

    DockerHealthcheck & TraefikProbes & PromScraper --> Instance

    Instance -->|Memory Leak / Unresponsive| HealthFail["3 Consecutive Failed Probes"]

    subgraph RecoveryPipeline ["Automated Removal & Recovery"]
        HealthFail --> TraefikDeregister["1. Traefik drops instance from Load Balancer Routing Pool"]
        HealthFail --> SwarmKill["2. Docker Swarm marks container UNHEALTHY & kills task"]
        HealthFail --> PromAlert["3. Prometheus triggers 'ServiceInstanceDown' alert"]
        SwarmKill --> SwarmRespawn["4. Swarm Engine automatically launches fresh replacement container"]
        SwarmRespawn --> DynamicRegister["5. Traefik detects new container healthy IP & resumes traffic"]
    end
```

---

## Requirement 8: Handle Temporary Failures in Downstream Dependencies

> **Goal**: Maintain system stability and zero data loss during database, Redis, or network blips using resilient retry strategies and transactional outbox patterns.

```mermaid
flowchart TD
    subgraph ServiceLayer ["API & Worker Application Tier"]
        Action["Trigger Downstream Operation<br/>(Database Write / Queue Job / Redis Lock)"]
    end

    Action --> CheckDep{"Attempt Connection / Execution"}

    CheckDep -->|Success| Complete["Complete Operation"]

    CheckDep -->|Failure: Temporary Blip / Timeout| ResilienceStrategy{"Identify Resilience Mechanism"}

    subgraph ResilienceMechanisms ["Failure Recovery Mechanisms"]
        ResilienceStrategy -->|Database Write Failure| TransactionalOutbox["1. Transactional Outbox Pattern:<br/>Write notification event to Postgres DB table in same ACID transaction"]
        ResilienceStrategy -->|Redis Network Blip| RedisRetry["2. ioredis Retry Strategy:<br/>Exponential Backoff & Reconnect Loop"]
        ResilienceStrategy -->|Queue Worker Downstream Fail| BullMQRetry["3. BullMQ Retries:<br/>Job retried with exponential backoff (e.g. 1s, 2s, 4s, 8s)"]
        ResilienceStrategy -->|DB Connection Drop| DBPoolReconnect["4. pg Pool Reconnect:<br/>Automatic socket reconnection & query retry"]
    end

    TransactionalOutbox --> Recovered["Guaranteed Event Persistence (Zero Message Loss)"]
    BullMQRetry -->|Max Retries Exceeded| DLQ["Move Job to Dead Letter Queue (DLQ) & Alert Ops"]
    RedisRetry & DBPoolReconnect --> CheckDep
```

---

## Requirement 9: Process Notifications Asynchronously

> **Goal**: Decouple slow email sending and calendar invite generation from HTTP response paths using the Transactional Outbox pattern and BullMQ worker queue.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant API as API Replica
    participant DB as PostgreSQL (outbox_notifications)
    participant Syncer as Outbox Syncer Service
    participant Queue as BullMQ Queue (Redis 7)
    participant Worker as BullMQ Worker Pool
    participant SMTP as External Email / Calendar Service

    User->>API: POST /api/bookings
    Note over API,DB: Fast Path: Synchronous HTTP Execution
    API->>DB: BEGIN Tx: Create Booking + INSERT INTO outbox_notifications (status: 'pending')
    DB-->>API: COMMIT Tx
    API-->>User: 201 Created (Booking Confirmed in < 15ms!)

    Note over Syncer,Worker: Asynchronous Background Pipeline
    loop Every 5 Seconds (Outbox Syncer Poller)
        Syncer->>DB: SELECT * FROM outbox_notifications WHERE status = 'pending' FOR UPDATE SKIP LOCKED
        DB-->>Syncer: Return Locked Pending Rows
        loop For each notification row
            Syncer->>Queue: notificationQueue.add('sendNotification', payload, { jobId })
            Queue-->>Syncer: Job Enqueued
            Syncer->>DB: UPDATE outbox_notifications SET status = 'queued'
        end
    end

    loop Worker Job Consumer Loop
        Worker->>Queue: Pop next Job from 'notifications' queue
        Queue-->>Worker: Job Data (bookingId, email, eventDetails)
        Worker->>SMTP: Generate .ics Calendar File & Dispatch Email
        alt Delivery Successful
            SMTP-->>Worker: 250 OK / Sent
            Worker->>DB: UPDATE outbox_notifications SET status = 'processed', processed_at = NOW()
            Worker->>Queue: Mark Job Completed
        else Temporary Network Error
            SMTP-->>Worker: Timeout / 5xx Error
            Worker->>Queue: Re-queue Job with Exponential Backoff
            Worker->>DB: UPDATE outbox_notifications SET status = 'retrying'
        end
    end
```

---

## Requirement 10: Alert the Operations Team When User Experience or System Health is at Risk

> **Goal**: Detect anomalies in real-time and trigger automated alerts when latency, error rates, or queue depth exceed safety limits.

```mermaid
flowchart TD
    subgraph ObservabilitySources ["Telemetry Data Sources"]
        API_Metrics["API /metrics Endpoint<br/>(http_requests_total, latency_seconds)"]
        Worker_Metrics["Worker /metrics Endpoint<br/>(bullmq_queue_depth)"]
        Node_Metrics["cAdvisor Node Metrics<br/>(container_cpu_usage)"]
    end

    ObservabilitySources -->|Scrape Every 5s| PromEngine["Prometheus Server"]

    subgraph PromAlertRules ["Prometheus Alerting Rules Evaluation"]
        PromEngine --> Rule1{"High Error Rate Rule:<br/>rate(500 errors)[1m] > 5% for 1m"}
        PromEngine --> Rule2{"High Latency Rule:<br/>p95_latency > 500ms for 2m"}
        PromEngine --> Rule3{"Queue Backlog Rule:<br/>bullmq_queue_depth > 1000 for 3m"}
        PromEngine --> Rule4{"Autoscaler Limit Rule:<br/>replicas == max_replicas AND CPU > 90%"}
    end

    Rule1 & Rule2 & Rule3 & Rule4 -->|Alert Triggered| Alertmanager["Alertmanager Engine (Port 9093)"]

    subgraph AlertManagerProcessing ["Alert Grouping & Deduplication"]
        Alertmanager --> Grouping["Group related alerts by service & cluster"]
        Grouping --> SilenceFilter["Apply Active Silence & Inhibition Filters"]
    end

    subgraph NotificationDispatch ["Operations Team Channels"]
        SilenceFilter --> Slack["Slack #ops-alerts Channel"]
        SilenceFilter --> PagerDuty["PagerDuty Incident Escalation (P1/P2)"]
        SilenceFilter --> EmailOps["Ops On-Call Email Notification"]
    end
```

---

## Requirement 11: Provide Dashboards That Explain What Happened During Traffic Surges

> **Goal**: Offer real-time visual dashboards in Grafana that correlate traffic surges, scale-out events, response latencies, and queue depths.

```mermaid
flowchart TD
    subgraph MetricsScraping ["Telemetry Ingestion Pipeline"]
        TraefikM["Traefik Metrics"] --> Prom
        APIM["API Service RED Metrics"] --> Prom["Prometheus Time Series DB"]
        WorkerM["BullMQ Worker Metrics"] --> Prom
        AutoscalerM["Autoscaler State Metrics"] --> Prom
        HostM["cAdvisor Container Stats"] --> Prom
    end

    Prom -->|PromQL Queries| Grafana["Grafana Telemetry Dashboard (Port 3001)"]

    subgraph DashboardPanels ["SurgeShield System Overview Dashboard"]
        Grafana --> Panel1["📈 Traffic & RPS Panel:<br/>• Total Ingress RPS<br/>• HTTP 2xx / 4xx / 5xx Breakdown"]
        Grafana --> Panel2["⏱️ Latency & SLA Panel:<br/>• Average Response Time<br/>• p95 & p99 Tail Latency Spikes"]
        Grafana --> Panel3["⚡ Auto-Scaling Dynamics Panel:<br/>• Active API & Worker Replica Count<br/>• Target vs Actual Capacity"]
        Grafana --> Panel4["🔒 Concurrency & Lock Health Panel:<br/>• Fast Lock Hits vs Rejections<br/>• DB Connection Pool Utilization"]
        Grafana --> Panel5["📬 Queue Depth & Processing Panel:<br/>• BullMQ Pending vs Completed Jobs<br/>• Outbox Table Processing Lag"]
    end
```
