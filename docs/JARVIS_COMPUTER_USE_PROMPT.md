# Jarvis Computer Use & System Intelligence — AI Coding Agent Prompt

## Objective
Build a **production-grade, secure, cross-platform computer use and system intelligence layer** for Jarvis that gives it:
- **Full system visibility** (hardware, OS, processes, files, network, services, logs)
- **Controlled action execution** (file ops, process management, shell commands, GUI automation)
- **Zero-hallucination grounding** — every claim Jarvis makes about the system is backed by live, verifiable data
- **Security-first architecture** — sandboxed, auditable, permission-scoped, with rollback capability

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        JARVIS CORE                              │
│  (LLM + Reasoning + Memory + Planning)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   SYSTEM INTELLIGENCE BUS   │  ◄── Unified RPC/Event Bus
              │   (Type-safe, versioned)    │
              └──────────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  READ ONLY    │    │  CONTROLLED   │    │   GUI/DESKTOP │
│  OBSERVERS    │    │  ACTUATORS    │    │  AUTOMATION   │
│               │    │               │    │               │
│ • Sysinfo     │    │ • File System │    │ • Browser     │
│ • Processes   │    │ • Process Mgmt│    │ • App Windows │
│ • Files/FS    │    │ • Shell Cmds  │    │ • Input Sim   │
│ • Network     │    │ • Services    │    │ • Accessibility│
│ • Logs        │    │ • Package Mgr │    │ • Screen OCR  │
│ • Hardware    │    │ • Config      │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
        │                    │                    │
        └────────────────────┴────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │      POLICY ENGINE          │
              │  (Permissions, Sandboxing,  │
              │   Audit, Rollback, Limits)  │
              └─────────────────────────────┘
