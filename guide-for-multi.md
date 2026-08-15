# Jarvis 24/7 Multi Agent System PRD TRD Developer Guide
## 🛠️ System Master Specification: Jarvis Multi-Agent Ecosystem
This document serves as the finalized authoritative blueprint for building a lightweight, low-complexity, 24/7 autonomous voice assistant. It fuses the architectural paradigms of Java SE (Continuous Orchestration & Security), Rust (Microsecond Audio Gateway), and C++ (Instant System Workers).
------------------------------
## 📋 1. Product Requirement Document (PRD)## 1.1 Vision & Core Objective
The target system is a voice-first, 24/7 continuous autonomous assistant customized for a single user on a local Ubuntu 26.04 LTS host, completely ready for migration to a cloud VPS. The system mirrors a strict corporate hierarchy (CEO ➔ Manager) where specialized assistant personas stay alert and run calculations silently in the background, speaking only when a voice protocol token is explicitly granted via real-time WebRTC live streams.
## 1.2 System Personas & Domains

* Prime J.A.R.V.I.S. (Prime Orchestrator / CEO): The primary interface and commander of the ecosystem. Holds default voice priority, maintains global conversational state, evaluates user intent, and delegates operational execution to the underlying manager tier.
* F.R.I.D.A.Y. (Master Intelligence): Equipped with overall macro-knowledge and comprehensive tracking of the whole world's data assets. Friday acts as the core analytical engine for heavy data synthesis and contextual processing.
* U.L.T.R.O.N. (Full Security Team & System Care): Operates as an automated, proactive defensive shield. Ultron is responsible for monitoring system integrity, firewall rules, blocking unauthorized network intrusions, preventing exploits, and taking complete care of host maintenance.
* E.D.I.T.H. (Internet Controller): Holds full command and control over external web networks. Edith manages scraping protocols, API integrations, remote connection streams, and wide-area web data collection.

## 1.3 Core Product Capabilities

* Voice-First Interaction Layer: Utilizing real-time WebRTC channels to deliver ultra-low latency, fluid, live conversational streaming with zero lag.
* 24/7 High-Availability Guarantee: The background orchestration infrastructure remains continuously active as a headless Linux system service, handling alerts, security incidents, and tracking tasks without requiring a web browser interface.
* Dynamic Audio-Focus Protocols:
* Muted Relay (Default Mode): Active background managers process systemic data or execute tools silently. When updates occur, they pass plain text to J.A.R.V.I.S., who reads them out loud using his primary voice channel.
   * Voice Patch-Through (Active Voice Protocol): Explicit user voice activation triggers an audio-focus switch, instantly muting J.A.R.V.I.S. and granting direct WebRTC microphone/speaker bindings to the selected manager.
* Low-Complexity Architecture: Avoids heavy multi-channel audio mixing software or multiple concurrent web socket handling threads. Uses single-stream prompt context swapping and direct text-based data execution layers to preserve host hardware resources.

## 1.4 Future Proofing Requirement
The system is built as a two-tier configuration where managers execute local compiled system tools directly. The boundary paths must remain completely modular so that these direct tools can eventually be extracted and handed down to an isolated third tier (Tier 3: Worker Subagents) without breaking the established core WebRTC stream or Java state machine.
------------------------------
## ⚙️ 2. Technical Requirement Document (TRD)## 2.1 Three-Tier Decoupled Language Layout
To run continuously on a constrained 8 GB RAM / 12-Thread Intel i5 Ubuntu system without memory leaks or stuttering, operational duties are split cleanly along language runtime capabilities:

┌────────────────────────────────────────────────────────┐
│ 1. THE VOICE CHANNEL (RUST)                            │
│ - Taps hardware via CPAL (Linux ALSA/PulseAudio).      │
│ - Zero GC overhead; ultra-low buffer streaming.       │
└─────────────────────────┬──────────────────────────────┘
                          │ (Secure Local IPC Socket / TCP 127.0.0.1)
                          ▼
┌────────────────────────────────────────────────────────┐
│ 2. THE 24/7 MASTER ORCHESTRATOR (JAVA SE)              │
│ - Persistent WebSocket connected to Gemini Live API.   │
│ - Evaluates JSON state variables & text prompts.       │
│ - Monitors timers, file changes, and background events.│
└─────────────────────────┬──────────────────────────────┘
                          │ (Asynchronous Linux Child Process)
                          ▼
┌────────────────────────────────────────────────────────┐
│ 3. INSTANT WORKER EXECUTIONS (C++)                     │
│ - Isolated, static binaries using Approach A.          │
│ - Executes system tasks in under 1 millisecond.        │
│ - Returns plain text outputs and immediately exits.   │
└────────────────────────────────────────────────────────┘

## 2.2 Functional Layer Specifications## Tier 1: The Voice Gateway (Rust)

* Core Libraries: tokio (Asynchronous engine), cpal (Cross-platform audio library).
* Implementation Strategy: Handles raw hardware microphone sampling and playback routing exclusively. It packages raw binary PCM audio chunks and proxies them instantly over a local TCP pipe directly to the Java runtime. It holds zero AI context or application state, ensuring a tiny background footprint that sleeps when voice interaction is inactive.

## Tier 2: The Continuous Core (Java SE)

* Core Libraries: Pure java.net.http.WebSocket, java.util.concurrent executors.
* Implementation Strategy: Runs continuously as an unprivileged Ubuntu background daemon via systemd. It initiates and maintains the single persistent, bidirectional WebSocket connection to the Gemini Live cloud API. Java manages security tokens, schedules cron jobs, maintains memory variables, and structures dynamic prompt updates before routing them over the network.

