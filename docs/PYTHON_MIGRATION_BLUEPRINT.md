## 🚀 J.A.R.V.I.S. Migration Action Blueprint## 1. Setup the Repository Workspace

* Where to do it: In your main JARVIS-linux project directory.
* What to do: Delete the node_modules directory, package.json, tsconfig.json, and all .ts files inside your old source directories.
* How to do it: Create three clean base folders: core_engine (for Python backend), audio_gateway (for Rust hardware management), and actuators (for compiled C++ execution assets).

## 2. Rebuild the Audio Pipeline (Rust)

* Where to do it: Inside the audio_gateway directory.
* What to do: Initialize a standard Rust application (cargo init). Add the cpal crate for native soundcard access and the standard unix network library.
* How to do it: Configure the soundcard driver to record audio at exactly 16kHz mono. Stream these raw audio bytes directly into a fast local Unix domain socket file located at /tmp/jarvis_audio.sock. This bypasses network ports for faster processing.

## 3. Establish the Orchestrator Engine (Python)

* Where to do it: Inside the core_engine directory.
* What to do: Initialize a virtual environment (python -m venv venv) and activate it. Install fastapi, websockets, jinja2, and pyside6.
* How to do it: Create an asynchronous main execution loop (asyncio). Set up a listener on /tmp/jarvis_audio.sock to catch the raw audio bytes streaming from your Rust gateway. Establish a permanent outbound secure WebSocket pipeline directly to the Gemini Live API endpoint, streaming the microphone audio chunks up and handling the responses seamlessly. [1, 2] 

## 4. Configure the Telgish Prompt Manager (Python + Jinja2)

* Where to do it: Inside a dedicated module inside the core_engine folder.
* What to do: Create a plaintext template file managed by Jinja2.
* How to do it: Define strict system behavior rules forcing the AI model to respond exclusively in Telgish (Romanized Telugu combined with English vocabulary). Use variable slots within the template to automatically inject live system metrics and your latest Obsidian notes right before shipping the prompt to the AI. [3] 

## 5. Build the Native Desktop HUD (Python + PySide6) [4] 

* Where to do it: Inside a dedicated user interface file under core_engine.
* What to do: Create a graphical overlay using PySide6 to replace the old React/Web layout.
* How to do it: Initialize a desktop application layout. Apply specific window flags (FramelessWindowHint and WindowStaysOnTopHint) and set the background transparency attribute to true. This builds a lightweight, hardware-accelerated glassmorphism overlay resting directly on your Linux desktop environment. [5, 6] 

## 6. Transition Actions to C++ and Bash Actuators

* Where to do it: Inside the actuators and scripts directories.
* What to do: Move heavy calculations to compiled C++ binaries and simple desktop settings to basic shell scripts.
* How to do it: Write brief C++ files that scan /proc/meminfo or talk to Linux D-Bus systems directly. Compile them into a static bin/ directory. Use standard Python system execution commands (subprocess) to fire off these native tools and shell commands immediately whenever your voice model triggers a device utility action.

------------------------------