```

---

## 2. Core Components — Detailed Spec

### 2.1 System Information Observers (Read-Only, High-Frequency)

| Observer | Data Sources | Update Cadence | Output Format |
|----------|--------------|----------------|---------------|
| **Hardware** | `lshw`, `dmidecode`, `cpuinfo`, `meminfo`, `lsblk`, `lspci`, `lsusb`, `sensors`, `nvidia-smi`, `rocm-smi` | 30s / on-demand | Structured JSON (typed) |
| **OS & Kernel** | `/etc/os-release`, `uname`, `systemd-analyze`, `dmesg`, `journalctl`, `sysctl` | 60s / on-demand | JSON |
| **Processes** | `ps`, `/proc`, `pidstat`, `top/htop` batch, `systemd-cgls` | 5s / streaming | JSON stream (delta) |
| **Filesystem** | `df`, `findmnt`, `lsblk`, `fstab`, `inotify`/`fanotify`, `stat`, `xattr` | 10s / event-driven | JSON + change events |
| **Network** | `ip`, `ss`, `netstat`, `nmcli`, `iw`, `ethtool`, `tc`, `nftables/iptables`, `resolvectl` | 10s / on-demand | JSON |
| **Services** | `systemctl`, `service`, `launchctl` (macOS), `sc` (Windows) | 15s / on-demand | JSON |
| **Packages** | `apt`/`dnf`/`pacman`/`brew`/`winget`/`choco`/`scoop`, `pip`, `npm`, `cargo`, `go` | 5min / on-demand | JSON (installed, upgradable, vuln) |
| **Logs** | `journalctl`, `/var/log/*`, app logs, `dmesg`, auditd | Streaming (tail) | Structured log entries |
| **Users/Sessions** | `who`, `w`, `last`, `loginctl`, `utmp`/`wtmp` | 30s / on-demand | JSON |
| **Containers/VMs** | `docker`, `podman`, `lxc`, `virsh`, `vboxmanage`, `kubectl` | 30s / on-demand | JSON |

**Implementation Requirements:**
- Each observer = independent, crash-isolated process (or goroutine/async task)
- Publish to message bus (NATS, Redis Streams, or in-process typed channels)
- Schema versioning (protobuf/Cap'n Proto/JSON Schema) — **no schema drift**
- Caching layer with TTL + invalidation on events
- Health/metrics endpoint per observer (`/health`, `/metrics` Prometheus)

---

### 2.2 Controlled Actuators (Write Operations, Policy-Gated)

| Actuator | Capabilities | Safety Controls |
|----------|--------------|-----------------|
| **File System** | Read, write, create, delete, move, copy, chmod/chown, xattr, symlink, mount/umount (privileged) | Path allowlists/denylists, size limits, atomic writes (temp+rename), trash/recycle bin, git-backed snapshots |
| **Process Management** | Start, stop, restart, signal, nice/ionice, cgroup limits, namespace isolation | Allowlisted binaries, arg validation, resource quotas, no-root-by-default |
| **Shell Commands** | Exec with stdin/stdout/stderr, PTY support, timeout, env control | Command allowlist, arg schema validation, no shell injection (argv array only), output size cap |
| **Services** | systemctl start/stop/restart/enable/disable/mask, journalctl --vacuum | Unit allowlist, require confirmation for destructive ops |
| **Package Manager** | Install, remove, update, search, info, verify | Package allowlist/denylist, dry-run default, rollback on failure |
| **Network** | Interface up/down, IP addr/route, firewall rules, DNS, VPN, WiFi | Network namespace isolation, revert-on-timeout, no raw socket by default |
| **Configuration** | Edit config files (INI, YAML, JSON, TOML, systemd units, nginx, etc.) | Schema validation, backup before write, diff preview, atomic commit |
| **Users/Groups** | Create, modify, delete, password, ssh keys, sudoers | Privileged — require elevated policy token, audit log |

**Implementation Requirements:**
- Every actuator call = **policy decision point** (allow/deny/modify)
- Structured request/response with correlation IDs
- Idempotency keys for retry safety
- Structured audit log (append-only, signed) — who, what, when, policy decision, result
- Dry-run / simulation mode for all actuators
- Rollback handlers registered per operation type

---

### 2.3 GUI/Desktop Automation (Optional but Recommended)

| Layer | Technology | Use Case |
|-------|------------|----------|
| **Browser** | Playwright / CDP / Chrome DevTools Protocol | Web apps, SaaS, web-based admin panels |
| **Desktop (Linux)** | AT-SPI2 (Accessibility), `xdotool`, `ydotool`, `wtype`, `kdt` | Native GTK/Qt/Electron apps |
| **Desktop (macOS)** | Accessibility API (AXUIElement), AppleScript, Hammerspoon | Native macOS apps |
| **Desktop (Windows)** | UI Automation (UIA), Win32 `SendInput`, PowerShell `System.Windows.Automation` | Native Windows apps |
| **Screen/OCR** | Tesseract, PaddleOCR, macOS Vision, Windows OCR, `scrot`+`tesseract` | Unstructured UI, remote desktop, VMs |
| **Window Management** | `wmctrl`, `xprop`, `yabai`, `aerospace`, `FancyZones` | Focus, resize, move, enumerate |

**Security:**
- Separate display server / virtual display (Xvfb, Wayland headless, Windows session 0)
- Input simulation restricted to allowlisted windows/apps
- No global hotkey capture unless explicitly granted
- Screenshot/OCR scoped to target window region

---

### 2.4 Policy Engine (The Safety Core)

```
Request → [Schema Validation] → [Capability Check] → [Contextual Policy] → [Rate Limit] → [Audit] → Actuator
                    │                    │                    │               │
                    ▼                    ▼                    ▼               ▼
              Reject if              Check:               Evaluate:       Token bucket
              invalid                - Actor identity     - Time of day   per actor/
              schema                 - Resource path      - Risk level    resource/
                                      - Operation type     - Approval req  session
                                      - Required caps      - MFA required
```

**Policy Language:** OPA/Rego or Cedar (AWS) — declarative, testable, version-controlled.

**Default Policies (starter set):**
```rego
# Deny all by default
default allow = false

# Allow read-only observers for authenticated Jarvis sessions
allow {
  input.actor.type == "jarvis_session"
  input.action.category == "observe"
  not input.action.destructive
}

# File writes only in allowed roots, with size limit
allow {
  input.actor.type == "jarvis_session"
  input.action.category == "actuate"
  input.action.actuator == "filesystem"
  input.action.operation == "write"
  startswith(input.action.target.path, "/home/gopi/jarvis-workspace/")
  input.action.payload.size_bytes < 10_000_000
}

# Shell commands only from allowlist
allow {
  input.actor.type == "jarvis_session"
  input.action.category == "actuate"
  input.action.actuator == "shell"
  input.action.payload.argv[0] in allowed_commands
}

# Destructive ops require explicit approval token
allow {
  input.action.destructive == true
  input.approval_token.valid == true
  input.approval_token.scopes contains input.action.operation
  time.now() < input.approval_token.expires
}
```

---

### 2.5 Message Bus & API Layer

**Transport:** gRPC (internal) + WebSocket (external) + HTTP/REST (webhooks)
**Serialization:** Protocol Buffers v3 (primary) + JSON (external)
**Service Definition:** `jarvis-system.proto` — single source of truth

```protobuf
service SystemIntelligence {
  // Observers (streaming)
  rpc SubscribeHardware(HardwareRequest) returns (stream HardwareSnapshot);
  rpc SubscribeProcesses(ProcessesRequest) returns (stream ProcessDelta);
  rpc SubscribeFilesystem(FSRequest) returns (stream FSEvent);
  rpc SubscribeNetwork(NetworkRequest) returns (stream NetworkSnapshot);
  rpc SubscribeServices(ServicesRequest) returns (stream ServiceDelta);
  rpc SubscribeLogs(LogsRequest) returns (stream LogEntry);
  
  // One-shot queries
  rpc GetSystemInfo(Empty) returns (SystemInfo);
  rpc QueryProcesses(ProcessQuery) returns (ProcessList);
  rpc QueryFiles(FSQuery) returns (FileList);
  rpc QueryPackages(PackageQuery) returns (PackageList);
  
  // Actuators (policy-gated)
  rpc ExecuteFileOp(FileOpRequest) returns (FileOpResponse);
  rpc ExecuteShell(ShellRequest) returns (ShellResponse);
  rpc ExecuteServiceOp(ServiceOpRequest) returns (ServiceOpResponse);
  rpc ExecutePackageOp(PackageOpRequest) returns (PackageOpResponse);
  
  // Policy
  rpc CheckPermission(PermissionCheck) returns (PermissionDecision);
  rpc RequestApproval(ApprovalRequest) returns (ApprovalToken);
}
```

---

### 2.6 Zero-Hallucination Grounding Layer

**Principle:** *Jarvis never states a system fact without a live citation.*

**Implementation:**
1. **Citation Manager** — every observer response includes `source: {observer, timestamp, query_id, raw_ref}`
2. **Fact Cache** — short-term (5-30s) memoization with explicit TTL
3. **Query Rewriter** — LLM queries → structured observer queries (no free-text to actuators)
4. **Verification Loop** — before answering user, Jarvis runs `VerifyClaim(claim, evidence[])` against live data
5. **Uncertainty Signaling** — if data stale/missing → "I don't have current data on X, last seen Y at Z"

**Prompt Injection for Jarvis Core:**
```
SYSTEM: You are Jarvis. You have access to a live system intelligence bus.
RULES:
1. NEVER state a system fact (process count, disk usage, service status, temperature, etc.) without citing a live observer response.
2. If you need system info, CALL the appropriate observer tool — do not guess.
3. If observer data is >30s old, note the staleness: "As of 10s ago, ..." or "Data may be stale; refreshing..."
4. For actions, you MUST request policy approval via the Policy Engine — describe what you want to do, the tool handles execution.
5. If an action fails, you get structured error + rollback info — explain to user what happened.
6. You CANNOT directly execute shell commands, write files, or control GUI. You request; the system executes with policy.
```

---

## 3. Technology Stack Recommendations

| Layer | Recommended | Alternatives |
|-------|-------------|--------------|
| **Core Language** | **Go** (observers, actuators, policy, bus) — fast, static, great syscalls, single binary | Rust, Zig |
| **Scripting/Glue** | **Python** (rapid prototyping, ML/OCR, data analysis) | Node.js, Deno |
| **Message Bus** | **NATS JetStream** (lightweight, streaming, persistence, replay) | Redis Streams, Kafka, gRPC streaming |
| **Policy Engine** | **OPA (Rego)** or **Cedar** | Custom, Casbin |
| **Serialization** | **Protocol Buffers v3** + **ConnectRPC** (gRPC-Web compatible) | Cap'n Proto, FlatBuffers |
| **Config** | **TOML** + **CUE** (validation) | YAML + JSON Schema |
| **Database** | **SQLite** (local, embedded) + **SQLC** (type-safe queries) | PostgreSQL, Redis |
| **Metrics/Observability** | **Prometheus** + **Grafana** + **OpenTelemetry** | Datadog, Honeycomb |
| **Logging** | **Zerolog** / **Slog** (structured JSON) + **Loki** | ELK, Vector |
| **Deployment** | **systemd** (Linux), **launchd** (macOS), **NSSM** (Windows) | Docker, Kubernetes (overkill for single host) |
| **GUI Automation** | **Playwright** (browser) + **platform-specific** (AT-SPI, UIA, AX) | Selenium, Puppeteer |

---

## 4. Project Structure

```
jarvis-system-intelligence/
├── cmd/
│   ├── jarvis-observers/          # Main observer daemon
│   ├── jarvis-actuators/          # Actuator daemon (policy-gated)
│   ├── jarvis-policy/             # OPA/Cedar policy server
│   ├── jarvis-bus/                # Message bus gateway (NATS + gRPC/WS)
│   └── jarvis-cli/                # CLI for testing/debugging
├── internal/
│   ├── observers/
│   │   ├── hardware/
│   │   ├── processes/
│   │   ├── filesystem/
│   │   ├── network/
│   │   ├── services/
│   │   ├── packages/
│   │   ├── logs/
│   │   ├── containers/
│   │   └── registry.go            # Observer registration + health
│   ├── actuators/
│   │   ├── filesystem/
│   │   ├── shell/
│   │   ├── services/
│   │   ├── packages/
│   │   ├── network/
│   │   ├── config/
│   │   └── registry.go
│   ├── policy/
│   │   ├── engine.go              # OPA/Cedar wrapper
│   │   ├── policies/              # .rego or .cedar files
│   │   └── test/                  # Policy unit tests
│   ├── bus/
│   │   ├── nats.go
│   │   ├── grpc.go
│   │   ├── ws.go
│   │   └── proto/                 # Generated from .proto
│   ├── grounding/
│   │   ├── citation.go
│   │   ├── fact_cache.go
│   │   ├── verifier.go
│   │   └── rewriter.go
│   └── security/
│       ├── sandbox.go             # Landlock, seccomp, namespaces
│       ├── audit.go               # Append-only signed audit log
│       └── approvals.go           # MFA, time-bound tokens
├── configs/
│   ├── observers.toml
│   ├── actuators.toml
│   ├── policy.toml
│   └── bus.toml
├── deploy/
│   ├── systemd/
│   ├── docker/
│   └── scripts/
├── tests/
│   ├── integration/
│   ├── policy/
│   └── chaos/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── policy-guide.md
│   └── security-model.md
├── go.mod / go.sum
├── pyproject.toml (for Python components)
├── Makefile / Taskfile.yml
└── README.md
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project scaffold + Go module + CI/CD
- [ ] Protocol Buffers schema (`jarvis-system.proto`) + codegen
- [ ] NATS JetStream setup + basic pub/sub
- [ ] Observer framework (interface, registration, health, metrics)
- [ ] **Core observers**: Hardware, OS, Processes, Filesystem (read-only)
- [ ] CLI tool to query observers (`jarvis-cli sysinfo`, `jarvis-cli ps`, `jarvis-cli fs`)

### Phase 2: Actuators + Policy (Week 2-3)
- [ ] Actuator framework (request/response, idempotency, audit)
- [ ] Policy engine integration (OPA) + default policies
- [ ] **Core actuators**: FileSystem (scoped), Shell (allowlisted), Services
- [ ] Approval flow (CLI + API for MFA/token)
- [ ] Audit log (append-only, signed, queryable)

### Phase 3: Advanced Observers + Grounding (Week 3-4)
- [ ] Network, Packages, Logs, Containers, Users observers
- [ ] Fact cache + citation manager + verifier
- [ ] Query rewriter (natural language → structured observer queries)
- [ ] Integration test: Jarvis Core → Bus → Observers → Grounded answers

### Phase 4: GUI Automation (Week 4-5, optional)
- [ ] Playwright service (browser)
- [ ] Platform desktop automation (AT-SPI / UIA / AX)
- [ ] Screen capture + OCR pipeline
- [ ] Window management

### Phase 5: Hardening & Production (Week 5-6)
- [ ] Sandboxing (Landlock, seccomp, user namespaces)
- [ ] Chaos testing (kill observers, network partition, policy denial)
- [ ] Performance benchmarks (latency, throughput, resource usage)
- [ ] Documentation + runbooks + disaster recovery
- [ ] Package as single binary + systemd unit + config management

---

## 6. Security Checklist (Non-Negotiable)

- [ ] **No root by default** — observers read `/proc`, `/sys` unprivileged; actuators use dedicated low-priv user
- [ ] **Landlock/seccomp** on every actuator process
- [ ] **User namespaces** for file/process operations
- [ ] **Policy as code** — version controlled, tested, reviewed
- [ ] **Audit log integrity** — append-only, cryptographically chained (hash chain or sigstore)
- [ ] **Approval tokens** — short-lived (5-15 min), scoped, MFA-backed for destructive ops
- [ ] **Rate limiting** — per actor, per resource, per operation type
- [ ] **Network egress control** — actuators cannot open arbitrary connections
- [ ] **Secret management** — no secrets in config; use OS keyring / Vault / age-encrypted files
- [ ] **Supply chain** — `go mod verify`, `sigstore` signatures, reproducible builds

---

## 7. Example Usage Flows

### Flow 1: "Jarvis, why is my laptop hot?"
```
User → Jarvis Core
Jarvis Core → QueryRecriber → "hardware.temperatures + hardware.fans + processes.top_cpu"
Bus → Hardware Observer (cached 5s) + Processes Observer (cached 2s)
Response → CitationManager → FactCache → Verifier
Jarvis Core: "As of 3s ago: CPU package 82°C, fan 4200 RPM. Top CPU: chrome (23%), cargo build (18%), jarvis-observers (5%). Want me to throttle cargo?"
```

### Flow 2: "Jarvis, restart the docker service"
```
User → Jarvis Core
Jarvis Core → PolicyEngine.CheckPermission({actor, action: "service.restart", target: "docker"})
PolicyEngine → Decision: ALLOW (with approval_token for destructive)
Jarvis Core → RequestApproval({scopes: ["service.restart"], ttl: "5m"})
User → Approves via CLI/phone
Jarvis Core → Bus → Actuator.ExecuteServiceOp({unit: "docker", op: "restart", approval_token})
Actuator → PolicyEngine (re-check) → systemctl restart docker
Actuator → AuditLog → Response: SUCCESS (duration 2.3s)
Jarvis Core → User: "Docker service restarted successfully in 2.3s."
```

### Flow 3: "Jarvis, find all Python files modified today over 100KB"
```
User → Jarvis Core
Jarvis Core → QueryRewriter → FSQuery{glob: "**/*.py", mtime_after: "today", size_min: 100KB}
Bus → Filesystem Observer (inotify + indexed DB)
Response → CitationManager → Jarvis Core
Jarvis Core → User: "Found 7 files: [list with paths, sizes, mtime citations]"
```

---

## 8. Integration with Your Existing Jarvis

**Assumption:** Your Jarvis is an LLM-powered agent with tool-calling capability.

**Integration Points:**
1. **Add `jarvis-system` as a tool namespace** — expose `observe.*, actuate.*, policy.*` tools
2. **Inject system prompt** (see §2.6) into Jarvis Core system prompt
3. **Shared auth** — Jarvis session identity → policy engine actor
4. **Event streaming** — Jarvis can subscribe to system events (alerts, thresholds)

**Minimal Adapter Interface (for your Jarvis codebase):**
```python
# jarvis_system_adapter.py
class JarvisSystemClient:
    def __init__(self, bus_url: str, auth_token: str):
        self.bus = connect(bus_url, auth_token)
    
    # Observers
    def get_hardware(self) -> HardwareSnapshot: ...
    def get_processes(self, filter: ProcessFilter) -> ProcessList: ...
    def get_files(self, query: FSQuery) -> FileList: ...
    def get_network(self) -> NetworkSnapshot: ...
    def get_services(self) -> ServiceList: ...
    def get_logs(self, query: LogQuery) -> LogStream: ...
    def subscribe_events(self, types: list[EventType]) -> EventStream: ...
    
    # Actuators (return pending + poll for result)
    def request_file_op(self, op: FileOp) -> OperationHandle: ...
    def request_shell(self, cmd: ShellCmd) -> OperationHandle: ...
    def request_service_op(self, op: ServiceOp) -> OperationHandle: ...
    
    # Policy
    def check_permission(self, action: Action) -> PermissionDecision: ...
    def request_approval(self, scopes: list[str], ttl: str) -> ApprovalToken: ...