## Tier 3: The System Workers (C++)

* Core Libraries: Standard C++ STL (<filesystem>, <iostream>, <sys/sysinfo.h>).
* Implementation Strategy (Approach A - Asynchronous Binary): Instead of compiling massive dynamic shared libraries in memory, managers trigger separate, lightweight compiled C++ executables via Java's non-blocking ProcessBuilder. These executables carry zero background RAM overhead, execute in under 1ms, output their results via standard standard output streams, and immediately terminate to free 100% of their memory back to the host operating system.

------------------------------
## 💻 3. Developer Implementation & Configuration Guide## 3.1 Directory Tree Structure on Ubuntu
Maintain this minimalist folder layout under your user profile directory to keep development completely clean and ready for seamless VPS or Docker deployment:

/home/user/jarvis_core/
├── config/
│   ├── jarvis.service          # Ubuntu systemd daemon descriptor file
│   └── prompts/                # Pre-cached system context files
│       ├── jarvis_prime.txt    # CEO Orchestrator context
│       ├── friday_master.txt   # Global world knowledge context
│       ├── ultron_security.txt # Defensive and firewall context
│       └── edith_internet.txt  # Web scraper and controller context
├── gateway_rust/               # High-speed local WebRTC audio gateway
│   ├── Cargo.toml
│   └── src/main.rs
├── orchestrator_java/          # 24/7 Persistent Java State Engine
│   ├── src/Main.java
│   └── pom.xml
└── workers_cpp/                # Compiled instant on-demand utilities
    ├── src/open_app.cpp        # Application launcher
    ├── src/firewall_audit.cpp  # Ultron threat scanning engine
    └── bin/                    # Executable targets invoked by Java

## 3.2 Low-Complexity Programming Strategies## A. Single WebSocket Prompt-Swapping (The Performance Fix)
To prevent your 8 GB machine from thrashing with multiple heavy networking threads, pass text state identifiers through your open stream instead of multiplexing backend data connections.

// Java Orchestration Logic: Persona Interceptpublic void routeUserIntent(String rawText, WebSocket webSocket) {
    if (rawText.toLowerCase().contains("ultron")) {
        // Dynamic Injection: Hot-swap the underlying prompt on the fly
        String hotSwapDirective = "[CONTEXT SHIFT: You are now U.L.T.R.O.N. Your domain is full system security and firewall management. Output response text wrapped in braces {}]";
        webSocket.sendText(hotSwapDirective, true);
    }
}

## B. Prompt-Enforced Muting (The Simplest Audio Gate)
Rather than writing an audio buffer mixing application in Rust or Java, use prompt instructions to command Gemini to output audio data selectively:

[SYSTEM PROTOCOL CONFIGURATION]
1. You act as the multi-agent terminal supervisor.
2. If the active_voice_token is false, you must execute requested tool functions and output your response text cleanly wrapped inside structural braces (e.g., {Security Scan Complete: No Threats Found}).
3. CRITICAL: You must NOT append any audio payload frames to your WebSocket response unless active_voice_token is explicitly verified as true.

The Java layer reads the returned text frame. If the output contains the raw text braces {...}, it strips the string content and lets J.A.R.V.I.S. voice it to you, discarding any blank or default background audio packets instantly.
## C. Asynchronous Non-Blocking C++ Execution
When a tool call requires OS integration, the Java orchestrator spawns the independent C++ binary asynchronously. This keeps the network streaming logic completely free from execution blocking.

// Java Tool Invocation: Non-blocking System Executionpublic void triggerCppWorker(String binaryName, String arguments) {
    CompletableFuture.runAsync(() -> {
        try {
            ProcessBuilder pb = new ProcessBuilder("/home/user/jarvis_core/workers_cpp/bin/" + binaryName, arguments);
            Process process = pb.start();
            
            // Read output stream from the fast C++ compiled tool
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String resultText = reader.readLine();
            
            // Append the returned string back into your centralized memory layer
            updateSharedMemoryStore(resultText);
        } catch (Exception e) {
            System.err.println("Worker execution fault: " + e.getMessage());
        }
    });
}

## 3.3 24/7 Service Production Deployment Template
To ensure the backend orchestrator functions without interruption indefinitely, mount the compiled Java JAR file directly into the local Linux initialization system layer.
Create the configuration file /etc/systemd/system/jarvis.service:

[Unit]
Description=Jarvis 24/7 Multi-Agent Continuous Core
After=network.target

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/jarvis_core/orchestrator_java
ExecStart=/usr/bin/java -jar target/jarvis-orchestrator-1.0.jar
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target

Execute these terminal commands exactly once to register, bind, and launch the daemon permanently:

sudo systemctl daemon-reload
sudo systemctl enable jarvis.service
sudo systemctl start jarvis.service

## 3.4 Roadmap Blueprint: Shifting to Tier 3 Subagents
When you decide to split your Tier 2 Managers down into a deep worker subagent tier (CEO ➔ Manager ➔ Worker Subagent), use this clear decoupling plan:

   1. Keep the Interfaces Identical: The Java code executing the C++ processes will not change.
   2. Move Code out of the Managers: Instead of a manager binary processing complex text files, your C++ tool will be minimized. It will act as a tiny coordinator that calls separate, individual command-line sub-scripts.
   3. JSON Relay: Managers will output clear sub-task JSON instructions down to the new worker subagents, keeping the primary live voice stream running smoothly on your laptop.


