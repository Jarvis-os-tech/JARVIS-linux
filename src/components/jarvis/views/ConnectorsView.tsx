import { useState, useEffect } from "react";
import {
  Plug,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  LogOut,
  Settings,
  ShieldCheck,
  Mail,
  Calendar,
  FileText,
  CheckSquare,
  HardDrive,
  Loader2,
  Key,
  Info,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Terminal
} from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { Toggle } from "../Toggle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DEFAULT_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  "791977848384-q4ljrlj38kepp2crruo4i6vq3j1813ot.apps.googleusercontent.com";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

interface ConnectorItem {
  id: string;
  name: string;
  desc: string;
  status: boolean;
  color: string;
  category: string;
  statusText?: string;
  icon?: string;
}

export function ConnectorsView() {
  const { pushLog, pushNotification, googleAccessToken, setGoogleAccessToken } = useJarvis();
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem("g_client_id") || DEFAULT_CLIENT_ID);
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem("g_user_email") || "");
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("g_user_name") || "");
  const [userPicture, setUserPicture] = useState<string>(() => localStorage.getItem("g_user_picture") || "");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"oauth" | "direct" | "cli">("oauth");
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLinkedinAuthenticating, setIsLinkedinAuthenticating] = useState(false);
  const [isGithubAuthenticating, setIsGithubAuthenticating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const isGoogleConnected = !!(googleAccessToken || localStorage.getItem("g_access_token"));

  const [connectors, setConnectors] = useState<ConnectorItem[]>([
    {
      id: "c1",
      name: "Google Workspace Hub",
      desc: "Autonomous read/write integration across Gmail, Calendar, Docs, Sheets, Tasks & Drive.",
      status: isGoogleConnected,
      color: "var(--cyan-hud)",
      category: "Cloud Services MCP",
      statusText: isGoogleConnected ? "Active & Linked" : "Sign-in Required",
    },
    {
      id: "c3",
      name: "LinkedIn Professional Hub",
      desc: "Autonomous career intelligence, profile analysis, post creation, job search & outreach.",
      status: false,
      color: "#0A66C2",
      category: "Career & Social MCP",
      statusText: "Sign-in Required",
    },
    {
      id: "c4",
      name: "GitHub Developer Hub",
      desc: "Autonomous repository intelligence, issue tracking, Gists, PRs & code analysis.",
      status: false,
      color: "#F05032",
      category: "Code & Cloud MCP",
      statusText: "Sign-in Required",
    },
    {
      id: "c2",
      name: "Playwright Browser Automation",
      desc: "Headless web crawling, DOM extraction, and autonomous form execution plugin.",
      status: true,
      color: "var(--pink-hud)",
      category: "Web & Network Plugin",
      statusText: "Active & Available",
    },
  ]);

  // LinkedIn State
  const [isLinkedinConfigOpen, setIsLinkedinConfigOpen] = useState(false);
  const [linkedinTab, setLinkedinTab] = useState<"oauth_token" | "linkedapi" | "test">("oauth_token");
  const [linkedinTokenInput, setLinkedinTokenInput] = useState("");
  const [linkedinApiTokenInput, setLinkedinApiTokenInput] = useState("");
  const [linkedinIdTokenInput, setLinkedinIdTokenInput] = useState("");
  const [linkedinStatus, setLinkedinStatus] = useState<{
    connected: boolean;
    hasAccessToken: boolean;
    hasLinkedApiToken: boolean;
    name?: string;
    email?: string;
    picture?: string;
  }>({ connected: false, hasAccessToken: false, hasLinkedApiToken: false });
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [testPostText, setTestPostText] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const handleConnectLinkedin = async () => {
    setIsLinkedinAuthenticating(true);
    try {
      const redirectUri = `${window.location.origin}/api/linkedin/callback`;
      const res = await fetch(`/api/linkedin/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || "Failed to initialize LinkedIn OAuth URL");
      }

      const width = 580;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.url,
        "linkedin_oauth_window",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      const messageListener = (event: MessageEvent) => {
        if (event.data?.type === "LINKEDIN_AUTH_SUCCESS") {
          window.removeEventListener("message", messageListener);
          setIsLinkedinAuthenticating(false);
          setIsLinkedinConfigOpen(false);
          toast.success("LinkedIn connected successfully!");
          pushLog("LinkedIn OAuth 2.0 authorized.");
          pushNotification("💼", "LinkedIn Workspace authorized.");
          fetchLinkedinStatus();
        } else if (event.data?.type === "LINKEDIN_AUTH_FAILED") {
          window.removeEventListener("message", messageListener);
          setIsLinkedinAuthenticating(false);
          toast.error(event.data.error || "LinkedIn authorization failed");
        }
      };
      window.addEventListener("message", messageListener);

      const checkPopup = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          window.removeEventListener("message", messageListener);
          setIsLinkedinAuthenticating(false);
          fetchLinkedinStatus();
        }
      }, 1000);
    } catch (err: any) {
      setIsLinkedinAuthenticating(false);
      toast.error(err.message || "Failed to start LinkedIn OAuth flow");
      setIsLinkedinConfigOpen(true);
      setLinkedinTab("oauth_token");
    }
  };

  const handleConnectGithub = async () => {
    setIsGithubAuthenticating(true);
    try {
      const redirectUri = `${window.location.origin}/api/github/callback`;
      const res = await fetch(`/api/github/auth/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || "Failed to initialize GitHub OAuth URL");
      }

      const width = 580;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.url,
        "github_oauth_window",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      const messageListener = (event: MessageEvent) => {
        if (event.data?.type === "GITHUB_AUTH_SUCCESS") {
          window.removeEventListener("message", messageListener);
          setIsGithubAuthenticating(false);
          setIsGithubConfigOpen(false);
          toast.success("GitHub connected successfully!");
          pushLog("GitHub OAuth 2.0 authorized.");
          pushNotification("🐙", "GitHub Developer Hub authorized.");
          fetchGithubStatus();
        } else if (event.data?.type === "GITHUB_AUTH_FAILED") {
          window.removeEventListener("message", messageListener);
          setIsGithubAuthenticating(false);
          toast.error(event.data.error || "GitHub authorization failed");
        }
      };
      window.addEventListener("message", messageListener);

      const checkPopup = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          window.removeEventListener("message", messageListener);
          setIsGithubAuthenticating(false);
          fetchGithubStatus();
        }
      }, 1000);
    } catch (err: any) {
      setIsGithubAuthenticating(false);
      toast.error(err.message || "Failed to start GitHub OAuth flow");
      setIsGithubConfigOpen(true);
      setGithubTab("token");
    }
  };

  const fetchLinkedinStatus = async () => {
    try {
      const res = await fetch("/api/linkedin/status");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLinkedinStatus(data);
          setConnectors((prev) =>
            prev.map((c) => {
              if (c.id === "c3") {
                return {
                  ...c,
                  status: data.connected,
                  statusText: data.connected ? (data.name ? `Connected (${data.name})` : "Active & Linked") : "Sign-in Required",
                };
              }
              return c;
            })
          );
        }
      }
    } catch {}
  };

  const handleSaveLinkedinToken = async () => {
    const rawToken = linkedinTokenInput.trim();
    if (!rawToken && !linkedinApiTokenInput.trim()) {
      toast.error("Please enter a valid LinkedIn OAuth Access Token or LinkedAPI credentials.");
      return;
    }

    setLinkedinLoading(true);
    try {
      const res = await fetch("/api/linkedin/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: rawToken,
          linkedApiToken: linkedinApiTokenInput.trim(),
          identificationToken: linkedinIdTokenInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save LinkedIn credentials");
      }

      toast.success("LinkedIn credentials saved and verified!");
      pushLog(`LinkedIn connected for ${data.status?.name || data.auth?.email || "user"}.`);
      pushNotification("💼", `LinkedIn connected (${data.status?.name || "Active"}).`);
      setLinkedinTokenInput("");
      setIsLinkedinConfigOpen(false);
      fetchLinkedinStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to save LinkedIn credentials");
    } finally {
      setLinkedinLoading(false);
    }
  };

  const handleDisconnectLinkedin = async () => {
    try {
      await fetch("/api/linkedin/auth/disconnect", { method: "POST" });
      setLinkedinStatus({ connected: false, hasAccessToken: false, hasLinkedApiToken: false });
      toast("LinkedIn account disconnected");
      pushLog("LinkedIn account disconnected.");
      fetchLinkedinStatus();
    } catch {
      toast.error("Failed to disconnect LinkedIn");
    }
  };

  const handleCreateTestPost = async () => {
    if (!testPostText.trim()) {
      toast.error("Please write post text");
      return;
    }
    setIsPosting(true);
    try {
      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testPostText.trim(), visibility: "PUBLIC" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("LinkedIn post published!");
        pushLog(`LinkedIn post published: "${testPostText.slice(0, 40)}..."`);
        setTestPostText("");
      } else {
        throw new Error(data.error || "Failed to publish post");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to post to LinkedIn");
    } finally {
      setIsPosting(false);
    }
  };

  // GitHub State
  const [isGithubConfigOpen, setIsGithubConfigOpen] = useState(false);
  const [githubTab, setGithubTab] = useState<"token" | "cli" | "gist">("token");
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [githubStatus, setGithubStatus] = useState<{
    connected: boolean;
    login?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    publicRepos?: number;
  }>({ connected: false });
  const [githubLoading, setGithubLoading] = useState(false);
  const [gistFilename, setGistFilename] = useState("");
  const [gistContent, setGistContent] = useState("");
  const [isCreatingGist, setIsCreatingGist] = useState(false);

  const fetchGithubStatus = async () => {
    try {
      const res = await fetch("/api/github/status");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGithubStatus(data);
          setConnectors((prev) =>
            prev.map((c) => {
              if (c.id === "c4") {
                return {
                  ...c,
                  status: data.connected,
                  statusText: data.connected ? (data.login ? `@${data.login}` : "Active & Linked") : "Sign-in Required",
                };
              }
              return c;
            })
          );
        }
      }
    } catch {}
  };

  const handleSaveGithubToken = async () => {
    const rawToken = githubTokenInput.trim();
    if (!rawToken) {
      toast.error("Please enter a valid GitHub Personal Access Token or OAuth Token.");
      return;
    }

    setGithubLoading(true);
    try {
      const res = await fetch("/api/github/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: rawToken }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save GitHub credentials");
      }

      toast.success("GitHub credentials saved and verified!");
      pushLog(`GitHub connected for @${data.status?.login || "user"}.`);
      pushNotification("🐙", `GitHub connected (@${data.status?.login || "Active"}).`);
      setGithubTokenInput("");
      setIsGithubConfigOpen(false);
      fetchGithubStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to save GitHub credentials");
    } finally {
      setGithubLoading(false);
    }
  };

  const handleDisconnectGithub = async () => {
    try {
      await fetch("/api/github/auth/disconnect", { method: "POST" });
      setGithubStatus({ connected: false });
      toast("GitHub account disconnected");
      pushLog("GitHub account disconnected.");
      fetchGithubStatus();
    } catch {
      toast.error("Failed to disconnect GitHub");
    }
  };

  const handleCreateGist = async () => {
    if (!gistFilename.trim() || !gistContent.trim()) {
      toast.error("Please provide both filename and content for the Gist");
      return;
    }
    setIsCreatingGist(true);
    try {
      const res = await fetch("/api/github/gist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: gistFilename.trim(),
          content: gistContent.trim(),
          description: `Created via J.A.R.V.I.S. on ${new Date().toLocaleDateString()}`,
          isPublic: false,
        }),
      });
      const data = await res.json();
      if (data.success && data.gist?.htmlUrl) {
        toast.success("Gist created successfully!");
        pushLog(`GitHub Gist created: ${data.gist.htmlUrl}`);
        setGistFilename("");
        setGistContent("");
      } else {
        throw new Error(data.error || "Failed to create Gist");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create Gist");
    } finally {
      setIsCreatingGist(false);
    }
  };

  const fetchGoogleUserInfo = async (token: string) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setUserEmail(data.email);
          localStorage.setItem("g_user_email", data.email);
        }
        if (data.name) {
          setUserName(data.name);
          localStorage.setItem("g_user_name", data.name);
        }
        if (data.picture) {
          setUserPicture(data.picture);
          localStorage.setItem("g_user_picture", data.picture);
        }
        return data;
      }
    } catch {
      // Userinfo fetch failure is non-fatal
    }
    return null;
  };

  // 1. One-Click Google Sign-In via Google Identity Services (GSI)
  const handleConnectGoogle = () => {
    const trimmedId = clientId.trim();
    if (!trimmedId) {
      toast.error("Please provide a valid Google OAuth Client ID.");
      setIsConfigOpen(true);
      return;
    }

    localStorage.setItem("g_client_id", trimmedId);

    const gsi = (window as any).google?.accounts?.oauth2;
    if (!gsi) {
      toast.error("Google Identity Services SDK is loading. Alternatively, paste your token in Direct Connect.");
      setIsConfigOpen(true);
      setConfigTab("direct");
      return;
    }

    setIsAuthenticating(true);

    const runTokenClientFallback = () => {
      try {
        const tokenClient = gsi.initTokenClient({
          client_id: trimmedId,
          scope: GOOGLE_SCOPES,
          error_callback: (err: any) => {
            setIsAuthenticating(false);
            console.warn("Google OAuth error:", err);
            toast.error(err?.message || "Google sign-in popup was closed or origin is not authorized.");
            setIsConfigOpen(true);
          },
          callback: async (response: any) => {
            setIsAuthenticating(false);
            if (response.access_token) {
              const token = response.access_token;
              setGoogleAccessToken(token);
              localStorage.setItem("g_access_token", token);
              await fetch("/api/workspace/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
              }).catch(() => {});
              
              const userInfo = await fetchGoogleUserInfo(token);

              pushLog(`Google Workspace connected for ${userInfo?.email || "Operator"}.`);
              pushNotification("🌐", `Google Workspace authorized for ${userInfo?.email || "all agents"}.`);
              toast.success(`Google Account connected (${userInfo?.email || "Active"})!`);
              setIsConfigOpen(false);
              pollRealStatuses();
            } else if (response.error) {
              toast.error(`Google Authentication: ${response.error_description || response.error}`);
              setIsConfigOpen(true);
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: "consent" });
      } catch (err: any) {
        setIsAuthenticating(false);
        toast.error(err.message || "Failed to initialize Google OAuth");
        setIsConfigOpen(true);
      }
    };

    // Attempt CodeClient first for permanent offline refresh token
    if (gsi.initCodeClient) {
      try {
        const codeClient = gsi.initCodeClient({
          client_id: trimmedId,
          scope: GOOGLE_SCOPES,
          ux_mode: "popup",
          error_callback: (err: any) => {
            console.warn("Google Code Client error, falling back to Token Client:", err);
            runTokenClientFallback();
          },
          callback: async (response: any) => {
            if (response.code) {
              try {
                const exchangeRes = await fetch("/api/auth/google/code", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code: response.code, redirectUri: "postmessage" }),
                });
                const authData = await exchangeRes.json();
                if (authData.success) {
                  const statusRes = await fetch("/api/workspace/token/status");
                  const status = await statusRes.json();
                  if (status.token) {
                    setGoogleAccessToken(status.token);
                    localStorage.setItem("g_access_token", status.token);
                  }
                  if (authData.email) {
                    setUserEmail(authData.email);
                    localStorage.setItem("g_user_email", authData.email);
                  }
                  if (authData.name) {
                    setUserName(authData.name);
                    localStorage.setItem("g_user_name", authData.name);
                  }
                  if (authData.picture) {
                    setUserPicture(authData.picture);
                    localStorage.setItem("g_user_picture", authData.picture);
                  }
                  pushLog(`Google Workspace permanently authorized with auto-refresh for ${authData.email || "Operator"}.`);
                  pushNotification("🌐", `Google Workspace auto-refresh enabled.`);
                  toast.success(`Google Account permanently connected (${authData.email || "Active"})!`);
                  setIsConfigOpen(false);
                  pollRealStatuses();
                  setIsAuthenticating(false);
                  return;
                }
              } catch (e) {
                console.warn("Code exchange fallback to token client:", e);
              }
            }
            runTokenClientFallback();
          },
        });

        codeClient.requestCode();
        return;
      } catch (err: any) {
        console.warn("initCodeClient error:", err);
      }
    }

    runTokenClientFallback();
  };

  // 2. Direct Manual Token Connect (Instant Link Fallback)
  const handleManualTokenConnect = async () => {
    const raw = manualTokenInput.trim();
    if (!raw) {
      toast.error("Please paste a valid Google OAuth Access Token (starts with ya29...)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${raw}` },
      });

      if (!res.ok) {
        throw new Error(`Token rejected by Google (HTTP ${res.status}). Please verify token validity or re-issue via gcloud.`);
      }

      const data = await res.json();
      setGoogleAccessToken(raw);
      localStorage.setItem("g_access_token", raw);
      if (data.email) {
        setUserEmail(data.email);
        localStorage.setItem("g_user_email", data.email);
      }
      if (data.name) {
        setUserName(data.name);
        localStorage.setItem("g_user_name", data.name);
      }
      if (data.picture) {
        setUserPicture(data.picture);
        localStorage.setItem("g_user_picture", data.picture);
      }

      await fetch("/api/workspace/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: raw }),
      });

      pushLog(`Google Account (${data.email || 'connected'}) linked successfully across all agents.`);
      pushNotification("🌐", `Google Workspace linked for ${data.email || 'user'}.`);
      toast.success(`Google Account connected (${data.email || 'Active'})!`);
      setManualTokenInput("");
      setIsConfigOpen(false);
      pollRealStatuses();
    } catch (err: any) {
      toast.error(err.message || "Failed to connect with token");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGoogle = () => {
    setGoogleAccessToken("");
    setUserEmail("");
    setUserName("");
    setUserPicture("");
    localStorage.removeItem("g_access_token");
    localStorage.removeItem("g_user_email");
    localStorage.removeItem("g_user_name");
    localStorage.removeItem("g_user_picture");

    fetch("/api/workspace/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "" }),
    }).catch(() => {});

    pushLog("Google Workspace account disconnected.");
    pushNotification("🔌", "Google Workspace unlinked.");
    toast("Google Account disconnected");
    pollRealStatuses();
  };

  const pollRealStatuses = async () => {
    setLoading(true);
    try {
      const hasGoogle = !!(googleAccessToken || localStorage.getItem("g_access_token"));

      if (hasGoogle && !userEmail) {
        const storedToken = googleAccessToken || localStorage.getItem("g_access_token");
        if (storedToken) fetchGoogleUserInfo(storedToken);
      }

      setConnectors((prev) =>
        prev.map((c) => {
          if (c.id === "c1") {
            return {
              ...c,
              status: hasGoogle,
              statusText: hasGoogle ? (userEmail ? `Connected (${userEmail})` : "Active & Linked") : "Sign-in Required",
            };
          }
          return c;
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-detect server-cached tokens or environment variable on mount
  useEffect(() => {
    fetch("/api/workspace/token/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.token && !googleAccessToken && !localStorage.getItem("g_access_token")) {
          setGoogleAccessToken(data.token);
          localStorage.setItem("g_access_token", data.token);
          fetchGoogleUserInfo(data.token);
        }
      })
      .catch(() => {});

    fetchLinkedinStatus();
    fetchGithubStatus();
  }, []);

  useEffect(() => {
    pollRealStatuses();
  }, [googleAccessToken]);

  const onlineCount = connectors.filter((c) => c.status).length;

  const toggle = (id: string) => {
    if (id === "c1" && !isGoogleConnected) {
      handleConnectGoogle();
      return;
    }

    if (id === "c3" && !linkedinStatus.connected) {
      handleConnectLinkedin();
      return;
    }

    if (id === "c4" && !githubStatus.connected) {
      handleConnectGithub();
      return;
    }

    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = !c.status;
        queueMicrotask(() => {
          pushLog(`${c.name} ${next ? "enabled" : "disabled"}.`);
          pushNotification("🔌", `${c.name} ${next ? "enabled" : "disabled"}.`);
          toast(`${c.name} ${next ? "enabled" : "disabled"}`);
        });
        return { ...c, status: next, statusText: next ? "Manual Link" : "Offline" };
      })
    );
  };

  const copyCliCommand = () => {
    navigator.clipboard.writeText("gcloud auth print-access-token");
    setCopiedCli(true);
    toast.success("Command copied to clipboard!");
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header Bar */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display etched text-2xl font-bold tracking-wide">MCPs &amp; Connectors</h1>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-cyan-hud border border-cyan-500/20">
              {onlineCount} of {connectors.length} Ports Active
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Google Workspace, local actuators, and Model Context Protocol (MCP) integrations for J.A.R.V.I.S.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Google Connect Button */}
          {isGoogleConnected ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsConfigOpen(true)}
                title="Google Account Settings"
                className="key flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              >
                {userPicture ? (
                  <img src={userPicture} alt="Google Avatar" className="w-4 h-4 rounded-full" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
                <span>{userEmail || "Google Connected"}</span>
                <RefreshCw className="w-3 h-3 text-muted-foreground ml-1" />
              </button>

              <button
                onClick={handleDisconnectGoogle}
                title="Disconnect Google Account"
                className="key flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleConnectGoogle}
                disabled={isAuthenticating}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold transition-all cursor-pointer shadow-lg",
                  isAuthenticating
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse cursor-wait"
                    : "bg-white text-zinc-900 hover:bg-zinc-100 border border-white/40 shadow-white/10"
                )}
              >
                {isAuthenticating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{isAuthenticating ? "Connecting Google..." : "Connect to Google"}</span>
              </button>

              <button
                onClick={() => {
                  setIsConfigOpen(true);
                  setConfigTab("direct");
                }}
                title="Paste Access Token Directly"
                className="key flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Token Auth</span>
              </button>
            </div>
          )}

          {/* Client ID settings toggle */}
          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            title="Configure Google Workspace Authentication"
            className="key grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-cyan-hud cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Google Authentication & Connector Configuration Center */}
      {isConfigOpen && (
        <div className="animate-rise-in mb-4 neu rounded-2xl p-5 flex flex-col gap-4 border border-cyan-500/30 bg-zinc-950/80 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-foreground">Google Workspace Authentication Hub</h2>
            </div>
            <button
              onClick={() => setIsConfigOpen(false)}
              className="text-xs text-muted-foreground hover:text-white px-2 py-1 rounded-md"
            >
              ✕ Close
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setConfigTab("oauth")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                configTab === "oauth"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              1-Click OAuth Sign-In
            </button>
            <button
              onClick={() => setConfigTab("direct")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                configTab === "direct"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              Direct Token Connect (Instant)
            </button>
            <button
              onClick={() => setConfigTab("cli")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                configTab === "cli"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              CLI &amp; Environment
            </button>
          </div>

          {/* Tab 1: OAuth Configuration */}
          {configTab === "oauth" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Google Cloud OAuth 2.0 Client ID</span>
                <span className="font-mono text-[10px] text-cyan-400">
                  Origin: {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="791977848384-...apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="flex-1 neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none border border-white/10 focus:border-cyan-400"
                />
                <button
                  onClick={() => {
                    localStorage.setItem("g_client_id", clientId.trim());
                    toast.success("Client ID saved");
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Save ID
                </button>
                <button
                  onClick={handleConnectGoogle}
                  disabled={isAuthenticating}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {isAuthenticating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Sign In with Google
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Ensure <code className="text-cyan-300 font-mono">{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}</code> is added under <strong>Authorized JavaScript origins</strong> in your Google Cloud Console OAuth 2.0 Web Client credentials.
              </p>
            </div>
          )}

          {/* Tab 2: Direct Token Connect */}
          {configTab === "direct" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Paste Google OAuth Access Token (Bearer Token)</span>
                <span className="text-[10px] text-emerald-400">Instant validation &amp; zero-popup setup</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="ya29.a0Ac..."
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  className="flex-1 neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none border border-white/10 focus:border-cyan-400"
                />
                <button
                  onClick={handleManualTokenConnect}
                  disabled={loading || !manualTokenInput.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Connect Token
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Tokens from Google OAuth Playground or <code className="text-cyan-300 font-mono">gcloud auth print-access-token</code> will instantly unlock Gmail, Google Calendar, Docs, Sheets, Drive, and Tasks for all 5 personas.
              </p>
            </div>
          )}

          {/* Tab 3: CLI / Environment */}
          {configTab === "cli" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Generate Token via Google Cloud CLI</span>
                <button
                  onClick={copyCliCommand}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
                >
                  {copiedCli ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCli ? "Copied" : "Copy Command"}
                </button>
              </div>
              <div className="neu-inset rounded-xl p-3 font-mono text-xs text-cyan-300 flex items-center justify-between">
                <span>gcloud auth print-access-token</span>
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed flex flex-col gap-1">
                <span>1. Run the command above in your terminal.</span>
                <span>2. Copy the resulting token (<code className="text-cyan-300 font-mono">ya29...</code>).</span>
                <span>3. Switch to <strong>Direct Token Connect</strong> tab and paste it, or add <code className="text-cyan-300 font-mono">GOOGLE_ACCESS_TOKEN="..."</code> to your <code className="text-cyan-300 font-mono">.env</code> file.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LinkedIn Authentication & Control Hub */}
      {isLinkedinConfigOpen && (
        <div className="animate-rise-in mb-4 neu rounded-2xl p-5 flex flex-col gap-4 border border-[#0A66C2]/40 bg-zinc-950/80 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
              <h2 className="text-sm font-bold text-foreground">LinkedIn Professional Intelligence Hub</h2>
              {linkedinStatus.connected && (
                <span className="neu-inset px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  {linkedinStatus.name || "Connected"}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsLinkedinConfigOpen(false)}
              className="text-xs text-muted-foreground hover:text-white px-2 py-1 rounded-md cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setLinkedinTab("oauth_token")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                linkedinTab === "oauth_token"
                  ? "bg-[#0A66C2]/20 text-[#388bfd] border border-[#0A66C2]/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Key className="w-3.5 h-3.5 text-[#0A66C2]" />
              OAuth Access Token (Instant)
            </button>
            <button
              onClick={() => setLinkedinTab("linkedapi")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                linkedinTab === "linkedapi"
                  ? "bg-[#0A66C2]/20 text-[#388bfd] border border-[#0A66C2]/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Terminal className="w-3.5 h-3.5 text-[#0A66C2]" />
              LinkedAPI / CLI Tokens
            </button>
            {linkedinStatus.connected && (
              <button
                onClick={() => setLinkedinTab("test")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                  linkedinTab === "test"
                    ? "bg-[#0A66C2]/20 text-[#388bfd] border border-[#0A66C2]/40"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Post Update / Test
              </button>
            )}
          </div>

          {/* Tab 1: Direct OAuth Access Token */}
          {linkedinTab === "oauth_token" && (
            <div className="flex flex-col gap-3">
              {/* 1-Click OAuth Popup Button */}
              <div className="p-3.5 neu-inset rounded-xl flex items-center justify-between gap-3 border border-[#0A66C2]/30 bg-[#0A66C2]/5">
                <div>
                  <h4 className="text-xs font-bold text-foreground">1-Click Instant Sign-In</h4>
                  <p className="text-[11px] text-zinc-400">Authorize securely via browser popup without copying tokens.</p>
                </div>
                <button
                  onClick={handleConnectLinkedin}
                  disabled={isLinkedinAuthenticating}
                  className="px-4 py-2 bg-gradient-to-r from-[#0A66C2] to-sky-600 hover:from-[#004182] hover:to-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
                >
                  {isLinkedinAuthenticating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Authorize LinkedIn
                </button>
              </div>

              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold">Or enter token directly</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="AQV..."
                  value={linkedinTokenInput}
                  onChange={(e) => setLinkedinTokenInput(e.target.value)}
                  className="flex-1 neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none border border-white/10 focus:border-[#0A66C2]"
                />
                <button
                  onClick={handleSaveLinkedinToken}
                  disabled={linkedinLoading || !linkedinTokenInput.trim()}
                  className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {linkedinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Save Token
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Enables J.A.R.V.I.S. to read your profile, post status updates, analyze professional networks, and search candidate talent autonomously via voice and chat tools.
              </p>
            </div>
          )}

          {/* Tab 2: LinkedAPI / CLI */}
          {linkedinTab === "linkedapi" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Linked API Token</label>
                  <input
                    type="password"
                    placeholder="Linked API Token..."
                    value={linkedinApiTokenInput}
                    onChange={(e) => setLinkedinApiTokenInput(e.target.value)}
                    className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none border border-white/10"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Identification Token</label>
                  <input
                    type="password"
                    placeholder="Identification Token..."
                    value={linkedinIdTokenInput}
                    onChange={(e) => setLinkedinIdTokenInput(e.target.value)}
                    className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none border border-white/10"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveLinkedinToken}
                disabled={linkedinLoading}
                className="self-end px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Save LinkedAPI Credentials
              </button>
            </div>
          )}

          {/* Tab 3: Quick Post / Test */}
          {linkedinTab === "test" && (
            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted-foreground">Publish a Quick Update to LinkedIn</label>
              <textarea
                rows={3}
                placeholder="What's happening in your engineering workflows today?"
                value={testPostText}
                onChange={(e) => setTestPostText(e.target.value)}
                className="w-full neu-inset rounded-xl p-3 text-xs text-foreground outline-none border border-white/10 focus:border-[#0A66C2]"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">Visibility: Public Feed</span>
                <button
                  onClick={handleCreateTestPost}
                  disabled={isPosting || !testPostText.trim()}
                  className="px-5 py-2 bg-[#0A66C2] hover:bg-[#004182] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Publish Post
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GitHub Authentication & Developer Control Hub */}
      {isGithubConfigOpen && (
        <div className="animate-rise-in mb-4 neu rounded-2xl p-5 flex flex-col gap-4 border border-[#F05032]/40 bg-zinc-950/80 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#F05032]" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <h2 className="text-sm font-bold text-foreground">GitHub Developer Intelligence Hub</h2>
              {githubStatus.connected && (
                <span className="neu-inset px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  @{githubStatus.login || "Connected"}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsGithubConfigOpen(false)}
              className="text-xs text-muted-foreground hover:text-white px-2 py-1 rounded-md cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setGithubTab("token")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                githubTab === "token"
                  ? "bg-[#F05032]/20 text-[#ff7a64] border border-[#F05032]/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Key className="w-3.5 h-3.5 text-[#F05032]" />
              OAuth / Personal Access Token
            </button>
            <button
              onClick={() => setGithubTab("cli")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                githubTab === "cli"
                  ? "bg-[#F05032]/20 text-[#ff7a64] border border-[#F05032]/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Terminal className="w-3.5 h-3.5 text-[#F05032]" />
              Run OAuth Flow (Python)
            </button>
            {githubStatus.connected && (
              <button
                onClick={() => setGithubTab("gist")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                  githubTab === "gist"
                    ? "bg-[#F05032]/20 text-[#ff7a64] border border-[#F05032]/40"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Gist Creator
              </button>
            )}
          </div>

          {/* Tab 1: Token Input */}
          {githubTab === "token" && (
            <div className="flex flex-col gap-3">
              {/* 1-Click OAuth Popup Button */}
              <div className="p-3.5 neu-inset rounded-xl flex items-center justify-between gap-3 border border-[#F05032]/30 bg-[#F05032]/5">
                <div>
                  <h4 className="text-xs font-bold text-foreground">1-Click Instant Sign-In</h4>
                  <p className="text-[11px] text-zinc-400">Authorize GitHub securely via browser popup using your configured OAuth app.</p>
                </div>
                <button
                  onClick={handleConnectGithub}
                  disabled={isGithubAuthenticating}
                  className="px-4 py-2 bg-gradient-to-r from-[#F05032] to-amber-600 hover:from-[#d03e22] hover:to-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
                >
                  {isGithubAuthenticating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Authorize GitHub
                </button>
              </div>

              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold">Or enter token directly</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="ghp_... or gho_..."
                  value={githubTokenInput}
                  onChange={(e) => setGithubTokenInput(e.target.value)}
                  className="flex-1 neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none border border-white/10 focus:border-[#F05032]"
                />
                <button
                  onClick={handleSaveGithubToken}
                  disabled={githubLoading || !githubTokenInput.trim()}
                  className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {githubLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Save Token
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Enables autonomous repository management, creating issues, generating gists, and high-rate search (5000 req/hr) across voice and AI agents.
              </p>
            </div>
          )}

          {/* Tab 2: CLI Runner */}
          {githubTab === "cli" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Run Autonomous Python OAuth 2.0 Flow</span>
                <span className="font-mono text-[10px] text-[#F05032]">Local-First &amp; Zero-Config</span>
              </div>
              <div className="neu-inset rounded-xl p-3 font-mono text-xs text-zinc-300 flex items-center justify-between">
                <span>python3 scripts/github_oauth_flow.py</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("python3 scripts/github_oauth_flow.py");
                    toast.success("Command copied to clipboard!");
                  }}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] font-mono cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Reads <code className="text-[#ff7a64] font-mono">GITHUB_CLIENT_ID</code> and <code className="text-[#ff7a64] font-mono">GITHUB_CLIENT_SECRET</code> from your <code className="text-zinc-200 font-mono">.env</code>, opens your browser, captures the code, and saves credentials directly into SQLite.
              </p>
            </div>
          )}

          {/* Tab 3: Quick Gist Creator */}
          {githubTab === "gist" && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Filename (e.g. snippet.ts, architecture.md)..."
                value={gistFilename}
                onChange={(e) => setGistFilename(e.target.value)}
                className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none border border-white/10"
              />
              <textarea
                rows={4}
                placeholder="Gist content or code snippet..."
                value={gistContent}
                onChange={(e) => setGistContent(e.target.value)}
                className="w-full neu-inset rounded-xl p-3 text-xs font-mono text-foreground outline-none border border-white/10"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">Secret Gist (Private)</span>
                <button
                  onClick={handleCreateGist}
                  disabled={isCreatingGist || !gistFilename.trim() || !gistContent.trim()}
                  className="px-5 py-2 bg-[#F05032] hover:bg-[#d03e22] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {isCreatingGist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Create Gist
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connectors Grid */}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(18.5rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {connectors.map((c) => {
          const isGoogleCard = c.id === "c1";
          const isLinkedinCard = c.id === "c3";
          const isGithubCard = c.id === "c4";

          return (
            <article
              key={c.id}
              className={cn(
                "neu gloss animate-rise-in rounded-2xl p-4 flex flex-col justify-between transition-all",
                isGoogleCard && isGoogleConnected && "border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.08)]",
                isLinkedinCard && linkedinStatus.connected && "border border-[#0A66C2]/40 shadow-[0_0_15px_rgba(10,102,194,0.15)]",
                isGithubCard && githubStatus.connected && "border border-[#F05032]/40 shadow-[0_0_15px_rgba(240,80,50,0.15)]"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="neu-inset grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                    style={{ color: c.color }}
                  >
                    {isGoogleCard ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    ) : isLinkedinCard ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                    ) : isGithubCard ? (
                      <svg className="w-5 h-5 text-[#F05032]" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                    ) : (
                      <Plug className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <Toggle on={c.status} onToggle={() => toggle(c.id)} label={`Toggle ${c.name}`} />
                </div>

                <div className="mt-3">
                  <span className="neu-inset rounded-md px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-bold font-mono">
                    {c.category}
                  </span>
                  <h3 className="mt-1 text-[13.5px] font-bold text-foreground">{c.name}</h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>

                {/* Google Workspace Badges */}
                {isGoogleCard && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <Mail className="w-3 h-3 text-rose-400" /> Gmail
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <Calendar className="w-3 h-3 text-blue-400" /> Calendar
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <FileText className="w-3 h-3 text-sky-400" /> Docs
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <HardDrive className="w-3 h-3 text-emerald-400" /> Drive
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <CheckSquare className="w-3 h-3 text-cyan-400" /> Tasks
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <FileText className="w-3 h-3 text-amber-400" /> Sheets
                    </span>
                  </div>
                )}

                {/* LinkedIn Badges */}
                {isLinkedinCard && (
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <ShieldCheck className="w-3 h-3 text-[#0A66C2]" /> Profile Sync
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <Sparkles className="w-3 h-3 text-sky-400" /> Post Updates
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <Info className="w-3 h-3 text-emerald-400" /> Job Search
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <Mail className="w-3 h-3 text-indigo-400" /> Direct Msg
                    </span>
                  </div>
                )}

                {/* GitHub Badges */}
                {isGithubCard && (
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <HardDrive className="w-3 h-3 text-[#F05032]" /> Repos &amp; Stats
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <CheckSquare className="w-3 h-3 text-amber-400" /> Issue Tracker
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <FileText className="w-3 h-3 text-emerald-400" /> Gist Creator
                    </span>
                    <span className="neu-inset flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300">
                      <Sparkles className="w-3 h-3 text-cyan-400" /> 5k req/hr API
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2.5 border-t border-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p
                    className={cn(
                      "flex items-center gap-2 text-[11px] font-bold",
                      c.status ? "text-emerald-hud" : "text-muted-foreground"
                    )}
                  >
                    <i
                      className={cn(
                        "h-2 w-2 rounded-full",
                        c.status ? "led bg-emerald-hud text-emerald-hud" : "bg-muted-foreground/50"
                      )}
                    />
                    {c.statusText || (c.status ? "Active & Linked" : "Offline")}
                  </p>
                  <span className="font-mono text-[10px] text-muted-foreground font-bold">
                    {c.status ? "PORT OPEN" : "STANDBY"}
                  </span>
                </div>

                {/* Google Direct Action Button */}
                {isGoogleCard && (
                  <div className="pt-1">
                    {!isGoogleConnected ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleConnectGoogle}
                          disabled={isAuthenticating}
                          className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Authorize Google</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsConfigOpen(true);
                            setConfigTab("direct");
                          }}
                          title="Direct Token Entry"
                          className="px-3 py-2 neu-inset text-cyan-300 text-xs font-bold rounded-xl hover:bg-cyan-500/10 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsConfigOpen(true);
                            setConfigTab("oauth");
                          }}
                          className="flex-1 py-1.5 neu-inset text-emerald-300 text-[11px] font-bold rounded-lg hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3 text-emerald-400" />
                          <span>Manage</span>
                        </button>
                        <button
                          onClick={handleDisconnectGoogle}
                          className="py-1.5 px-2.5 neu-inset text-rose-400 text-[11px] font-bold rounded-lg hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* LinkedIn Direct Action Button */}
                {isLinkedinCard && (
                  <div className="pt-1">
                    {!linkedinStatus.connected ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleConnectLinkedin}
                          disabled={isLinkedinAuthenticating}
                          className="flex-1 py-2 bg-gradient-to-r from-[#0A66C2] to-sky-600 hover:from-[#004182] hover:to-sky-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isLinkedinAuthenticating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                          <span>Authorize LinkedIn</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsLinkedinConfigOpen(true);
                            setLinkedinTab("oauth_token");
                          }}
                          title="Direct Token Entry"
                          className="px-3 py-2 neu-inset text-sky-300 text-xs font-bold rounded-xl hover:bg-[#0A66C2]/10 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsLinkedinConfigOpen(true);
                            setLinkedinTab("test");
                          }}
                          className="flex-1 py-1.5 neu-inset text-[#388bfd] text-[11px] font-bold rounded-lg hover:bg-[#0A66C2]/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#388bfd]" />
                          <span>Post / Controls</span>
                        </button>
                        <button
                          onClick={handleDisconnectLinkedin}
                          className="py-1.5 px-2.5 neu-inset text-rose-400 text-[11px] font-bold rounded-lg hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* GitHub Direct Action Button */}
                {isGithubCard && (
                  <div className="pt-1">
                    {!githubStatus.connected ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleConnectGithub}
                          disabled={isGithubAuthenticating}
                          className="flex-1 py-2 bg-gradient-to-r from-[#F05032] to-amber-600 hover:from-[#d03e22] hover:to-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isGithubAuthenticating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                          <span>Authorize GitHub</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsGithubConfigOpen(true);
                            setGithubTab("token");
                          }}
                          title="Direct Token Entry"
                          className="px-3 py-2 neu-inset text-[#ff7a64] text-xs font-bold rounded-xl hover:bg-[#F05032]/10 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsGithubConfigOpen(true);
                            setGithubTab("gist");
                          }}
                          className="flex-1 py-1.5 neu-inset text-[#ff7a64] text-[11px] font-bold rounded-lg hover:bg-[#F05032]/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-[#ff7a64]" />
                          <span>Gists / Controls</span>
                        </button>
                        <button
                          onClick={handleDisconnectGithub}
                          className="py-1.5 px-2.5 neu-inset text-rose-400 text-[11px] font-bold rounded-lg hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
