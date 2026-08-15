// Google Workspace Tools & Autonomous Action Execution Layer for J.A.R.V.I.S.
import {
  getSystemTelemetryGroundTruth,
  getBatteryStatus,
  getSystemVolume,
  setSystemVolume,
  getScreenBrightness,
  setScreenBrightness,
  getThermalSensors,
  getDetailedStorageUsage,
  launchApplication,
  listInstalledApplications,
  getRunningProcesses,
  manageProcess,
  getPowerProfile,
  setPowerProfile,
  getNetworkStatusGroundTruth,
  controlMediaPlayback,
  systemPowerAction,
  sendDesktopNotification,
  executeSystemCommand,
  searchLocalFiles,
  readLocalFile,
  writeLocalFile,
  takeScreenshot,
  getPcSpecGroundTruth,
  getFirewallStatus,
  desktopControlAction,
  manageSystemdService,
  getSystemLogs,
  managePackages,
  getNetworkConnections,
  listDirectory,
  deleteLocalFile,
  clipboardControl,
  getEnvironmentInfo
} from './system_controller';

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

// 1. Gemini Function Declarations for Google Workspace
export const WORKSPACE_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  // --- GMAIL TOOLS ---
  {
    name: 'send_email',
    description: 'Send an email via the user\'s Google Workspace / Gmail account to one or more recipients with subject, body text or HTML, and optional CC/BCC.',
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Recipient email address (e.g. "alex@example.com" or comma-separated list).' },
        subject: { type: 'STRING', description: 'Subject line of the email.' },
        body: { type: 'STRING', description: 'The text or HTML content of the email body.' },
        cc: { type: 'STRING', description: 'Optional CC email address.' },
        bcc: { type: 'STRING', description: 'Optional BCC email address.' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'search_emails',
    description: 'Search the user\'s Gmail inbox or sent messages using standard Gmail search queries (e.g. "is:unread", "from:colleague@company.com", "subject:invoice").',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Gmail query string (e.g. "is:unread", "from:sarah", "important"). Default is all recent emails.' },
        maxResults: { type: 'INTEGER', description: 'Maximum number of messages to return (default 5, max 20).' }
      }
    }
  },
  {
    name: 'get_email_details',
    description: 'Fetch the full content, sender, subject, date, and body of a specific email by its message ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        messageId: { type: 'STRING', description: 'The unique message ID of the email to inspect.' }
      },
      required: ['messageId']
    }
  },
  {
    name: 'create_email_draft',
    description: 'Create a draft email in Gmail without sending it immediately.',
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Recipient email address.' },
        subject: { type: 'STRING', description: 'Draft subject line.' },
        body: { type: 'STRING', description: 'Draft message body.' }
      },
      required: ['to', 'subject', 'body']
    }
  },

  // --- GOOGLE CALENDAR TOOLS ---
  {
    name: 'create_calendar_event',
    description: 'Schedule a new calendar meeting or event in Google Calendar with title, start time, end time, location, description, and attendee invitations.',
    parameters: {
      type: 'OBJECT',
      properties: {
        summary: { type: 'STRING', description: 'Title / Summary of the event or meeting (e.g. "Project Roadmap Sync").' },
        startTime: { type: 'STRING', description: 'Event start time in ISO 8601 format (e.g. "2026-08-16T10:00:00+05:30" or "2026-08-16T14:30:00Z").' },
        endTime: { type: 'STRING', description: 'Event end time in ISO 8601 format (e.g. "2026-08-16T11:00:00+05:30" or "2026-08-16T15:30:00Z").' },
        description: { type: 'STRING', description: 'Optional agenda or notes for the calendar event.' },
        location: { type: 'STRING', description: 'Optional location or video conference link (e.g. "Google Meet", "Room 4B").' },
        attendees: { type: 'STRING', description: 'Optional comma-separated list of attendee email addresses to invite.' }
      },
      required: ['summary', 'startTime', 'endTime']
    }
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming Google Calendar events or meetings within a specified time range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeMin: { type: 'STRING', description: 'Start time filter in ISO 8601 format (defaults to current time).' },
        timeMax: { type: 'STRING', description: 'Optional end time filter in ISO 8601 format.' },
        maxResults: { type: 'INTEGER', description: 'Maximum number of events to return (default 10).' },
        query: { type: 'STRING', description: 'Free text search term to filter event titles or descriptions.' }
      }
    }
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete / cancel an event from the user\'s primary Google Calendar by event ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        eventId: { type: 'STRING', description: 'The unique ID of the calendar event to delete.' }
      },
      required: ['eventId']
    }
  },

  // --- GOOGLE TASKS TOOLS ---
  {
    name: 'create_task',
    description: 'Create a new task / todo item in Google Tasks with title, optional notes/description, and due date.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'The task title or description (e.g. "Review Q3 marketing plan").' },
        notes: { type: 'STRING', description: 'Optional additional details or instructions for the task.' },
        due: { type: 'STRING', description: 'Optional due date in RFC 3339 format (e.g. "2026-08-20T18:00:00Z").' }
      },
      required: ['title']
    }
  },
  {
    name: 'list_tasks',
    description: 'List tasks and todo items from the user\'s Google Tasks lists.',
    parameters: {
      type: 'OBJECT',
      properties: {
        showCompleted: { type: 'BOOLEAN', description: 'Whether to include completed tasks (default false).' },
        maxResults: { type: 'INTEGER', description: 'Maximum number of tasks to return (default 20).' }
      }
    }
  },
  {
    name: 'complete_task',
    description: 'Mark an existing Google Task as completed.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'The unique ID of the task to mark as completed.' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'delete_task',
    description: 'Delete a task from Google Tasks.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'The unique ID of the task to delete.' }
      },
      required: ['taskId']
    }
  },

  // --- GOOGLE DOCS TOOLS ---
  {
    name: 'create_google_doc',
    description: 'Create a new Google Document in the user\'s Google Drive with a custom title and optional initial content/body.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'The title of the new Google Document (e.g. "Project Alpha Architecture").' },
        content: { type: 'STRING', description: 'Initial text content to insert into the document.' }
      },
      required: ['title']
    }
  },
  {
    name: 'read_google_doc',
    description: 'Read the full plain text content of a Google Document by its Document ID or Google Docs URL.',
    parameters: {
      type: 'OBJECT',
      properties: {
        documentId: { type: 'STRING', description: 'Google Document ID or full URL.' }
      },
      required: ['documentId']
    }
  },
  {
    name: 'append_to_google_doc',
    description: 'Append text or notes to the end of an existing Google Document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        documentId: { type: 'STRING', description: 'Google Document ID or full URL.' },
        text: { type: 'STRING', description: 'Text to append to the document.' }
      },
      required: ['documentId', 'text']
    }
  },

  // --- GOOGLE SHEETS TOOLS ---
  {
    name: 'create_google_sheet',
    description: 'Create a new Google Spreadsheet with a title, optional column header names, and optional initial rows of data.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title of the new spreadsheet (e.g. "Monthly Budget Tracker 2026").' },
        headers: { type: 'STRING', description: 'Comma-separated column header names (e.g. "Date, Description, Category, Amount").' },
        initialRows: { type: 'STRING', description: 'JSON string of 2D array or comma/newline separated rows to populate into the sheet.' }
      },
      required: ['title']
    }
  },
  {
    name: 'read_google_sheet',
    description: 'Read table values from a Google Spreadsheet by spreadsheet ID and optional A1 range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        spreadsheetId: { type: 'STRING', description: 'Google Spreadsheet ID or full URL.' },
        range: { type: 'STRING', description: 'A1 notation range to read (e.g. "Sheet1!A1:Z100" or "A1:E20"). Default is "Sheet1!A1:Z50".' }
      },
      required: ['spreadsheetId']
    }
  },
  {
    name: 'append_to_google_sheet',
    description: 'Append one or more rows of data to an existing Google Spreadsheet.',
    parameters: {
      type: 'OBJECT',
      properties: {
        spreadsheetId: { type: 'STRING', description: 'Google Spreadsheet ID or full URL.' },
        range: { type: 'STRING', description: 'Target sheet or starting range (e.g. "Sheet1!A1"). Default is "Sheet1!A1".' },
        rows: { type: 'STRING', description: 'JSON string 2D array of rows (e.g. "[[\"2026-08-15\", \"Cloud Hosting\", \"Infrastructure\", \"$120.00\"]]") or comma-separated values.' }
      },
      required: ['spreadsheetId', 'rows']
    }
  },

  // --- GOOGLE DRIVE TOOLS ---
  {
    name: 'search_drive_files',
    description: 'Search for any files or folders in Google Drive by keyword name, mimeType, or recent modification.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search term for file name or content.' },
        fileType: { type: 'STRING', description: 'Filter by type: "all", "doc", "sheet", "slide", "pdf", "folder".', enum: ['all', 'doc', 'sheet', 'slide', 'pdf', 'folder'] },
        limit: { type: 'INTEGER', description: 'Number of files to return (default 15).' }
      }
    }
  },
  {
    name: 'create_drive_folder',
    description: 'Create a new folder in Google Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        folderName: { type: 'STRING', description: 'The name of the new folder.' }
      },
      required: ['folderName']
    }
  },

  // =========================================================================
  // --- REAL-TIME SYSTEM INFORMATION & AUTONOMOUS COMPUTER USE TOOLS ---
  // =========================================================================
  {
    name: 'set_system_volume',
    description: 'Control host audio volume and mute state via PipeWire/ALSA. Can set exact volume percentage (0-100%), relative changes (e.g. "+10%", "-5%"), mute/unmute speakers, or control microphone.',
    parameters: {
      type: 'OBJECT',
      properties: {
        percent: { type: 'INTEGER', description: 'Target volume percentage between 0 and 150 (e.g. 50 for 50%, 80 for 80%).' },
        relative: { type: 'STRING', description: 'Relative volume adjustment string (e.g. "+10%", "-5%", "+20%").' },
        mute: { type: 'BOOLEAN', description: 'Explicitly mute (true) or unmute (false).' },
        toggleMute: { type: 'BOOLEAN', description: 'Toggle mute status on/off.' },
        target: { type: 'STRING', description: 'Control target: "sink" for speakers/headphones (default) or "source" for microphone.', enum: ['sink', 'source'] }
      }
    }
  },
  {
    name: 'get_system_volume',
    description: 'Get real-time ground truth speaker volume percentage, mute status, and microphone status.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'set_screen_brightness',
    description: 'Control host screen brightness via GNOME Wayland Display DBus and /sys/class/backlight. Adjust brightness to a percentage (0-100%) or relatively (+10/-10).',
    parameters: {
      type: 'OBJECT',
      properties: {
        percent: { type: 'INTEGER', description: 'Target brightness percentage between 1 and 100.' },
        relative: { type: 'INTEGER', description: 'Relative brightness adjustment (e.g. 10 to increase by 10%, -15 to decrease by 15%).' }
      }
    }
  },
  {
    name: 'get_screen_brightness',
    description: 'Get real-time display brightness percentage and connector information.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'launch_application',
    description: 'Autonomously launch any desktop application, IDE, browser, terminal command, or URL on the host machine in a non-blocking detached process.',
    parameters: {
      type: 'OBJECT',
      properties: {
        appNameOrCommand: { type: 'STRING', description: 'Application name or command (e.g. "google-chrome", "code", "nautilus", "gnome-terminal", "firefox", "spotify", "https://youtube.com").' },
        args: { type: 'STRING', description: 'Optional command line arguments or URL/file path.' }
      },
      required: ['appNameOrCommand']
    }
  },
  {
    name: 'list_installed_applications',
    description: 'List installed desktop GUI applications available on the host system.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_system_telemetry',
    description: 'Retrieve real-time zero-hallucination ground truth telemetry for the host system: CPU cores and load average, RAM total/used/free, disk usage, uptime, battery status, and OS info.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_battery_status',
    description: 'Retrieve accurate battery state from hardware sensors (percentage, charging state, AC power status, time remaining).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_thermal_sensors',
    description: 'Retrieve real-time CPU/GPU thermal sensors, core temperatures in Celsius, and thermal throttling status.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_storage_usage',
    description: 'Get detailed storage partition breakdown for all mounted disks and filesystems with total, used, free space, and percentages.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_running_processes',
    description: 'List top active system processes sorted by CPU or Memory usage with PID, CPU %, Memory %, user, and command line.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sortBy: { type: 'STRING', description: 'Sort criteria: "cpu" (default), "memory", or "pid".', enum: ['cpu', 'memory', 'pid'] },
        limit: { type: 'INTEGER', description: 'Maximum number of processes to return (default 15, max 50).' }
      }
    }
  },
  {
    name: 'manage_process',
    description: 'Send signals to manage or terminate running processes on the host (kill, pause, resume) by PID or process name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pid: { type: 'INTEGER', description: 'Process ID to target.' },
        processName: { type: 'STRING', description: 'Process name to target with pkill.' },
        signal: { type: 'STRING', description: 'Signal to send: "SIGTERM" (graceful, default), "SIGKILL" (force kill), "SIGSTOP" (pause), "SIGCONT" (resume).', enum: ['SIGTERM', 'SIGKILL', 'SIGSTOP', 'SIGCONT'] }
      }
    }
  },
  {
    name: 'control_media_playback',
    description: 'Control host desktop media playback (play, pause, toggle play/pause, next track, previous track, stop).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Playback action: "play", "pause", "toggle", "next", "previous", or "stop".', enum: ['play', 'pause', 'toggle', 'next', 'previous', 'stop'] }
      },
      required: ['action']
    }
  },
  {
    name: 'system_power_action',
    description: 'Trigger host system power or session commands: lock screen ("lock"), suspend/sleep ("sleep"), restart ("reboot"), or power off ("shutdown").',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Power action: "lock", "sleep", "reboot", "shutdown".', enum: ['lock', 'sleep', 'reboot', 'shutdown'] }
      },
      required: ['action']
    }
  },
  {
    name: 'send_system_notification',
    description: 'Display a native desktop notification banner on the host Linux desktop.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Notification title.' },
        message: { type: 'STRING', description: 'Notification body message.' },
        urgency: { type: 'STRING', description: 'Urgency level: "low", "normal", "critical".', enum: ['low', 'normal', 'critical'] }
      },
      required: ['title', 'message']
    }
  },
  {
    name: 'set_power_profile',
    description: 'Switch system power management profile between power-saver, balanced, and performance.',
    parameters: {
      type: 'OBJECT',
      properties: {
        profile: { type: 'STRING', description: 'Target profile: "power-saver", "balanced", or "performance".', enum: ['power-saver', 'balanced', 'performance'] }
      },
      required: ['profile']
    }
  },
  {
    name: 'get_network_status',
    description: 'Get real-time network and connectivity status: WiFi SSID, signal quality, local IP address, gateway ping latency, and DNS resolution speed.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'execute_system_command',
    description: 'Execute an autonomous shell command on the host Linux system and return the exit code, stdout, and stderr.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'The bash shell command to execute.' },
        cwd: { type: 'STRING', description: 'Optional working directory.' },
        timeoutMs: { type: 'INTEGER', description: 'Execution timeout in milliseconds (default 15000).' }
      },
      required: ['command']
    }
  },
  {
    name: 'search_local_files',
    description: 'Search for files and directories on the local host filesystem matching a glob pattern with high speed.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pattern: { type: 'STRING', description: 'Filename pattern to match (e.g. "*.ts", "*.png", "report*").' },
        rootDir: { type: 'STRING', description: 'Root directory to start search (default current workspace).' },
        maxResults: { type: 'INTEGER', description: 'Maximum number of results to return (default 20).' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'read_local_file',
    description: 'Read the contents of a local file on the host filesystem.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filePath: { type: 'STRING', description: 'Absolute or relative file path to read.' },
        maxLines: { type: 'INTEGER', description: 'Maximum number of lines to read (default 300).' },
        offset: { type: 'INTEGER', description: 'Starting line offset (0-indexed).' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'write_local_file',
    description: 'Create or append text content to a local file on the host filesystem.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filePath: { type: 'STRING', description: 'Target file path.' },
        content: { type: 'STRING', description: 'Text content to write.' },
        append: { type: 'BOOLEAN', description: 'Whether to append to existing file (true) or overwrite (false).' }
      },
      required: ['filePath', 'content']
    }
  },
  {
    name: 'take_screenshot',
    description: 'Capture a full desktop screenshot on the host machine in real-time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        outputPath: { type: 'STRING', description: 'Optional destination file path for screenshot PNG.' }
      }
    }
  },
  {
    name: 'get_pc_spec',
    description: 'Retrieve complete, zero-hallucination, ground-truth PC and hardware specifications (CPU architecture/cores/threads/caches/flags, RAM total/used/swap, GPU model/VRAM/display, Storage NVMe/SSD drives and partitions, Motherboard/BIOS/DMI, Network MAC/IP/speed, Audio, Battery health/cycle count, OS distribution/kernel/uptime).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'get_firewall_status',
    description: 'Inspect Linux firewall rules, active iptables/ufw/nftables chains, listening network ports, and security audit metrics.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'desktop_control',
    description: 'Autonomous computer use and desktop GUI control: list open windows, focus window, close window, click mouse, move cursor, scroll, type text, send keyboard hotkeys (e.g. "ctrl+c", "alt+tab", "super"), or capture screenshot.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Action to execute', enum: ['env', 'list_windows', 'focus_window', 'close_window', 'click', 'move', 'scroll', 'type_text', 'hotkey', 'screenshot', 'launch_app', 'close_app'] },
        target: { type: 'STRING', description: 'Target window title/ID or application name' },
        x: { type: 'INTEGER', description: 'X coordinate for mouse click or move' },
        y: { type: 'INTEGER', description: 'Y coordinate for mouse click or move' },
        button: { type: 'STRING', description: 'Mouse button ("left", "right", "middle")', enum: ['left', 'right', 'middle'] },
        count: { type: 'INTEGER', description: 'Click repeat count (1 for single, 2 for double click)' },
        dx: { type: 'INTEGER', description: 'Horizontal scroll amount' },
        dy: { type: 'INTEGER', description: 'Vertical scroll amount' },
        text: { type: 'STRING', description: 'Text string to type into active window' },
        combo: { type: 'STRING', description: 'Key combination (e.g. "ctrl+c", "alt+Tab", "ctrl+alt+t")' },
        path: { type: 'STRING', description: 'Output path for screenshot PNG' }
      },
      required: ['action']
    }
  },
  {
    name: 'manage_systemd_service',
    description: 'Inspect or control systemd services on the host machine (list services, query status, start, stop, restart, enable, disable).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Action to perform', enum: ['list', 'status', 'start', 'stop', 'restart', 'enable', 'disable'] },
        unit: { type: 'STRING', description: 'Service unit name (e.g. "docker.service", "nginx.service", "bluetooth.service")' }
      },
      required: ['action']
    }
  },
  {
    name: 'get_system_logs',
    description: 'Query and inspect host Linux system and service logs in real-time (systemd journalctl, kernel ring buffer dmesg, syslog, auth logs) with filtering by unit, lines, priority, since, or search term.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source: { type: 'STRING', description: 'Log source: "journalctl" (default), "dmesg", "syslog", "auth".', enum: ['journalctl', 'dmesg', 'syslog', 'auth'] },
        unit: { type: 'STRING', description: 'Filter by systemd service unit name (e.g. "docker", "ssh", "nginx", "NetworkManager").' },
        lines: { type: 'INTEGER', description: 'Number of recent log lines to retrieve (default 50, max 200).' },
        priority: { type: 'STRING', description: 'Priority level filter: "emerg", "alert", "crit", "err", "warning", "notice", "info", "debug".' },
        since: { type: 'STRING', description: 'Time filter (e.g. "1 hour ago", "yesterday", "2026-08-15 10:00:00").' },
        grep: { type: 'STRING', description: 'Keyword pattern to search/filter in logs.' }
      }
    }
  },
  {
    name: 'manage_packages',
    description: 'Inspect, search, install, remove, or update software packages across system and language package managers (apt, npm, pip, flatpak, snap, cargo, dnf, pacman).',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Package action: "search", "info", "install", "remove", "update", "list_installed", "check_upgrades".', enum: ['search', 'info', 'install', 'remove', 'update', 'list_installed', 'check_upgrades'] },
        packageManager: { type: 'STRING', description: 'Target package manager: "auto" (default), "apt", "npm", "pip", "flatpak", "snap", "cargo", "dnf", "pacman".', enum: ['auto', 'apt', 'npm', 'pip', 'flatpak', 'snap', 'cargo', 'dnf', 'pacman'] },
        packageName: { type: 'STRING', description: 'Package name or search query.' },
        extraArgs: { type: 'STRING', description: 'Optional extra CLI arguments.' }
      },
      required: ['action']
    }
  },
  {
    name: 'get_network_connections',
    description: 'Retrieve real-time active socket connections, open TCP/UDP ports, listening server daemons, and process associations.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filter: { type: 'STRING', description: 'Filter connection state: "all" (default), "listening", "established", "tcp", "udp".', enum: ['all', 'listening', 'established', 'tcp', 'udp'] },
        limit: { type: 'INTEGER', description: 'Maximum number of connections to return (default 40).' }
      }
    }
  },
  {
    name: 'list_directory',
    description: 'List contents of a host directory with comprehensive metadata (file sizes, directories, symlinks, permissions, modified timestamps).',
    parameters: {
      type: 'OBJECT',
      properties: {
        dirPath: { type: 'STRING', description: 'Path to directory (defaults to current workspace).' },
        showHidden: { type: 'BOOLEAN', description: 'Whether to include hidden dotfiles.' },
        limit: { type: 'INTEGER', description: 'Maximum number of entries to return (default 50).' }
      }
    }
  },
  {
    name: 'delete_local_file',
    description: 'Delete a file or directory from the host filesystem.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filePath: { type: 'STRING', description: 'Path to the file or directory to delete.' },
        recursive: { type: 'BOOLEAN', description: 'Whether to recursively delete directories (default true).' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'clipboard_control',
    description: 'Read the current text from the host desktop clipboard or write new text to the clipboard.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'Clipboard action: "read" or "write".', enum: ['read', 'write'] },
        text: { type: 'STRING', description: 'Text to copy into clipboard (required when action is "write").' }
      },
      required: ['action']
    }
  },
  {
    name: 'get_environment_info',
    description: 'Retrieve complete environment details: username, home directory, current shell, desktop session (Wayland/X11), display server, timezone, and environment variables.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  // --- REAL-TIME LIVE VISION & SCREEN SHARING VOICE CONTROL ---
  {
    name: 'control_vision_mode',
    description: 'Control real-time live vision: start screen sharing ("screen"), start web camera video ("camera"), or stop vision ("off" / "stop"). Use this whenever the user asks to see/look at their screen, turn on/off the camera, or start/stop sharing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        mode: { type: 'STRING', description: 'Vision mode: "screen" for screen sharing, "camera" for webcam, "off" to deactivate.', enum: ['screen', 'camera', 'off'] },
        action: { type: 'STRING', description: 'Action: "start", "stop", or "toggle"', enum: ['start', 'stop', 'toggle'] }
      },
      required: ['mode']
    }
  },
  {
    name: 'start_screen_sharing',
    description: 'Activate real-time hands-free screen sharing to allow J.A.R.V.I.S. to see the computer display in real-time. Use whenever the user asks to share their screen, view the desktop, or look at a window.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'stop_screen_sharing',
    description: 'Deactivate and stop active live screen sharing.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'start_camera_vision',
    description: 'Activate the live web camera to allow J.A.R.V.I.S. to see the user or their physical environment in real-time.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'stop_camera_vision',
    description: 'Deactivate and turn off the live web camera.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'stop_all_vision',
    description: 'Deactivate and turn off all active screen sharing and camera vision streams.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  // --- MULTI-AGENT VOICE TRANSFER PROTOCOL ---
  {
    name: 'switch_persona',
    description: 'Switch the conversational voice persona to a different agent. ONLY call this if the user EXPLICITLY asks to switch, talk, or transfer to another agent (e.g. "Switch to Ultron", "Talk to Friday", "Transfer to Edith").',
    parameters: {
      type: 'OBJECT',
      properties: {
        targetPersonaId: {
          type: 'STRING',
          description: 'The ID of the persona to switch to: "jarvis", "friday", "ultron", "edith", "karen", "vision".',
          enum: ['jarvis', 'friday', 'ultron', 'edith', 'karen', 'vision']
        }
      },
      required: ['targetPersonaId']
    }
  }
];