```

---

## 9. Deliverables for This Prompt

When you give this to an AI coding agent, ask for:

1. **Complete working implementation** of Phases 1-3 (Phases 4-5 as stretch)
2. **Single binary** (`jarvis-system`) with subcommands: `observe`, `actuate`, `policy`, `bus`, `cli`
3. **systemd unit files** + **config templates** (TOML)
4. **Policy test suite** (OPA test cases for every default rule)
5. **Integration test** demonstrating zero-hallucination grounding
6. **README** with: architecture, quickstart, config reference, security model, troubleshooting
7. **Benchmark results** (observer latency, actuator overhead, bus throughput)
8. **Threat model document** (STRIDE analysis + mitigations)

---

## 10. Quickstart Command (for the agent)

```bash
# Expected final UX
git clone <repo>
cd jarvis-system-intelligence
make build          # builds single binary: ./bin/jarvis-system
sudo make install   # installs binary, systemd units, config to /etc/jarvis-system/
jarvis-system observe hardware --json
jarvis-system observe processes --stream
jarvis-system actuate filesystem write --path /tmp/test.txt --content "hello" --dry-run
jarvis-system policy check --actor jarvis --action shell --argv "ls,-la"
jarvis-system bus serve --config /etc/jarvis-system/bus.toml
```

---

## 11. Notes for the Coding Agent

- **Do not over-engineer Phase 1** — get observers publishing to bus first; policy/actuators can be stubbed
- **Use real system calls** — no mock data; test on actual Linux (and macOS/Windows if cross-platform claimed)
- **Observability first** — every component exports Prometheus metrics + structured logs from day 1
- **Test policy exhaustively** — `opa test` with positive/negative cases for every rule
- **Document the protobuf schema** — it's the contract; changes require version bump + migration
- **Prefer stdlib** — minimize dependencies; Go stdlib covers most syscalls
- **Handle partial failure** — observers crash → bus marks stale; actuators fail → audit + rollback
- **Respect user's existing stack** — if Jarvis uses Python, provide Python adapter; if Go, native client

---

## 12. Starter Commands for the Agent

```bash
# Scaffold
mkdir -p jarvis-system-intelligence/{cmd,internal/{observers,actuators,policy,bus,grounding,security},configs,deploy,tests,docs}
cd jarvis-system-intelligence
go mod init github.com/yourorg/jarvis-system-intelligence

# Add deps
go get github.com/nats-io/nats.go github.com/nats-io/nats-server/v2
go get github.com/connectrpc/connect-go google.golang.org/protobuf
go get github.com/open-policy-agent/opa/v2
go get github.com/prometheus/client_golang
go get github.com/shirou/gopsutil/v4
go get github.com/fsnotify/fsnotify
go get gopkg.in/yaml.v3 github.com/BurntSushi/toml
```

---

**End of Prompt.** Give this document to your AI coding agent. It contains everything needed to build a production-grade system intelligence layer for Jarvis with security, grounding, and extensibility baked in.