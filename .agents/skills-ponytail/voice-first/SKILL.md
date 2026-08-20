---
name: voice-first
description: Build or debug voice-first system components (Gemini Live, PCM16 streaming, hotkeys)
---
When working with voice-first interfaces and features:
- Core stack: Gemini Live API (v1beta), Socket.io, raw Float32/PCM16 Base64 audio, Win32-audio, three.js canvas orb.
- Performance: Prioritize low-latency streaming and robust socket transport. Ensure connection retries use exponential backoff.
- Speaking Rights Protocol: Respect AgentEventBus speaking rights protocol. Always request mic rights before broadcasting output and release them when done.
- Safety: Ensure hotkey monitoring (PowerShell key hook) works flawlessly and does not block background execution.
