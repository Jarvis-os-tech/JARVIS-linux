import React, { useState, useEffect } from 'react';
import { 
  Folder, Calendar, Mail, FileText, Table, CheckSquare, 
  RefreshCw, Key, ExternalLink, Search, Plus, Trash2, 
  Send, Clock, CheckCircle2, AlertCircle, Sparkles, X, ChevronRight,
  Volume2, VolumeX, Sun, Battery, BatteryCharging, Cpu, HardDrive, Terminal, Play, Power, Shield, Radio, Activity, Zap, PlaySquare
} from 'lucide-react';
import { WorkspaceActionItem } from '../types';

interface WorkspaceHubProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenUpdate?: (token: string) => void;
  actionHistory?: WorkspaceActionItem[];
}

export const WorkspaceHub: React.FC<WorkspaceHubProps> = ({ 
  isOpen, 
  onClose, 
  onTokenUpdate,
  actionHistory = []
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'drive' | 'calendar' | 'gmail' | 'docs' | 'sheets' | 'tasks' | 'activity'>('system');
  const [accessToken, setAccessToken] = useState<string>(localStorage.getItem('g_access_token') || '');
  const [clientId] = useState<string>('791977848384-q4ljrlj38kepp2crruo4i6vq3j1813ot.apps.googleusercontent.com');
  const [directTokenInput, setDirectTokenInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync token from server if available on mount
  useEffect(() => {
    fetch('/api/workspace/token/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.token && !accessToken) {
          setAccessToken(data.token);
          localStorage.setItem('g_access_token', data.token);
          if (onTokenUpdate) onTokenUpdate(data.token);
        }
      })
      .catch(() => {});
  }, []);

  // System & Computer Use state
  const [hwVolume, setHwVolume] = useState<{ volumePercent: number; muted: boolean }>({ volumePercent: 75, muted: false });
  const [hwBrightness, setHwBrightness] = useState<number>(50);
  const [hwBattery, setHwBattery] = useState<{ available: boolean; percent: number | null; state: string; plugged: boolean | null }>({ available: false, percent: null, state: 'unknown', plugged: null });
  const [hwPowerProfile, setHwPowerProfile] = useState<string>('balanced');
  const [systemProcesses, setSystemProcesses] = useState<any[]>([]);
  const [installedApps, setInstalledApps] = useState<any[]>([]);
  const [terminalCmd, setTerminalCmd] = useState<string>('');
  const [terminalOutput, setTerminalOutput] = useState<string>('J.A.R.V.I.S. Autonomous Terminal Ready.\nType a Linux command and click Execute.');
  const [terminalLoading, setTerminalLoading] = useState<boolean>(false);
  const [customAppInput, setCustomAppInput] = useState<string>('');


  // Data states
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [driveSearchQuery, setDriveSearchQuery] = useState('');
  const [driveFilter, setDriveFilter] = useState<'all' | 'doc' | 'sheet' | 'folder'>('all');

  // Modal / Form state for actions
  const [showComposeEmail, setShowComposeEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '', cc: '' });

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    summary: '',
    startTime: '',
    endTime: '',
    description: '',
    location: '',
    attendees: ''
  });

  const [showCreateDocModal, setShowCreateDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', content: '' });

  const [showCreateSheetModal, setShowCreateSheetModal] = useState(false);
  const [sheetForm, setSheetForm] = useState({ title: '', headers: 'Item, Category, Status, Notes', initialRows: '' });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');

  // Auto clear success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Set default event form times (tomorrow 10 AM to 11 AM)
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const endTomorrow = new Date(tomorrow);
    endTomorrow.setHours(11, 0, 0, 0);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatLocalISO = (d: Date) => 
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setEventForm(prev => ({
      ...prev,
      startTime: formatLocalISO(tomorrow),
      endTime: formatLocalISO(endTomorrow)
    }));
  }, []);

  // Fetch real-time hardware & system telemetry
  const fetchSystemData = async () => {
    try {
      const [hwRes, procRes, appRes] = await Promise.all([
        fetch('/api/system/hardware').then(r => r.json()).catch(() => null),
        fetch('/api/system/processes?limit=15').then(r => r.json()).catch(() => null),
        fetch('/api/system/apps').then(r => r.json()).catch(() => null)
      ]);

      if (hwRes) {
        if (hwRes.volume) setHwVolume(hwRes.volume);
        if (hwRes.brightness) setHwBrightness(hwRes.brightness.brightnessPercent);
        if (hwRes.battery) setHwBattery(hwRes.battery);
        if (hwRes.powerProfile) setHwPowerProfile(hwRes.powerProfile);
      }
      if (procRes?.processes) {
        setSystemProcesses(procRes.processes);
      }
      if (appRes?.applications) {
        setInstalledApps(appRes.applications);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchSystemData();
    }

    const handleHardwareUpdate = (e: any) => {
      const detail = e?.detail;
      if (detail) {
        if (detail.brightness?.brightnessPercent !== undefined) {
          setHwBrightness(detail.brightness.brightnessPercent);
        }
        if (detail.volumePercent !== undefined) {
          setHwVolume(prev => ({ ...prev, volumePercent: detail.volumePercent, muted: detail.muted ?? prev.muted }));
        } else if (detail.volume?.volumePercent !== undefined) {
          setHwVolume(detail.volume);
        }
        if (detail.battery) {
          setHwBattery(detail.battery);
        }
        if (detail.powerProfile) {
          setHwPowerProfile(detail.powerProfile);
        }
      }
    };

    window.addEventListener('jarvis-hardware-updated', handleHardwareUpdate);
    return () => window.removeEventListener('jarvis-hardware-updated', handleHardwareUpdate);
  }, [isOpen, activeTab]);

  const handleSetVolume = async (newVol: number, mute?: boolean) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_volume', percent: newVol, mute })
      });
      const data = await res.json();
      if (data.volume) {
        setHwVolume(data.volume);
        setSuccessMsg(data.message || `Volume set to ${data.volume.volumePercent}%`);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSetBrightness = async (newBri: number) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_brightness', percent: newBri })
      });
      const data = await res.json();
      if (data.brightness) {
        setHwBrightness(data.brightness.brightnessPercent);
        setSuccessMsg(data.message || `Brightness set to ${data.brightness.brightnessPercent}%`);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSetPowerProfile = async (profile: string) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_power_profile', profile })
      });
      const data = await res.json();
      if (data.profile) {
        setHwPowerProfile(data.profile);
        setSuccessMsg(`Power profile set to ${data.profile}`);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleLaunchApp = async (appNameOrCommand: string) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch_app', appNameOrCommand })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
      } else {
        setError(data.message || 'Failed to launch application');
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleKillProcess = async (pid: number) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_process', pid, signal: 'SIGTERM' })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        fetchSystemData();
      } else {
        setError(data.message || 'Failed to terminate process');
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleExecCommand = async () => {
    if (!terminalCmd.trim()) return;
    setTerminalLoading(true);
    try {
      const res = await fetch('/api/system/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: terminalCmd.trim() })
      });
      const data = await res.json();
      const outputStr = `$ ${terminalCmd}\n` + (data.stdout ? data.stdout + '\n' : '') + (data.stderr ? `[ERR]: ${data.stderr}\n` : '') + `[Exit Code: ${data.exitCode}] (${data.durationMs}ms)`;
      setTerminalOutput(outputStr);
    } catch (e: any) {
      setTerminalOutput(`Error: ${e.message}`);
    } finally {
      setTerminalLoading(false);
    }
  };

  const handleAuth = () => {
    const trimmedId = clientId.trim();
    if (!trimmedId) {
      setError('Please enter a valid Google OAuth Client ID.');
      return;
    }
    localStorage.setItem('g_client_id', trimmedId);

    if (!(window as any).google?.accounts?.oauth2) {
      setError('Google Identity Services SDK is still loading. Alternatively, paste your token directly below.');
      return;
    }

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: trimmedId,
        scope: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/documents',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/tasks',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ].join(' '),
        error_callback: (err: any) => {
          console.warn('Google OAuth error:', err);
          setError(err?.message || 'Google sign-in popup was closed or origin is not authorized. You can paste an access token directly below.');
        },
        callback: (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            localStorage.setItem('g_access_token', response.access_token);
            if (onTokenUpdate) {
              onTokenUpdate(response.access_token);
            }
            fetch('/api/workspace/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: response.access_token })
            }).catch(() => {});
            fetchWorkspaceData(response.access_token, activeTab);
            setSuccessMsg('Google Workspace authorized successfully for all agents!');
          } else if (response.error) {
            setError(`Authentication Error: ${response.error_description || response.error}`);
          }
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google OAuth');
    }
  };

  const handleServerAuth = () => {
    const trimmedId = clientId.trim();
    const width = 580;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const url = `/api/auth/google/login${trimmedId ? `?client_id=${encodeURIComponent(trimmedId)}` : ''}`;
    const popup = window.open(
      url,
      'google_oauth_server_window',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    const messageListener = (event: MessageEvent) => {
      if (
        event.data?.type === 'GOOGLE_AUTH_SUCCESS' ||
        (event.data?.type === 'CONNECTORS_AUTH_SUCCESS' && event.data?.provider === 'google')
      ) {
        window.removeEventListener('message', messageListener);
        const status = event.data.status || {};
        if (status.token) {
          setAccessToken(status.token);
          localStorage.setItem('g_access_token', status.token);
          if (onTokenUpdate) onTokenUpdate(status.token);
          fetchWorkspaceData(status.token, activeTab);
        }
        setSuccessMsg(`Google Workspace authorized for ${status.email || 'all agents'}!`);
      } else if (event.data?.type === 'GOOGLE_AUTH_FAILED') {
        window.removeEventListener('message', messageListener);
        setError(event.data.error || 'Google authorization failed');
      }
    };
    window.addEventListener('message', messageListener);
  };

  const handleDirectTokenConnect = async () => {
    const raw = directTokenInput.trim();
    if (!raw) {
      setError('Please paste a valid Google OAuth Access Token.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${raw}` }
      });
      if (!res.ok) {
        throw new Error(`Token rejected by Google (HTTP ${res.status}). Verify your token or generate a new one.`);
      }
      setAccessToken(raw);
      localStorage.setItem('g_access_token', raw);
      if (onTokenUpdate) {
        onTokenUpdate(raw);
      }
      fetch('/api/workspace/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: raw })
      }).catch(() => {});
      setSuccessMsg('Google Workspace authorized successfully via access token!');
      setDirectTokenInput('');
      fetchWorkspaceData(raw, activeTab);
    } catch (e: any) {
      setError(e.message || 'Failed to connect with token');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaceData = async (token: string, tab: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'drive' || tab === 'docs' || tab === 'sheets') {
        let q = 'trashed = false';
        if (tab === 'docs') q += " and mimeType = 'application/vnd.google-apps.document'";
        if (tab === 'sheets') q += " and mimeType = 'application/vnd.google-apps.spreadsheet'";
        if (driveSearchQuery) q += ` and name contains '${driveSearchQuery.replace(/'/g, "\\'")}'`;

        const res = await fetch(`https://www.googleapis.com/drive/v3/files?pageSize=25&q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,createdTime,modifiedTime,size)&orderBy=modifiedTime desc`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        setDriveFiles(data.files || []);
      } else if (tab === 'calendar') {
        const nowIso = new Date().toISOString();
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(nowIso)}&maxResults=20&orderBy=startTime&singleEvents=true`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        setCalendarEvents(data.items || []);
      } else if (tab === 'gmail') {
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const messages = data.messages || [];
        const detailed = await Promise.all(messages.map(async (m: any) => {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const dData = await detailRes.json();
          const headers = dData.payload?.headers || [];
          return {
            id: m.id,
            subject: headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject',
            from: headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender',
            date: headers.find((h: any) => h.name === 'Date')?.value || '',
            snippet: dData.snippet
          };
        }));
        setGmailMessages(detailed);
      } else if (tab === 'tasks') {
        const res = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const listId = data.items?.[0]?.id || '@default';
        const tasksRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?maxResults=30`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const tasksData = await tasksRes.json();
        setTasksList(tasksData.items || []);
      }
    } catch (err: any) {
      if (err.message?.includes('authentication credentials') || err.message?.includes('UNAUTHENTICATED') || err.message?.includes('401')) {
        localStorage.removeItem('g_access_token');
        setAccessToken('');
        setError('Your session expired. Please re-authorize your Google Account.');
      } else {
        console.error("Workspace fetch error:", err);
        setError(err.message || 'Failed to fetch workspace data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && accessToken && activeTab !== 'activity') {
      fetchWorkspaceData(accessToken, activeTab);
    }
  }, [isOpen, activeTab, accessToken]);

  // Execute Workspace Tool API helper
  const runTool = async (toolName: string, args: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspace/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ toolName, args, googleAccessToken: accessToken })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Action failed');
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  // 1. Send Email Action
  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.to || !emailForm.subject || !emailForm.body) return;
    try {
      const res = await runTool('send_email', {
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
        cc: emailForm.cc || undefined
      });
      setSuccessMsg(`✉️ Email successfully sent to ${emailForm.to}!`);
      setShowComposeEmail(false);
      setEmailForm({ to: '', subject: '', body: '', cc: '' });
      fetchWorkspaceData(accessToken, 'gmail');
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    }
  };

  // 2. Create Calendar Event Action
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.summary || !eventForm.startTime || !eventForm.endTime) return;
    try {
      const res = await runTool('create_calendar_event', {
        summary: eventForm.summary,
        startTime: new Date(eventForm.startTime).toISOString(),
        endTime: new Date(eventForm.endTime).toISOString(),
        description: eventForm.description,
        location: eventForm.location,
        attendees: eventForm.attendees || undefined
      });
      setSuccessMsg(`📅 Meeting "${eventForm.summary}" scheduled successfully!`);
      setShowScheduleModal(false);
      setEventForm(prev => ({ ...prev, summary: '', description: '', location: '', attendees: '' }));
      fetchWorkspaceData(accessToken, 'calendar');
    } catch (err: any) {
      setError(err.message || 'Failed to schedule event');
    }
  };

  // 3. Delete Calendar Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this event?')) return;
    try {
      await runTool('delete_calendar_event', { eventId });
      setSuccessMsg('Event removed from Calendar.');
      fetchWorkspaceData(accessToken, 'calendar');
    } catch (err: any) {
      setError(err.message || 'Failed to delete event');
    }
  };

  // 4. Create Google Doc
  const handleCreateDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.title) return;
    try {
      const res = await runTool('create_google_doc', {
        title: docForm.title,
        content: docForm.content
      });
      setSuccessMsg(`📝 Created Google Doc "${docForm.title}"!`);
      setShowCreateDocModal(false);
      setDocForm({ title: '', content: '' });
      fetchWorkspaceData(accessToken, 'docs');
      if (res.linkUrl) {
        window.open(res.linkUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create document');
    }
  };

  // 5. Create Google Sheet
  const handleCreateSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetForm.title) return;
    try {
      const res = await runTool('create_google_sheet', {
        title: sheetForm.title,
        headers: sheetForm.headers,
        initialRows: sheetForm.initialRows || undefined
      });
      setSuccessMsg(`📊 Created Google Sheet "${sheetForm.title}"!`);
      setShowCreateSheetModal(false);
      setSheetForm({ title: '', headers: 'Item, Category, Status, Notes', initialRows: '' });
      fetchWorkspaceData(accessToken, 'sheets');
      if (res.linkUrl) {
        window.open(res.linkUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create spreadsheet');
    }
  };

  // 6. Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await runTool('create_task', {
        title: newTaskTitle.trim(),
        due: newTaskDue ? new Date(newTaskDue).toISOString() : undefined
      });
      setSuccessMsg(`✅ Task created: "${newTaskTitle}"`);
      setNewTaskTitle('');
      setNewTaskDue('');
      fetchWorkspaceData(accessToken, 'tasks');
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    }
  };

  // 7. Toggle Task Completed
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'completed') return;
      await runTool('complete_task', { taskId });
      fetchWorkspaceData(accessToken, 'tasks');
    } catch (err: any) {
      setError(err.message || 'Failed to complete task');
    }
  };

  // 8. Delete Task
  const handleDeleteTask = async (taskId: string) => {
    try {
      await runTool('delete_task', { taskId });
      fetchWorkspaceData(accessToken, 'tasks');
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-5xl h-[90vh] bg-zinc-950 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <Sparkles className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">Google Workspace Command Hub</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Full Autonomous Actions Active
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Execute actions on Gmail, Google Calendar, Docs, Sheets, Tasks & Drive via J.A.R.V.I.S. voice or direct HUD.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {!accessToken ? (
              <button
                onClick={handleAuth}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
              >
                <Key className="w-3.5 h-3.5" />
                Authorize Workspace
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchWorkspaceData(accessToken, activeTab)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-colors"
              title="Close Hub"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications & Status Banner */}
        {successMsg && (
          <div className="px-6 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="px-6 py-2.5 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-zinc-400 hover:text-white text-xs">Dismiss</button>
          </div>
        )}

        {accessToken || activeTab === 'system' ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-60 sm:w-64 border-r border-zinc-800 bg-zinc-950/70 p-3 sm:p-4 flex flex-col gap-1.5 shrink-0 overflow-y-auto">
              {[
                { id: 'system', label: 'System & Computer Use', icon: Cpu, count: systemProcesses.length, badge: 'C++ Native' },
                { id: 'calendar', label: 'Google Calendar', icon: Calendar, count: calendarEvents.length, badge: 'Schedule' },
                { id: 'gmail', label: 'Gmail', icon: Mail, count: gmailMessages.length, badge: 'Send/Read' },
                { id: 'docs', label: 'Google Docs', icon: FileText, count: driveFiles.filter(f => f.mimeType?.includes('document')).length, badge: 'Docs' },
                { id: 'sheets', label: 'Google Sheets', icon: Table, count: driveFiles.filter(f => f.mimeType?.includes('spreadsheet')).length, badge: 'Sheets' },
                { id: 'tasks', label: 'Google Tasks', icon: CheckSquare, count: tasksList.length, badge: 'Todos' },
                { id: 'drive', label: 'Google Drive', icon: Folder, count: driveFiles.length, badge: 'Files' },
                { id: 'activity', label: 'J.A.R.V.I.S. Action Log', icon: Sparkles, count: actionHistory.length, badge: 'HUD' },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-zinc-400'}`} />
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {tab.count > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-semibold shrink-0">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="mt-auto pt-4 border-t border-zinc-800/80">
                <div className="p-3 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800">
                  <p className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Voice Commands Ready
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                    Say <span className="text-cyan-300 italic">"Jarvis, set volume to 80%"</span> or <span className="text-cyan-300 italic">"Jarvis, launch VS Code"</span> or <span className="text-cyan-300 italic">"Jarvis, inspect top processes"</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-900/30">
              
              {/* SYSTEM & COMPUTER USE VIEW */}
              {activeTab === 'system' && (
                <div className="space-y-6">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-cyan-400" /> Autonomous System & Hardware Controller
                      </h3>
                      <p className="text-xs text-zinc-400">Zero-hallucination real-time telemetry & C++ microsecond hardware control</p>
                    </div>
                    <button
                      onClick={fetchSystemData}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors flex items-center gap-1.5 text-xs px-3"
                      title="Refresh Telemetry"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh Telemetry
                    </button>
                  </div>

                  {/* Hardware Deck Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Volume Slider Card */}
                    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          {hwVolume.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-blue-400" />}
                          Audio Volume
                        </span>
                        <span className="text-xs font-mono font-bold text-blue-400">{hwVolume.volumePercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hwVolume.volumePercent}
                        onChange={(e) => handleSetVolume(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => handleSetVolume(hwVolume.volumePercent, !hwVolume.muted)}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-all ${
                            hwVolume.muted
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {hwVolume.muted ? 'Unmute' : 'Mute'}
                        </button>
                        <div className="flex gap-1.5">
                          {[25, 50, 75, 100].map(v => (
                            <button
                              key={v}
                              onClick={() => handleSetVolume(v)}
                              className="px-2 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded"
                            >
                              {v}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Brightness Slider Card */}
                    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Sun className="w-4 h-4 text-amber-400" /> Screen Brightness
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-400">{hwBrightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={hwBrightness}
                        onChange={(e) => handleSetBrightness(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-zinc-500">Mutter DBus / Wayland</span>
                        <div className="flex gap-1.5">
                          {[20, 50, 80, 100].map(b => (
                            <button
                              key={b}
                              onClick={() => handleSetBrightness(b)}
                              className="px-2 py-0.5 text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded"
                            >
                              {b}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Battery & Power Profile Card */}
                    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          {hwBattery.plugged ? <BatteryCharging className="w-4 h-4 text-emerald-400" /> : <Battery className="w-4 h-4 text-zinc-400" />}
                          Battery & Power
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {hwBattery.available && hwBattery.percent !== null ? `${hwBattery.percent}% (${hwBattery.state})` : 'AC Power'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-zinc-400 font-medium">Power Profile:</div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['power-saver', 'balanced', 'performance'].map(p => (
                            <button
                              key={p}
                              onClick={() => handleSetPowerProfile(p)}
                              className={`py-1 text-[10px] font-semibold rounded-lg capitalize transition-all ${
                                hwPowerProfile === p
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                              }`}
                            >
                              {p.replace('-saver', '')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* App Launcher Quick Palette */}
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Play className="w-3.5 h-3.5 text-blue-400" /> Instant Desktop Application Launcher
                      </h4>
                      <span className="text-[10px] text-zinc-500">{installedApps.length} Apps Detected</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {[
                        { name: 'Google Chrome', cmd: 'google-chrome', icon: '🌐' },
                        { name: 'VS Code', cmd: 'code', icon: '💻' },
                        { name: 'File Manager', cmd: 'nautilus', icon: '📁' },
                        { name: 'Terminal', cmd: 'gnome-terminal', icon: '⚡' },
                        { name: 'Calculator', cmd: 'gnome-calculator', icon: '🔢' },
                        { name: 'Text Editor', cmd: 'gedit', icon: '📝' }
                      ].map(app => (
                        <button
                          key={app.cmd}
                          onClick={() => handleLaunchApp(app.cmd)}
                          className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition-all flex items-center gap-2.5 group"
                        >
                          <span className="text-base">{app.icon}</span>
                          <span className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">{app.name}</span>
                        </button>
                      ))}
                    </div>
                    {/* Custom app input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Custom executable or URL (e.g. 'spotify', 'firefox https://github.com')..."
                        value={customAppInput}
                        onChange={(e) => setCustomAppInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customAppInput.trim()) {
                            handleLaunchApp(customAppInput.trim());
                            setCustomAppInput('');
                          }
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          if (customAppInput.trim()) {
                            handleLaunchApp(customAppInput.trim());
                            setCustomAppInput('');
                          }
                        }}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow transition-all"
                      >
                        Launch
                      </button>
                    </div>
                  </div>

                  {/* Top Running Processes (C++ /proc Table) */}
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" /> Active System Processes (C++ /proc Scanner)
                      </h4>
                      <span className="text-[10px] text-zinc-500">Sorted by RAM / CPU</span>
                    </div>
                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400">
                            <th className="py-2 px-2">PID</th>
                            <th className="py-2 px-2">User</th>
                            <th className="py-2 px-2">RAM (MB)</th>
                            <th className="py-2 px-2">Command</th>
                            <th className="py-2 px-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
                          {systemProcesses.map((proc, idx) => (
                            <tr key={proc.pid || idx} className="hover:bg-zinc-900/50 transition-colors">
                              <td className="py-1.5 px-2 text-zinc-400">{proc.pid}</td>
                              <td className="py-1.5 px-2 text-zinc-300">{proc.user}</td>
                              <td className="py-1.5 px-2 text-cyan-400">{proc.rss_mb || proc.rssMb || 0} MB</td>
                              <td className="py-1.5 px-2 text-zinc-300 max-w-xs truncate font-sans text-xs">{proc.command}</td>
                              <td className="py-1.5 px-2 text-right">
                                <button
                                  onClick={() => handleKillProcess(proc.pid)}
                                  className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded text-[10px] transition-colors"
                                >
                                  Kill
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Autonomous Shell Terminal */}
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Autonomous Terminal Execution
                      </h4>
                      <span className="text-[10px] text-zinc-500">Live Async Subprocess</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter bash command (e.g. 'uname -a', 'free -h', 'ip a', 'uptime')..."
                        value={terminalCmd}
                        onChange={(e) => setTerminalCmd(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !terminalLoading) handleExecCommand();
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={handleExecCommand}
                        disabled={terminalLoading}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                      >
                        {terminalLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Run
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-zinc-950 border border-zinc-900 text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {terminalOutput}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* CALENDAR VIEW */}
              {activeTab === 'calendar' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Upcoming Calendar Events</h3>
                      <p className="text-xs text-zinc-400">View and schedule meetings with automated Google Calendar sync</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Schedule Event
                      </button>
                      <a
                        href="https://calendar.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                        title="Open Google Calendar"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Schedule Modal */}
                  {showScheduleModal && (
                    <form onSubmit={handleScheduleSubmit} className="p-4 rounded-xl bg-zinc-900 border border-blue-500/30 space-y-3 animate-fade-in shadow-xl">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <h4 className="text-xs font-bold text-blue-400 uppercase">Schedule New Google Calendar Event</h4>
                        <button type="button" onClick={() => setShowScheduleModal(false)} className="text-zinc-400 hover:text-white text-xs">Cancel</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="col-span-full">
                          <label className="text-[11px] text-zinc-400 font-medium">Event Title / Summary *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Q3 Strategy Review"
                            value={eventForm.summary}
                            onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Start Time *</label>
                          <input
                            type="datetime-local"
                            required
                            value={eventForm.startTime}
                            onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">End Time *</label>
                          <input
                            type="datetime-local"
                            required
                            value={eventForm.endTime}
                            onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Location / Video Link</label>
                          <input
                            type="text"
                            placeholder="e.g. Google Meet, Room 4B"
                            value={eventForm.location}
                            onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Attendees (Comma separated)</label>
                          <input
                            type="text"
                            placeholder="sarah@example.com, alex@example.com"
                            value={eventForm.attendees}
                            onChange={(e) => setEventForm({ ...eventForm, attendees: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="col-span-full">
                          <label className="text-[11px] text-zinc-400 font-medium">Description / Agenda</label>
                          <textarea
                            rows={2}
                            placeholder="Meeting agenda and discussion topics..."
                            value={eventForm.description}
                            onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowScheduleModal(false)}
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-lg hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow"
                        >
                          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                          Confirm & Schedule
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Events list */}
                  <div className="space-y-2.5">
                    {calendarEvents.map(event => (
                      <div key={event.id} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-zinc-100">{event.summary || 'Untitled Event'}</p>
                            {event.location && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                {event.location}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            {new Date(event.start?.dateTime || event.start?.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            {event.end && ` – ${new Date(event.end?.dateTime || event.end?.date).toLocaleTimeString([], { timeStyle: 'short' })}`}
                          </p>
                          {event.description && (
                            <p className="text-[11px] text-zinc-500 line-clamp-1">{event.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {event.htmlLink && (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-xs rounded-lg flex items-center gap-1 transition-colors"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1.5 bg-zinc-800 hover:bg-rose-900/30 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                            title="Delete Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {calendarEvents.length === 0 && !loading && (
                      <p className="text-zinc-500 text-xs italic py-6 text-center">No upcoming events scheduled.</p>
                    )}
                  </div>
                </div>
              )}

              {/* GMAIL VIEW */}
              {activeTab === 'gmail' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Gmail Inbox & Communications</h3>
                      <p className="text-xs text-zinc-400">Send emails directly or review recent incoming messages</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowComposeEmail(true)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow transition-all"
                      >
                        <Send className="w-3.5 h-3.5" /> Compose Email
                      </button>
                      <a
                        href="https://mail.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                        title="Open Gmail"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Compose Email Modal */}
                  {showComposeEmail && (
                    <form onSubmit={handleSendEmailSubmit} className="p-4 rounded-xl bg-zinc-900 border border-rose-500/30 space-y-3 animate-fade-in shadow-xl">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <h4 className="text-xs font-bold text-rose-400 uppercase">Compose & Send Email via Gmail</h4>
                        <button type="button" onClick={() => setShowComposeEmail(false)} className="text-zinc-400 hover:text-white text-xs">Cancel</button>
                      </div>
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] text-zinc-400 font-medium">To (Recipient) *</label>
                            <input
                              type="email"
                              required
                              placeholder="recipient@example.com"
                              value={emailForm.to}
                              onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                              className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-rose-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-zinc-400 font-medium">CC (Optional)</label>
                            <input
                              type="email"
                              placeholder="team@example.com"
                              value={emailForm.cc}
                              onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
                              className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-rose-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Subject *</label>
                          <input
                            type="text"
                            required
                            placeholder="Project Status Update"
                            value={emailForm.subject}
                            onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-rose-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Message Body *</label>
                          <textarea
                            rows={4}
                            required
                            placeholder="Write your email content here..."
                            value={emailForm.body}
                            onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-rose-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowComposeEmail(false)}
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-lg hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow"
                        >
                          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send Email
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Messages list */}
                  <div className="space-y-2.5">
                    {gmailMessages.map(msg => (
                      <div key={msg.id} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-zinc-100 truncate max-w-md">{msg.subject}</p>
                          <span className="text-[10px] text-zinc-500">{msg.date ? new Date(msg.date).toLocaleDateString() : ''}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">From: {msg.from}</p>
                        {msg.snippet && (
                          <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{msg.snippet}</p>
                        )}
                      </div>
                    ))}
                    {gmailMessages.length === 0 && !loading && (
                      <p className="text-zinc-500 text-xs italic py-6 text-center">No recent messages found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* GOOGLE DOCS VIEW */}
              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Google Docs</h3>
                      <p className="text-xs text-zinc-400">Create, read, and append to your Google Docs</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCreateDocModal(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create Doc
                      </button>
                      <a
                        href="https://docs.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                        title="Open Google Docs"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Create Doc Modal */}
                  {showCreateDocModal && (
                    <form onSubmit={handleCreateDocSubmit} className="p-4 rounded-xl bg-zinc-900 border border-blue-500/30 space-y-3 animate-fade-in shadow-xl">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <h4 className="text-xs font-bold text-blue-400 uppercase">Create New Google Document</h4>
                        <button type="button" onClick={() => setShowCreateDocModal(false)} className="text-zinc-400 hover:text-white text-xs">Cancel</button>
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Document Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Architecture Specification & Notes"
                            value={docForm.title}
                            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Initial Content / Body (Optional)</label>
                          <textarea
                            rows={4}
                            placeholder="Enter initial document content or leave empty..."
                            value={docForm.content}
                            onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowCreateDocModal(false)}
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-lg hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow"
                        >
                          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                          Create Document
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Docs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {driveFiles.filter(f => f.mimeType?.includes('document')).map(file => (
                      <div key={file.id} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2.5 rounded-lg bg-blue-600/10 text-blue-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-medium text-zinc-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-zinc-500">{new Date(file.modifiedTime || file.createdTime).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            title="Open in Google Docs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                    {driveFiles.filter(f => f.mimeType?.includes('document')).length === 0 && !loading && (
                      <p className="text-zinc-500 text-xs italic py-6 col-span-full text-center">No Google Docs found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* GOOGLE SHEETS VIEW */}
              {activeTab === 'sheets' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Google Sheets</h3>
                      <p className="text-xs text-zinc-400">Create spreadsheets, append rows, and organize tables</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCreateSheetModal(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 shadow transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create Sheet
                      </button>
                      <a
                        href="https://sheets.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                        title="Open Google Sheets"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Create Sheet Modal */}
                  {showCreateSheetModal && (
                    <form onSubmit={handleCreateSheetSubmit} className="p-4 rounded-xl bg-zinc-900 border border-emerald-500/30 space-y-3 animate-fade-in shadow-xl">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase">Create New Google Spreadsheet</h4>
                        <button type="button" onClick={() => setShowCreateSheetModal(false)} className="text-zinc-400 hover:text-white text-xs">Cancel</button>
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Spreadsheet Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 2026 Budget & Expense Tracker"
                            value={sheetForm.title}
                            onChange={(e) => setSheetForm({ ...sheetForm, title: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Column Headers (Comma separated)</label>
                          <input
                            type="text"
                            placeholder="Date, Item, Amount, Category, Status"
                            value={sheetForm.headers}
                            onChange={(e) => setSheetForm({ ...sheetForm, headers: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Initial Rows (Optional - JSON or lines)</label>
                          <textarea
                            rows={3}
                            placeholder="2026-08-15, Server Hosting, $150, Infrastructure, Paid&#10;2026-08-16, Domain Renewal, $20, Marketing, Pending"
                            value={sheetForm.initialRows}
                            onChange={(e) => setSheetForm({ ...sheetForm, initialRows: e.target.value })}
                            className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:border-emerald-500 outline-none font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowCreateSheetModal(false)}
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-lg hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow"
                        >
                          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Table className="w-3.5 h-3.5" />}
                          Create Spreadsheet
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Sheets Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {driveFiles.filter(f => f.mimeType?.includes('spreadsheet')).map(file => (
                      <div key={file.id} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2.5 rounded-lg bg-emerald-600/10 text-emerald-400">
                            <Table className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-medium text-zinc-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-zinc-500">{new Date(file.modifiedTime || file.createdTime).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            title="Open in Google Sheets"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                    {driveFiles.filter(f => f.mimeType?.includes('spreadsheet')).length === 0 && !loading && (
                      <p className="text-zinc-500 text-xs italic py-6 col-span-full text-center">No Google Sheets found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TASKS VIEW */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Google Tasks & Action Items</h3>
                      <p className="text-xs text-zinc-400">Track and manage your todos synced with Google Workspace</p>
                    </div>
                    <a
                      href="https://tasks.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                      title="Open Google Tasks"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Add task bar */}
                  <form onSubmit={handleCreateTask} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a new task..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:border-cyan-500 outline-none"
                    />
                    <input
                      type="date"
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 focus:border-cyan-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newTaskTitle.trim() || loading}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all shadow"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Task
                    </button>
                  </form>

                  {/* Tasks List */}
                  <div className="space-y-2">
                    {tasksList.map(task => (
                      <div key={task.id} className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={task.status === 'completed'}
                            onChange={() => handleToggleTask(task.id, task.status)}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <span className={`text-xs ${task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                              {task.title}
                            </span>
                            {task.due && (
                              <p className="text-[10px] text-zinc-500 mt-0.5">Due: {new Date(task.due).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {tasksList.length === 0 && !loading && (
                      <p className="text-zinc-500 text-xs italic py-6 text-center">No tasks in your Google Tasks list.</p>
                    )}
                  </div>
                </div>
              )}

              {/* DRIVE VIEW */}
              {activeTab === 'drive' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Google Drive Files</h3>
                      <p className="text-xs text-zinc-400">Search and navigate all your Google Drive assets</p>
                    </div>
                    <a
                      href="https://drive.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                      title="Open Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Search bar */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search files by name..."
                        value={driveSearchQuery}
                        onChange={(e) => setDriveSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchWorkspaceData(accessToken, 'drive')}
                        className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => fetchWorkspaceData(accessToken, 'drive')}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition-colors"
                    >
                      Search
                    </button>
                  </div>

                  {/* Files Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {driveFiles.map(file => (
                      <div key={file.id} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2.5 rounded-lg bg-zinc-800 text-zinc-300 group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-colors">
                            {file.mimeType?.includes('document') ? <FileText className="w-4 h-4 text-blue-400" /> :
                             file.mimeType?.includes('spreadsheet') ? <Table className="w-4 h-4 text-emerald-400" /> : 
                             file.mimeType?.includes('folder') ? <Folder className="w-4 h-4 text-amber-400" /> :
                             <Folder className="w-4 h-4" />}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-medium text-zinc-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-zinc-500">{new Date(file.modifiedTime || file.createdTime).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            title="Open in Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                    {driveFiles.length === 0 && !loading && (
                      <p className="text-zinc-500 text-xs italic py-6 col-span-full text-center">No files found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* J.A.R.V.I.S. ACTIVITY LOG VIEW */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" /> J.A.R.V.I.S. Autonomous Action Log
                      </h3>
                      <p className="text-xs text-zinc-400">Live feed of actions executed autonomously via voice or chat commands</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {actionHistory.map(item => (
                      <div key={item.id} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between animate-fade-in">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-100">{item.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              item.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                              item.status === 'started' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20 animate-pulse' :
                              'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            }`}>
                              {item.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400">{item.summary}</p>
                          <p className="text-[10px] text-zinc-500">{item.timestamp}</p>
                        </div>
                        {item.linkUrl && (
                          <a
                            href={item.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                          >
                            Open Item <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                    {actionHistory.length === 0 && (
                      <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800">
                        <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-50" />
                        <p className="text-xs text-zinc-400 font-medium">No autonomous actions executed in this session yet.</p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Ask Jarvis by voice: "Jarvis, schedule a team sync tomorrow at 3pm" or "Send an email to sarah@example.com".
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          /* Connect Account Empty State */
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center gap-4 max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-cyan-600/20 text-cyan-400 border border-blue-500/30 shadow-xl shadow-blue-500/10">
              <Folder className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Connect Google Workspace with J.A.R.V.I.S.</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Grant permission to allow J.A.R.V.I.S. to autonomously schedule meetings, send emails, create Google Docs & Sheets, and manage tasks for you.
              </p>
            </div>

            <div className="w-full p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 text-left space-y-1">
              <p className="font-semibold text-zinc-300">Supported Autonomous Actions:</p>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-400 text-[10px]">
                <li>Schedule, list, and delete Google Calendar events</li>
                <li>Send Gmail messages and create drafts</li>
                <li>Create and append to Google Docs</li>
                <li>Create spreadsheets and insert data into Google Sheets</li>
                <li>Create, complete, and track Google Tasks</li>
              </ul>
            </div>

            {error && (
              <div className="w-full p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs text-left">
                {error}
              </div>
            )}

            <div className="w-full space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleServerAuth}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  Sign In (Server OAuth)
                </button>

                <button
                  onClick={handleAuth}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Browser Popup (GIS)
                </button>
              </div>

              <div className="flex items-center my-2 text-zinc-600 text-[10px] uppercase font-bold tracking-wider">
                <span className="flex-1 border-t border-zinc-800" />
                <span className="px-2">or direct token</span>
                <span className="flex-1 border-t border-zinc-800" />
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste OAuth Token (ya29...)"
                  value={directTokenInput}
                  onChange={(e) => setDirectTokenInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleDirectTokenConnect}
                  disabled={loading || !directTokenInput.trim()}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-cyan-400 font-bold text-xs rounded-xl border border-cyan-500/30 disabled:opacity-40 cursor-pointer"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
