import { useState, useEffect } from "react";
import { Plug, CheckCircle, ExternalLink, RefreshCw, LogOut, Settings, ShieldCheck, Mail, Calendar, FileText, CheckSquare, HardDrive, Loader2 } from "lucide-react";
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
  const { pushLog, pushNotification, googleAccessToken, setGoogleAccessToken, connectionState } = useJarvis();
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem("g_client_id") || DEFAULT_CLIENT_ID);
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem("g_user_email") || "");
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("g_user_name") || "");
  const [userPicture, setUserPicture] = useState<string>(() => localStorage.getItem("g_user_picture") || "");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loading, setLoading] = useState(false);

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
      id: "c2",
      name: "Playwright Browser Automation",
      desc: "Headless web crawling, DOM extraction, and autonomous form execution plugin.",
      status: true,
      color: "var(--pink-hud)",
      category: "Web & Network Plugin",
      statusText: "Active & Available",
    },
  ]);

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
      }
    } catch {
      // Userinfo fetch failure is non-fatal
    }
  };

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
      toast.error("Google Identity Services SDK is loading. Please wait a moment and try again.");
      return;
    }

    setIsAuthenticating(true);
    try {
      const tokenClient = gsi.initTokenClient({
        client_id: trimmedId,
        scope: GOOGLE_SCOPES,
        callback: async (response: any) => {
          setIsAuthenticating(false);
          if (response.access_token) {
            const token = response.access_token;
            setGoogleAccessToken(token);
            localStorage.setItem("g_access_token", token);
            fetch("/api/workspace/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            }).catch(() => {});
            await fetchGoogleUserInfo(token);

            pushLog("Google Workspace account connected successfully for all agent personas.");
            pushNotification("🌐", "Google Workspace access granted to all agents.");
            toast.success("Google Workspace authorized for all agents!");
            pollRealStatuses();
          } else if (response.error) {
            toast.error(`Google Authentication Error: ${response.error}`);
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch (err: any) {
      setIsAuthenticating(false);
      toast.error(err.message || "Failed to initialize Google OAuth");
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

  useEffect(() => {
    pollRealStatuses();
  }, [googleAccessToken]);

  const onlineCount = connectors.filter((c) => c.status).length;

  const toggle = (id: string) => {
    if (id === "c1" && !isGoogleConnected) {
      handleConnectGoogle();
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
            Model Context Protocol (MCP) and autonomous tool plugins integrated into the JARVIS co-pilot.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Google Connect Button */}
          {isGoogleConnected ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleConnectGoogle}
                title="Refresh Google authorization"
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
          )}

          {/* Client ID settings toggle */}
          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            title="Configure Google OAuth Client ID"
            className="key grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-cyan-hud cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Google OAuth Client ID Configuration Popout */}
      {isConfigOpen && (
        <div className="animate-rise-in mb-4 neu rounded-2xl p-4 flex flex-col gap-3 border border-cyan-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Google OAuth 2.0 Client ID Configuration
            </span>
            <span className="text-[10px] text-muted-foreground">Authorized JavaScript origins: window.location.origin</span>
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
                setIsConfigOpen(false);
              }}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Client ID
            </button>
          </div>
        </div>
      )}

      {/* Connectors Grid */}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(18.5rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {connectors.map((c) => {
          const isGoogleCard = c.id === "c1";

          return (
            <article
              key={c.id}
              className={cn(
                "neu gloss animate-rise-in rounded-2xl p-4 flex flex-col justify-between transition-all",
                isGoogleCard && isGoogleConnected && "border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
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

                {/* Google Workspace Supported Badges */}
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

                {/* Google Workspace Direct Action Button inside Card */}
                {isGoogleCard && (
                  <div className="pt-1">
                    {!isGoogleConnected ? (
                      <button
                        onClick={handleConnectGoogle}
                        disabled={isAuthenticating}
                        className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path
                            fill="#FFFFFF"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#FFFFFF"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FFFFFF"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#FFFFFF"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Authorize Google Account</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleConnectGoogle}
                          className="flex-1 py-1.5 neu-inset text-emerald-300 text-[11px] font-bold rounded-lg hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3 text-emerald-400" />
                          <span>Refresh Token</span>
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
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
