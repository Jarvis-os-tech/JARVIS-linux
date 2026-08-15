# Jarvis System Intelligence & Computer Use Architecture Plan

## 1. Executive Summary
This document outlines the architectural blueprint for Jarvis's System Intelligence and Computer Use layer. The goal is to provide a zero-hallucination, secure, high-performance operational core that grants Jarvis real-time system observability and policy-gated control over the host environment.

---

## 2. Core Architectural Pillars

### A. Read-Only System Observers
High-frequency, non-blocking telemetry collection covering:
- **Hardware & Sensors:** CPU, RAM, disk, GPU (NVIDIA/AMD), temperatures, and fan speeds.
- **OS & Kernel:** Distribution details, kernel version, uptime, and system logs (`journalctl`).
- **Processes & Resources:** Active PIDs, CPU/memory hogs, and cgroup stats.
- **Filesystem & Network:** Mount points, disk usage, active TCP/UDP connections, and bandwidth.
- **Services & Packages:** Systemd unit statuses and installed package versions.

### B. Controlled Actuators (Write Operations)
Policy-enforced execution layer for system modifications:
- **File System Operations:** Scoped file reading, writing, and directory management with git-backed backups.
- **Process Management:** Graceful/forceful termination and signal dispatch.
- **Shell Execution:** Sandboxed execution via allowlisted command arrays (no raw bash injection).
- **Service Management:** Systemd unit control (start/stop/restart) with explicit approval tokens.

### C. GUI & Desktop Automation
Cross-platform desktop interaction layer:
- **X11 / Wayland Support:** Automated control via `ydotool`, `xdotool`, `wtype`, and `wlrctl`.
- **Window Management:** Enumeration, focusing, resizing, and geometric positioning via `wmctrl` and `xprop`.
- **Visual Grounding:** Screen capture pipelines (`mss`, `grim`) combined with OCR/UI parsing.

### D. Policy Engine & Security Core
Declarative security enforcement:
- **Deny-by-Default:** All write actions require explicit policy evaluation (via OPA/Rego).
- **Audit Trails:** Append-only, cryptographically signed audit logs for every actuator request.
- **Destructive Approvals:** Short-lived, scoped approval tokens for high-risk operations.

---

## 3. Implementation Roadmap

### Phase 1: Foundation & Observers (Week 1)
- [ ] Scaffold Python/Go observer modules.
- [ ] Implement core observers (Hardware, OS, Processes, Filesystem).
- [ ] Establish JSON-structured output formatting with live timestamps and citations.

### Phase 2: Actuators & Policy Enforcement (Week 2)
- [ ] Implement sandboxed actuator wrappers (Filesystem, Shell, Services).
- [ ] Establish pre-flight policy check gates for all write operations.
- [ ] Build append-only audit logging for accountability.

### Phase 3: Desktop Automation & GUI (Week 3)
- [ ] Finalize `desktop_control.py` for X11 and Wayland environments.
- [ ] Integrate screen capture and window inspection utilities.
- [ ] Verify input simulation (`ydotool`/`xdotool`) for reliable click/type workflows.

### Phase 4: Grounding & Zero-Hallucination Layer (Week 4)
- [ ] Implement Citation Manager to tie all LLM responses to live observer data.
- [ ] Set up short-term Fact Caching with explicit TTLs.
- [ ] Enforce system prompt rules requiring live citations for all system metrics.

---

## 4. Operational Guidelines for Jarvis
1. **Never Guess:** If system state is unknown, invoke an observer tool. Do not estimate metrics.
2. **Cite Everything:** All system observations must include a timestamp and source reference.
3. **Safety First:** Destructive actions must pass through the policy engine and obtain proper authorization.