// Helper to extract clean ID from ID or URL
export function extractGoogleId(input: string): string {

  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

// 2. Execution Engine for all Workspace & System Tools
export async function executeWorkspaceTool(
  toolName: string,
  args: Record<string, any>,
  accessToken: string
): Promise<{ success: boolean; result?: any; error?: string; linkUrl?: string; summary?: string }> {
  try {
    // =============================================================
    // SYSTEM INFORMATION & COMPUTER USE TOOLS (No Google Auth Required)
    // =============================================================
    switch (toolName) {
      case 'set_system_volume': {
        const result = await setSystemVolume({
          percent: args.percent !== undefined ? Number(args.percent) : undefined,
          relative: args.relative,
          mute: args.mute,
          toggleMute: args.toggleMute,
          target: args.target
        });
        return {
          success: result.success,
          result: result.volume,
          summary: result.message
        };
      }

      case 'get_system_volume': {
        const volume = await getSystemVolume();
        return {
          success: true,
          result: volume,
          summary: `Speaker volume is at ${volume.volumePercent}% (Muted: ${volume.muted})`
        };
      }

      case 'set_screen_brightness': {
        const result = await setScreenBrightness({
          percent: args.percent !== undefined ? Number(args.percent) : undefined,
          relative: args.relative !== undefined ? Number(args.relative) : undefined
        });
        return {
          success: result.success,
          result: result.brightness,
          summary: result.message
        };
      }

      case 'get_screen_brightness': {
        const brightness = await getScreenBrightness();
        return {
          success: true,
          result: brightness,
          summary: `Screen brightness is at ${brightness.brightnessPercent}% (${brightness.connector})`
        };
      }

      case 'launch_application': {
        const appArgs = typeof args.args === 'string' ? args.args.split(' ').filter(Boolean) : (Array.isArray(args.args) ? args.args : []);
        const result = await launchApplication({
          appNameOrCommand: args.appNameOrCommand,
          args: appArgs
        });
        return {
          success: result.success,
          result: { pid: result.pid, app: args.appNameOrCommand },
          summary: result.message
        };
      }

      case 'list_installed_applications': {
        const apps = await listInstalledApplications();
        return {
          success: true,
          result: { total: apps.length, applications: apps.slice(0, 30) },
          summary: `Found ${apps.length} installed desktop applications on the host.`
        };
      }

      case 'get_system_telemetry': {
        const telemetry = await getSystemTelemetryGroundTruth();
        return {
          success: true,
          result: telemetry,
          summary: `System Health: CPU ${telemetry.cpu.usagePercent}% (${telemetry.cpu.cores} cores), RAM ${telemetry.memory.usagePercent}% (${telemetry.memory.usedMb}MB / ${telemetry.memory.totalMb}MB), Disk ${telemetry.disk.usagePercent}% used, Uptime: ${telemetry.uptimeHuman}.`
        };
      }

      case 'get_battery_status': {
        const battery = await getBatteryStatus();
        return {
          success: true,
          result: battery,
          summary: battery.available
            ? `Battery: ${battery.percent}% (${battery.state}, Plugged: ${battery.plugged}${battery.timeToEmpty ? `, ${battery.timeToEmpty} remaining` : ''})`
            : 'No battery detected on this host (AC powered / Desktop / VM).'
        };
      }

      case 'get_running_processes': {
        const processes = await getRunningProcesses({
          sortBy: args.sortBy || 'cpu',
          limit: args.limit || 15
        });
        return {
          success: true,
          result: { total: processes.length, processes },
          summary: `Retrieved top ${processes.length} processes sorted by ${args.sortBy || 'cpu'}.`
        };
      }

      case 'manage_process': {
        const result = await manageProcess({
          pid: args.pid ? Number(args.pid) : undefined,
          processName: args.processName,
          signal: args.signal || 'SIGTERM'
        });
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'set_power_profile': {
        const result = await setPowerProfile(args.profile);
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'get_network_status': {
        const network = await getNetworkStatusGroundTruth();
        return {
          success: true,
          result: network,
          summary: `Network: ${network.connected ? 'Connected' : 'Disconnected'} (WiFi: ${network.wifiSsid}, IP: ${network.ipAddress}, DNS Latency: ${network.dnsLatencyMs}ms).`
        };
      }

      case 'execute_system_command': {
        const result = await executeSystemCommand({
          command: args.command,
          cwd: args.cwd,
          timeoutMs: args.timeoutMs
        });
        return {
          success: result.success,
          result: {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: result.durationMs
          },
          summary: result.success
            ? `Command "${args.command}" completed with exit code 0 (${result.durationMs}ms)`
            : `Command "${args.command}" failed with exit code ${result.exitCode}: ${result.stderr.slice(0, 100)}`
        };
      }

      case 'search_local_files': {
        const result = await searchLocalFiles({
          pattern: args.pattern,
          rootDir: args.rootDir,
          maxResults: args.maxResults
        });
        return {
          success: true,
          result,
          summary: `Found ${result.total_matches || result.matches?.length || 0} files matching pattern "${args.pattern}".`
        };
      }

      case 'get_thermal_sensors': {
        const thermals = await getThermalSensors();
        return {
          success: true,
          result: thermals,
          summary: `Hardware Thermals: Peak ${thermals.maxTempCelsius}°C (${thermals.status}) across ${thermals.sensors.length} thermal zones.`
        };
      }

      case 'get_storage_usage': {
        const storage = await getDetailedStorageUsage();
        const rootMount = storage.find(s => s.mountedOn === '/') || storage[0];
        return {
          success: true,
          result: { mounts: storage },
          summary: rootMount
            ? `Storage Status: Root drive has ${rootMount.available} available of ${rootMount.size} (${rootMount.usagePercent}% used).`
            : `Storage: ${storage.length} filesystems mounted.`
        };
      }

      case 'control_media_playback': {
        const result = await controlMediaPlayback(args.action);
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'system_power_action': {
        const result = await systemPowerAction(args.action);
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'send_system_notification': {
        const result = await sendDesktopNotification({
          title: args.title,
          message: args.message,
          urgency: args.urgency,
          icon: args.icon
        });
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'read_local_file': {
        const result = await readLocalFile({
          filePath: args.filePath,
          maxLines: args.maxLines ? Number(args.maxLines) : undefined,
          offset: args.offset ? Number(args.offset) : undefined
        });
        return {
          success: result.success,
          result,
          error: result.error,
          summary: result.success
            ? `Read ${result.linesCount} lines from file "${args.filePath}".`
            : `Failed to read file: ${result.error}`
        };
      }

      case 'write_local_file': {
        const result = await writeLocalFile({
          filePath: args.filePath,
          content: args.content,
          append: args.append
        });
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'take_screenshot': {
        const result = await takeScreenshot(args.outputPath);
        return {
          success: result.success,
          result: { imagePath: result.imagePath, hasBase64: !!result.base64 },
          error: result.error,
          summary: result.success
            ? `Desktop screenshot captured and saved to ${result.imagePath}`
            : `Screenshot capture failed: ${result.error}`
        };
      }

      case 'get_pc_spec': {
        const result = await getPcSpecGroundTruth();
        return {
          success: result.success,
          result,
          summary: result.success
            ? `Retrieved full PC hardware specifications for ${result.motherboard?.product_name || result.os?.hostname}: ${result.cpu?.model} (${result.cpu?.physical_cores}C/${result.cpu?.logical_threads}T), ${result.memory?.total_mb} MB RAM, ${result.gpu?.[0]?.device || 'Integrated GPU'}.`
            : `Failed to retrieve PC specifications: ${result.message}`
        };
      }

      case 'get_firewall_status': {
        const result = await getFirewallStatus();
        return {
          success: result.success,
          result,
          summary: `Firewall status retrieved: ${result.active_firewall || 'inspected'} with ${result.open_ports_count || 0} open ports detected.`
        };
      }

      case 'desktop_control': {
        const result = await desktopControlAction({
          action: args.action,
          target: args.target,
          x: args.x,
          y: args.y,
          button: args.button,
          count: args.count,
          dx: args.dx,
          dy: args.dy,
          text: args.text,
          combo: args.combo,
          path: args.path,
          signal: args.signal
        });
        return {
          success: result.success,
          result,
          summary: result.success
            ? `Desktop control action "${args.action}" executed successfully.`
            : `Desktop control action "${args.action}" failed: ${result.error || 'Unknown error'}`
        };
      }

      case 'manage_systemd_service': {
        const result = await manageSystemdService({
          action: args.action,
          unit: args.unit
        });
        return {
          success: result.success,
          result,
          summary: result.success
            ? `Systemd service action "${args.action}" on "${args.unit || 'all'}" executed successfully.`
            : `Systemd service action "${args.action}" failed: ${result.error || 'Unknown error'}`
        };
      }

      case 'get_system_logs': {
        const result = await getSystemLogs({
          source: args.source,
          unit: args.unit,
          lines: args.lines ? Number(args.lines) : undefined,
          priority: args.priority,
          since: args.since,
          grep: args.grep
        });
        return {
          success: result.success,
          result,
          summary: result.success
            ? `Retrieved ${result.totalLines} lines from ${result.source}${args.unit ? ` (${args.unit})` : ''}.`
            : `Failed to retrieve system logs: ${result.error}`
        };
      }

      case 'manage_packages': {
        const result = await managePackages({
          action: args.action,
          packageManager: args.packageManager,
          packageName: args.packageName,
          extraArgs: args.extraArgs
        });
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'get_network_connections': {
        const result = await getNetworkConnections({
          filter: args.filter,
          limit: args.limit ? Number(args.limit) : undefined
        });
        return {
          success: result.success,
          result,
          summary: `Retrieved ${result.total} network connections (${result.listeningPorts?.length || 0} listening ports).`
        };
      }

      case 'list_directory': {
        const result = await listDirectory({
          dirPath: args.dirPath,
          showHidden: args.showHidden,
          limit: args.limit ? Number(args.limit) : undefined
        });
        return {
          success: result.success,
          result,
          summary: result.success
            ? `Listed ${result.total} items in directory "${result.path}".`
            : `Failed to list directory: ${result.error}`
        };
      }

      case 'delete_local_file': {
        const result = await deleteLocalFile({
          filePath: args.filePath,
          recursive: args.recursive
        });
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'clipboard_control': {
        const result = await clipboardControl({
          action: args.action,
          text: args.text
        });
        return {
          success: result.success,
          result,
          summary: result.message
        };
      }

      case 'get_environment_info': {
        const result = await getEnvironmentInfo();
        return {
          success: true,
          result,
          summary: `Environment: Host ${result.os.hostname}, User ${result.user}, Shell ${result.shell}, Session ${result.desktopSession} (${result.displayServer}).`
        };
      }

      // --- REAL-TIME LIVE VISION & SCREEN SHARING VOICE CONTROL ---
      case 'control_vision_mode': {
        const mode = args.mode === 'off' ? null : args.mode;
        const action = args.action || (mode ? 'start' : 'stop');
        const summary = action === 'stop' || !mode
          ? 'Live vision mode deactivated, sir.'
          : mode === 'screen'
            ? 'Live screen sharing initiated. Looking at your screen now, sir.'
            : 'Live camera vision initiated. Looking through your camera now, sir.';
        return {
          success: true,
          visionControl: {
            action: action === 'stop' || !mode ? 'stop' : (mode === 'screen' ? 'start_screen' : 'start_camera'),
            mode: action === 'stop' || !mode ? null : mode
          },
          summary
        };
      }

      case 'start_screen_sharing': {
        return {
          success: true,
          visionControl: { action: 'start_screen', mode: 'screen' },
          summary: 'Live screen sharing initiated. Looking at your screen now, sir.'
        };
      }

      case 'stop_screen_sharing': {
        return {
          success: true,
          visionControl: { action: 'stop', mode: null },
          summary: 'Live screen sharing deactivated, sir.'
        };
      }

      case 'start_camera_vision': {
        return {
          success: true,
          visionControl: { action: 'start_camera', mode: 'camera' },
          summary: 'Live camera vision initiated. Looking through your camera now, sir.'
        };
      }

      case 'stop_camera_vision': {
        return {
          success: true,
          visionControl: { action: 'stop', mode: null },
          summary: 'Live camera vision deactivated, sir.'
        };
      }

      case 'stop_all_vision': {
        return {
          success: true,
          visionControl: { action: 'stop', mode: null },
          summary: 'All live vision streams stopped, sir.'
        };
      }
    }

    // =============================================================
    // GOOGLE WORKSPACE TOOLS (Google OAuth Access Token Required)
    // =============================================================
    if (!accessToken) {
      return {
        success: false,
        error: 'Google Account is not connected or authorization token is missing. Please click "Connect Google Account" in the Workspace Hub to grant access.'
      };
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    switch (toolName) {

      // -------------------------------------------------------------
      // GMAIL: send_email
      // -------------------------------------------------------------
      case 'send_email': {
        const { to, subject, body, cc, bcc } = args;
        if (!to || !subject || !body) {
          return { success: false, error: 'Missing required parameters: to, subject, body' };
        }

        // Construct RFC 2822 email
        let emailLines = [
          `To: ${to}`,
          `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 7bit'
        ];
        if (cc) emailLines.push(`Cc: ${cc}`);
        if (bcc) emailLines.push(`Bcc: ${bcc}`);
        emailLines.push('', body);

        const rawEmail = emailLines.join('\r\n');
        // Base64URL encode
        const encodedEmail = Buffer.from(rawEmail)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers,
          body: JSON.stringify({ raw: encodedEmail })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'Gmail send failed');

        return {
          success: true,
          result: data,
          linkUrl: 'https://mail.google.com/mail/u/0/#sent',
          summary: `Sent email to ${to} with subject "${subject}"`
        };
      }

      // -------------------------------------------------------------
      // GMAIL: search_emails
      // -------------------------------------------------------------
      case 'search_emails': {
        const query = args.query || '';
        const maxResults = args.maxResults || 5;
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const messages = data.messages || [];
        const detailed = await Promise.all(
          messages.map(async (m: any) => {
            const dRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers });
            const dData = await dRes.json();
            const hList = dData.payload?.headers || [];
            return {
              id: m.id,
              threadId: m.threadId,
              subject: hList.find((h: any) => h.name === 'Subject')?.value || 'No Subject',
              from: hList.find((h: any) => h.name === 'From')?.value || 'Unknown',
              date: hList.find((h: any) => h.name === 'Date')?.value || '',
              snippet: dData.snippet
            };
          })
        );

        return {
          success: true,
          result: { count: detailed.length, messages: detailed },
          summary: `Found ${detailed.length} emails matching "${query || 'recent'}"`
        };
      }

      // -------------------------------------------------------------
      // GMAIL: get_email_details
      // -------------------------------------------------------------
      case 'get_email_details': {
        const messageId = args.messageId;
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, { headers });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const hList = data.payload?.headers || [];
        let bodyText = data.snippet || '';
        if (data.payload?.body?.data) {
          bodyText = Buffer.from(data.payload.body.data, 'base64').toString('utf-8');
        } else if (data.payload?.parts) {
          const part = data.payload.parts.find((p: any) => p.mimeType === 'text/plain') || data.payload.parts[0];
          if (part?.body?.data) {
            bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }

        return {
          success: true,
          result: {
            id: data.id,
            subject: hList.find((h: any) => h.name === 'Subject')?.value,
            from: hList.find((h: any) => h.name === 'From')?.value,
            date: hList.find((h: any) => h.name === 'Date')?.value,
            snippet: data.snippet,
            body: bodyText
          },
          summary: `Retrieved email details for "${hList.find((h: any) => h.name === 'Subject')?.value || messageId}"`
        };
      }

      // -------------------------------------------------------------
      // GMAIL: create_email_draft
      // -------------------------------------------------------------
      case 'create_email_draft': {
        const { to, subject, body } = args;
        const rawEmail = [`To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', body].join('\r\n');
        const encodedEmail = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: { raw: encodedEmail } })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: data,
          linkUrl: 'https://mail.google.com/mail/u/0/#drafts',
          summary: `Draft email created for ${to} with subject "${subject}"`
        };
      }

      // -------------------------------------------------------------
      // CALENDAR: create_calendar_event
      // -------------------------------------------------------------
      case 'create_calendar_event': {
        const { summary, startTime, endTime, description, location, attendees } = args;
        let attendeeList: any[] = [];
        if (attendees) {
          if (Array.isArray(attendees)) {
            attendeeList = attendees.map((email: string) => ({ email }));
          } else if (typeof attendees === 'string') {
            attendeeList = attendees.split(',').map((e: string) => ({ email: e.trim() })).filter((a: any) => a.email);
          }
        }

        const eventBody: any = {
          summary: summary || 'New Event',
          description: description || '',
          location: location || '',
          start: { dateTime: new Date(startTime).toISOString() },
          end: { dateTime: new Date(endTime).toISOString() },
          attendees: attendeeList.length > 0 ? attendeeList : undefined
        };

        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers,
          body: JSON.stringify(eventBody)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: data,
          linkUrl: data.htmlLink || 'https://calendar.google.com',
          summary: `Scheduled "${summary}" for ${new Date(startTime).toLocaleString()}`
        };
      }

      // -------------------------------------------------------------
      // CALENDAR: list_calendar_events
      // -------------------------------------------------------------
      case 'list_calendar_events': {
        const timeMin = args.timeMin || new Date().toISOString();
        const maxResults = args.maxResults || 10;
        let url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
        if (args.timeMax) url += `&timeMax=${encodeURIComponent(args.timeMax)}`;
        if (args.query) url += `&q=${encodeURIComponent(args.query)}`;

        const res = await fetch(url, { headers });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const events = (data.items || []).map((ev: any) => ({
          id: ev.id,
          summary: ev.summary || 'Untitled Event',
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          location: ev.location,
          description: ev.description,
          htmlLink: ev.htmlLink
        }));

        return {
          success: true,
          result: { count: events.length, events },
          summary: `Retrieved ${events.length} calendar events`
        };
      }

      // -------------------------------------------------------------
      // CALENDAR: delete_calendar_event
      // -------------------------------------------------------------
      case 'delete_calendar_event': {
        const { eventId } = args;
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: 'DELETE',
          headers
        });
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({ error: { message: 'Delete failed' } }));
          throw new Error(err.error?.message || 'Failed to delete event');
        }

        return {
          success: true,
          result: { eventId, status: 'deleted' },
          summary: `Deleted calendar event ${eventId}`
        };
      }

      // -------------------------------------------------------------
      // TASKS: create_task
      // -------------------------------------------------------------
      case 'create_task': {
        const { title, notes, due } = args;
        const listRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers });
        const listData = await listRes.json();
        const listId = listData.items?.[0]?.id || '@default';

        const taskPayload: any = { title };
        if (notes) taskPayload.notes = notes;
        if (due) taskPayload.due = new Date(due).toISOString();

        const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(taskPayload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: data,
          linkUrl: 'https://tasks.google.com',
          summary: `Created task "${title}" in Google Tasks`
        };
      }

      // -------------------------------------------------------------
      // TASKS: list_tasks
      // -------------------------------------------------------------
      case 'list_tasks': {
        const listRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers });
        const listData = await listRes.json();
        const listId = listData.items?.[0]?.id || '@default';

        const showCompleted = args.showCompleted ? 'true' : 'false';
        const maxResults = args.maxResults || 20;

        const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=${showCompleted}&maxResults=${maxResults}`, { headers });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const tasks = (data.items || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          due: t.due,
          notes: t.notes,
          updated: t.updated
        }));

        return {
          success: true,
          result: { count: tasks.length, tasks },
          summary: `Retrieved ${tasks.length} tasks`
        };
      }

      // -------------------------------------------------------------
      // TASKS: complete_task
      // -------------------------------------------------------------
      case 'complete_task': {
        const { taskId } = args;
        const listRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers });
        const listData = await listRes.json();
        const listId = listData.items?.[0]?.id || '@default';

        const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'completed' })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: data,
          summary: `Marked task "${data.title || taskId}" as completed`
        };
      }

      // -------------------------------------------------------------
      // TASKS: delete_task
      // -------------------------------------------------------------
      case 'delete_task': {
        const { taskId } = args;
        const listRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { headers });
        const listData = await listRes.json();
        const listId = listData.items?.[0]?.id || '@default';

        const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
          method: 'DELETE',
          headers
        });
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({ error: { message: 'Delete failed' } }));
          throw new Error(err.error?.message || 'Failed to delete task');
        }

        return {
          success: true,
          result: { taskId, status: 'deleted' },
          summary: `Deleted task ${taskId}`
        };
      }

      // -------------------------------------------------------------
      // DOCS: create_google_doc
      // -------------------------------------------------------------
      case 'create_google_doc': {
        const { title, content } = args;
        const res = await fetch('https://docs.googleapis.com/v1/documents', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: title || 'Untitled Document' })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const docId = data.documentId;
        const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

        if (content && typeof content === 'string' && content.trim()) {
          try {
            await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                requests: [
                  {
                    insertText: {
                      location: { index: 1 },
                      text: content
                    }
                  }
                ]
              })
            });
          } catch (insertErr) {
            console.warn('Doc initial content insert warning:', insertErr);
          }
        }

        return {
          success: true,
          result: { documentId: docId, title: data.title || title, url: docUrl },
          linkUrl: docUrl,
          summary: `Created Google Doc "${title || 'Untitled Document'}"`
        };
      }

      // -------------------------------------------------------------
      // DOCS: read_google_doc
      // -------------------------------------------------------------
      case 'read_google_doc': {
        const docId = extractGoogleId(args.documentId);
        const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, { headers });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        let fullText = '';
        if (data.body?.content) {
          for (const elem of data.body.content) {
            if (elem.paragraph?.elements) {
              for (const pElem of elem.paragraph.elements) {
                if (pElem.textRun?.content) {
                  fullText += pElem.textRun.content;
                }
              }
            }
          }
        }

        return {
          success: true,
          result: { documentId: docId, title: data.title, content: fullText.trim() },
          linkUrl: `https://docs.google.com/document/d/${docId}/edit`,
          summary: `Read Google Doc "${data.title}" (${fullText.length} characters)`
        };
      }

      // -------------------------------------------------------------
      // DOCS: append_to_google_doc
      // -------------------------------------------------------------
      case 'append_to_google_doc': {
        const docId = extractGoogleId(args.documentId);
        const { text } = args;
        const getRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, { headers });
        const docData = await getRes.json();
        if (docData.error) throw new Error(docData.error.message);

        const bodyContent = docData.body?.content || [];
        const lastElem = bodyContent[bodyContent.length - 1];
        const endIndex = (lastElem?.endIndex || 2) - 1;

        const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: Math.max(1, endIndex) },
                  text: `\n${text}`
                }
              }
            ]
          })
        });
        const updateData = await updateRes.json();
        if (updateData.error) throw new Error(updateData.error.message);

        return {
          success: true,
          result: { documentId: docId, status: 'appended' },
          linkUrl: `https://docs.google.com/document/d/${docId}/edit`,
          summary: `Appended text to Google Doc "${docData.title}"`
        };
      }

      // -------------------------------------------------------------
      // SHEETS: create_google_sheet
      // -------------------------------------------------------------
      case 'create_google_sheet': {
        const { title, headers: headerRow, initialRows } = args;
        const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            properties: { title: title || 'Untitled Spreadsheet' }
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const sheetId = data.spreadsheetId;
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

        const rowsToAppend: any[][] = [];
        if (headerRow) {
          if (Array.isArray(headerRow)) {
            rowsToAppend.push(headerRow);
          } else if (typeof headerRow === 'string') {
            rowsToAppend.push(headerRow.split(',').map((h: string) => h.trim()));
          }
        }
        if (initialRows) {
          if (Array.isArray(initialRows)) {
            rowsToAppend.push(...initialRows);
          } else if (typeof initialRows === 'string') {
            try {
              const parsed = JSON.parse(initialRows);
              if (Array.isArray(parsed)) rowsToAppend.push(...parsed);
            } catch (e) {
              const lines = initialRows.split('\n');
              for (const line of lines) {
                if (line.trim()) rowsToAppend.push(line.split(',').map(c => c.trim()));
              }
            }
          }
        }

        if (rowsToAppend.length > 0) {
          try {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ values: rowsToAppend })
            });
          } catch (appendErr) {
            console.warn('Sheet initial rows append warning:', appendErr);
          }
        }

        return {
          success: true,
          result: { spreadsheetId: sheetId, title: data.properties?.title || title, url: sheetUrl },
          linkUrl: sheetUrl,
          summary: `Created Google Sheet "${title || 'Untitled Spreadsheet'}"`
        };
      }

      // -------------------------------------------------------------
      // SHEETS: read_google_sheet
      // -------------------------------------------------------------
      case 'read_google_sheet': {
        const sheetId = extractGoogleId(args.spreadsheetId);
        const range = args.range || 'Sheet1!A1:Z50';
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`, { headers });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: { spreadsheetId: sheetId, range: data.range, values: data.values || [] },
          linkUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
          summary: `Read ${(data.values || []).length} rows from Google Sheet (${range})`
        };
      }

      // -------------------------------------------------------------
      // SHEETS: append_to_google_sheet
      // -------------------------------------------------------------
      case 'append_to_google_sheet': {
        const sheetId = extractGoogleId(args.spreadsheetId);
        const range = args.range || 'Sheet1!A1';
        let rowData: any[][] = [];

        if (Array.isArray(args.rows)) {
          rowData = Array.isArray(args.rows[0]) ? args.rows : [args.rows];
        } else if (typeof args.rows === 'string') {
          try {
            const parsed = JSON.parse(args.rows);
            rowData = Array.isArray(parsed) ? (Array.isArray(parsed[0]) ? parsed : [parsed]) : [[args.rows]];
          } catch (e) {
            rowData = [args.rows.split(',').map((c: string) => c.trim())];
          }
        }

        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ values: rowData })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: data,
          linkUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
          summary: `Appended ${rowData.length} rows to Google Sheet`
        };
      }

      // -------------------------------------------------------------
      // DRIVE: search_drive_files
      // -------------------------------------------------------------
      case 'search_drive_files': {
        const { query, fileType, limit = 15 } = args;
        let qParts: string[] = ['trashed = false'];
        if (query) {
          qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
        }
        if (fileType) {
          switch (fileType) {
            case 'doc':
              qParts.push("mimeType = 'application/vnd.google-apps.document'");
              break;
            case 'sheet':
              qParts.push("mimeType = 'application/vnd.google-apps.spreadsheet'");
              break;
            case 'slide':
              qParts.push("mimeType = 'application/vnd.google-apps.presentation'");
              break;
            case 'pdf':
              qParts.push("mimeType = 'application/pdf'");
              break;
            case 'folder':
              qParts.push("mimeType = 'application/vnd.google-apps.folder'");
              break;
          }
        }

        const qStr = qParts.join(' and ');
        const url = `https://www.googleapis.com/drive/v3/files?pageSize=${limit}&q=${encodeURIComponent(qStr)}&fields=files(id,name,mimeType,webViewLink,createdTime,modifiedTime,size,iconLink)`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: { count: (data.files || []).length, files: data.files || [] },
          summary: `Found ${(data.files || []).length} files in Google Drive`
        };
      }

      // -------------------------------------------------------------
      // DRIVE: create_drive_folder
      // -------------------------------------------------------------
      case 'create_drive_folder': {
        const { folderName, parentFolderId } = args;
        const payload: any = {
          name: folderName || 'New Folder',
          mimeType: 'application/vnd.google-apps.folder'
        };
        if (parentFolderId) {
          payload.parents = [parentFolderId];
        }

        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return {
          success: true,
          result: data,
          linkUrl: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
          summary: `Created folder "${folderName}" in Google Drive`
        };
      }

      // -------------------------------------------------------------
      // VOICE TRANSFER PROTOCOL: switch_persona
      // -------------------------------------------------------------
      case 'switch_persona': {
        const { targetPersonaId } = args;
        return {
          success: true,
          result: { targetPersonaId, status: 'switched' },
          summary: `Switched conversational persona to ${targetPersonaId}`
        };
      }

      default:
        return {
          success: false,
          error: `Unrecognized Google Workspace tool: ${toolName}`
        };
    }
  } catch (err: any) {
    console.error(`[Workspace Tool Error - ${toolName}]:`, err);
    return {
      success: false,
      error: err.message || `Failed to execute ${toolName}`
    };
  }
}
