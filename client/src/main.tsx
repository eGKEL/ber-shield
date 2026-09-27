import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileSearch,
  Landmark,
  Laptop,
  LockKeyhole,
  MousePointer2,
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import "./styles.css";

type Signal = {
  id: string;
  label: string;
  points: number;
  detail: string;
  kind: string;
};
type DemoEvent = {
  id: string;
  time: string;
  title: string;
  description: string;
  signalId?: string;
};
type Scenario = {
  id: string;
  name: string;
  subtitle: string;
  threatType: string;
  user: { name: string; email: string; role: string };
  shipment: {
    id: string;
    origin: string;
    destination: string;
    value: number;
    payment: string;
  };
  signals: Signal[];
  events: DemoEvent[];
  action: "BLOCK" | "INVESTIGATE";
  context: string;
};
type Risk = {
  riskScore: number;
  severity: string;
  activeSignals: Signal[];
  events: DemoEvent[];
  recommendedAction: string;
};
type Report = {
  threatType: string;
  confidence: number;
  summary: string;
  reconstruction: { step: number; text: string }[];
  evidence: { label: string; detail: string }[];
  recommendedAction: string;
  rationale: string;
};
type BrokerMonitor = {
  status: "MONITORING";
  lastChecked: string;
  detection: BrokerDetection | null;
  events: { at: string; title: string; detail: string; points: number }[];
  caseStatus: string | null;
};
type BrokerReview = {
  confidence: number;
  classification: string;
  summary: string;
  evidence: string[];
  recommendedAction: string;
  provider: string;
  model: string;
};
type InvoiceSignal = { id: string; label: string; points: number; detail: string; category: string };
type Invoice = { invoiceNumber: string; shipmentId: string; carrier: string; amount: number; paymentDestination: string; issuedAt: string; deliveryStatus: string };
type InvoiceScenario = { id: string; label: string; description: string; invoice: Invoice };
type InvoiceDetection = { invoice: Invoice; signals: InvoiceSignal[]; riskScore: number; severity: string; recommendation: string; status: string; detectedAt: string; policyTriggered: string; caseId: string; firstSeen: string; lastSeen: string };
type InvoiceMonitor = { status: string; lastChecked: string; detection: InvoiceDetection | null; events: { at: string; title: string; detail: string; points: number }[]; caseStatus: string | null };
type InvoiceReview = { confidence: number; classification: string; summary: string; evidence: string[]; recommendedAction: string; provider: string; model: string };
type Page = 'overview' | 'broker-portal' | 'invoice-intelligence' | 'threat-queue' | 'investigations' | 'activity-log' | 'identity-directory' | 'carrier-controls' | 'integrations';
const pages: Page[] = ['overview', 'broker-portal', 'invoice-intelligence', 'threat-queue', 'investigations', 'activity-log', 'identity-directory', 'carrier-controls', 'integrations'];
const currentPage = (): Page => {
  const value = window.location.hash.replace('#/', '') as Page;
  return pages.includes(value) ? value : 'overview';
};
const api = async (path: string, options?: RequestInit) => {
  const response = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) throw new Error("API request failed");
  return response.json();
};
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const threatMeta: Record<
  string,
  { severity: string; score: number; detected: string; status: string }
> = {
  "account-takeover": {
    severity: "Critical",
    score: 94,
    detected: "Today, 09:41",
    status: "Action required",
  },
  "insider-anomaly": {
    severity: "High",
    score: 79,
    detected: "Today, 02:14",
    status: "Under review",
  },
  "email-payment-fraud": {
    severity: "Critical",
    score: 99,
    detected: "Yesterday, 13:05",
    status: "Action required",
  },
};
function signalIcon(kind: string) {
  return kind === "device" ? (
    <Laptop />
  ) : kind === "identity" ? (
    <UserRound />
  ) : kind === "email" ? (
    <Network />
  ) : (
    <Landmark />
  );
}

function App() {
  const [page, setPage] = useState<Page>(currentPage);
  const [monitor, setMonitor] = useState<BrokerMonitor>({
    status: "MONITORING",
    lastChecked: new Date().toISOString(),
    detection: null,
    events: [],
    caseStatus: null,
  });
  const [liveNotice, setLiveNotice] = useState<BrokerDetection | null>(null);
  const [brokerReview, setBrokerReview] = useState<BrokerReview | null>(null);
  const [analyzingReview, setAnalyzingReview] = useState(false);
  const [actioning, setActioning] = useState(false);
  const latestBrokerDetection = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setPage(currentPage());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (page !== "overview") return;
    let active = true;
    const checkBrokerChanges = async () => {
      try {
        const latest = (await api("/broker/monitor")) as BrokerMonitor;
        if (!active) return;
        setMonitor(latest);
        if (
          latest.detection &&
          latestBrokerDetection.current !== latest.detection.lastSeen
        ) {
          latestBrokerDetection.current = latest.detection.lastSeen;
          setLiveNotice(latest.detection);
          setBrokerReview(null);
        }
      } catch {
        // The next scheduled check will retry.
      }
    };
    void checkBrokerChanges();
    const poll = window.setInterval(checkBrokerChanges, 4000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [page]);

  useEffect(() => {
    if (!liveNotice) return;
    const dismiss = window.setTimeout(() => setLiveNotice(null), 8000);
    return () => window.clearTimeout(dismiss);
  }, [liveNotice]);

  const navigate = (next: Page) => {
    window.location.hash = `#/${next}`;
    setPage(next);
  };
  const generateReview = async () => {
    setAnalyzingReview(true);
    try {
      setBrokerReview((await api("/broker/case/analysis", { method: "POST" })) as BrokerReview);
    } finally {
      setAnalyzingReview(false);
    }
  };
  const takeAction = async (action: "BLOCK" | "ALLOW" | "ESCALATE") => {
    setActioning(true);
    try {
      await api("/broker/case/action", { method: "POST", body: JSON.stringify({ action }) });
      setMonitor((await api("/broker/monitor")) as BrokerMonitor);
    } finally {
      setActioning(false);
    }
  };

  if (page === "broker-portal") {
    return <BrokerPortal onExit={() => navigate("overview")} onOpenInvoices={() => navigate("invoice-intelligence")} />;
  }
  if (page === "invoice-intelligence") {
    return <InvoiceIntelligence onExit={() => navigate("overview")} />;
  }
  if (page !== 'overview') {
    return <OperationsWorkspace page={page} onNavigate={navigate} />;
  }

  const detection = monitor.detection;
  const caseStatus = monitor.caseStatus || "Action required";
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));

  return (
    <div className="enterprise-shell">
      <aside className="app-nav">
        <div className="product">
          <img className="brand-logo" src="/brand/ber-cropped.png" alt="BER" />
          <div><b>BER Shield</b><span>SECURITY OPERATIONS</span></div>
        </div>
        <div className="nav-org">
          <span>PROTECTED ORGANIZATION</span>
          <b>FastFreight Logistics</b>
          <small>Production tenant</small>
        </div>
        <nav>
          <span className="nav-label">SECURITY</span>
          <Nav icon={<Radar />} label="Overview" active onClick={() => navigate("overview")} />
          <Nav icon={<ShieldAlert />} label="Threat Queue" badge={detection ? "1" : undefined} onClick={() => navigate('threat-queue')} />
          <Nav icon={<FileSearch />} label="Investigations" onClick={() => navigate('investigations')} />
          <Nav icon={<Activity />} label="Activity Log" onClick={() => navigate('activity-log')} />
          <span className="nav-label">OPERATIONS</span>
          <Nav icon={<FileSearch />} label="Invoice Intelligence" onClick={() => navigate("invoice-intelligence")} />
          <Nav icon={<Users />} label="Identity Directory" onClick={() => navigate('identity-directory')} />
          <Nav icon={<Landmark />} label="Carrier Controls" onClick={() => navigate('carrier-controls')} />
          <Nav icon={<Network />} label="Integrations" onClick={() => navigate('integrations')} />
        </nav>
        <div className="nav-footer">
          <div><i /> SYSTEM STATUS <b>Operational</b></div>
          <small>Broker change monitor: online<br />US-East production</small>
        </div>
      </aside>

      <section className="app-body">
        <header className="topbar">
          <div className="crumb">SECURITY OPERATIONS <ChevronRight /> BROKER CHANGE MONITOR</div>
          <div className="topbar-info">
            <span><b>ORG</b> FastFreight Logistics</span>
            <span><b>ENV</b> <i className="production-dot" /> Production</span>
            <span className="live-monitoring"><Activity /> Live monitoring</span>
            <div className="investigator"><div>MP</div><span>Maya Patel<small>Senior Investigator</small></span></div>
          </div>
        </header>

        {liveNotice && (
          <aside className="live-change-alert" role="status">
            <ShieldAlert />
            <div>
              <b>Suspicious broker change detected</b>
              <span>{liveNotice.transaction.shipmentId} · {liveNotice.signals.length} new signals · case risk {liveNotice.riskScore}/100</span>
            </div>
            <button onClick={() => setLiveNotice(null)} aria-label="Dismiss alert"><X /></button>
          </aside>
        )}

        <main className="workspace clean-workspace">
          <div className="page-heading">
            <div>
              <p>BROKER ACCOUNT MONITORING</p>
              <h1>Security overview</h1>
              <span>Continuous checks for changes made from authorized broker accounts.</span>
            </div>
            <div className="monitor-check"><Activity /><span>Last checked</span><b>{formatTime(monitor.lastChecked)}</b></div>
          </div>

          {!detection ? (
            <section className="empty-monitor">
              <div className="empty-monitor-icon"><ShieldCheck /></div>
              <div>
                <p>NO ACTIVE SECURITY CASES</p>
                <h2>No suspicious broker changes detected</h2>
                <span>BER Shield is monitoring authorized broker activity. A case will appear here only when a change deviates from approved behavior.</span>
              </div>
              <div className="monitor-summary">
                <div><span>ACTIVE CASES</span><b>0</b></div>
                <div><span>MONITORED ACCOUNTS</span><b>1</b></div>
                <div><span>CHECK STATUS</span><b>Online</b></div>
              </div>
            </section>
          ) : (
            <>
              <section className="panel threat-queue live-queue">
                <div className="panel-title">
                  <div><ShieldAlert /><h2>Active broker security case</h2><span>Created from observed account changes</span></div>
                  <Status label={caseStatus} />
                </div>
                <div className="threat-table">
                  <div className="table-head">
                    <span>Severity</span><span>Identity</span><span>Threat type</span><span>Risk score</span><span>Shipment</span><span>Last seen</span><span>Status</span><span>Action</span>
                  </div>
                  <div className="table-row selected">
                    <span><Severity level={detection.severity} /></span>
                    <span className="identity-cell"><b>{detection.transaction.identity}</b><small>{detection.transaction.email}</small></span>
                    <span>Broker account change anomaly</span>
                    <span className="score-cell">{detection.riskScore}<small>/100</small></span>
                    <span className="mono">{detection.transaction.shipmentId}</span>
                    <span>{formatTime(detection.lastSeen)}</span>
                    <span><Status label={caseStatus} /></span>
                    <span className="row-action">Review <ChevronRight /></span>
                  </div>
                </div>
              </section>

              <section className="incident-header live-incident">
                <div className="incident-eyebrow">
                  <span>{detection.caseId}</span>
                  <span className="case-owner">CASE OWNER <b>Maya Patel</b></span>
                </div>
                <div className="incident-main">
                  <div><h2>Broker account change anomaly</h2><p>Detection source: {detection.policyTriggered}</p></div>
                  <div className="incident-stat"><span>SEVERITY</span><b className={"severity-text " + detection.severity.toLowerCase()}>{detection.severity}</b></div>
                  <div className="incident-stat"><span>CASE RISK SCORE</span><b>{detection.riskScore}<small>/100</small></b></div>
                  <Status label={caseStatus} />
                </div>
              </section>

              <section className="investigation-layout">
                <div className="main-investigation">
                  <section className="panel metadata">
                    <div className="panel-title"><div><FileSearch /><h2>Case details</h2></div><span className="evidence-count">{detection.signals.length} evidence items</span></div>
                    <div className="metadata-grid">
                      <Meta label="Identity" value={detection.transaction.identity} sub={detection.transaction.email} />
                      <Meta label="Role" value="Freight Broker" />
                      <Meta label="Shipment" value={detection.transaction.shipmentId} sub={detection.transaction.origin + " → " + detection.transaction.destination} />
                      <Meta label="Approved value" value={money(detection.transaction.baselineValue)} />
                      <Meta label="First seen" value={formatTime(detection.firstSeen)} sub="Live broker monitor" />
                      <Meta label="Last seen" value={formatTime(detection.lastSeen)} sub="Current case activity" />
                      <Meta label="Policy triggered" value="Account change correlation" />
                      <Meta label="Case status" value={caseStatus} />
                    </div>
                  </section>
                  <section className="panel evidence">
                    <div className="panel-title"><div><CircleAlert /><h2>Correlated signals</h2><span>Only observed deviations are listed</span></div><span className="mono">TOTAL {detection.riskScore}/100</span></div>
                    <div className="evidence-list">
                      {detection.signals.map((signal) => (
                        <div className="evidence-row active" key={signal.id}>
                          <div className="evidence-icon">{signalIcon(signal.category.toLowerCase())}</div>
                          <div><b>{signal.label}</b><span>{signal.detail}</span></div>
                          <strong>+{signal.points}</strong><i>Observed</i>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
                <aside className="investigation-side">
                  <section className="panel event-log live-events">
                    <div className="panel-title"><div><Clock3 /><h2>Live case activity</h2><span>New suspicious changes increase the case risk</span></div><span className="live-badge">LIVE</span></div>
                    <div className="log-table">
                      {monitor.events.map((event, index) => (
                        <div className="log-row" key={event.at + event.title + index}>
                          <time>{formatTime(event.at)}</time><span className="event-dot signal" />
                          <div><b>{event.title}</b><small>{event.detail}</small></div>
                          <code>+{event.points}</code>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="panel response broker-review">
                    <div className="panel-title"><div><Bot /><h2>Investigation Analysis</h2></div><span className="ai-badge">AI-assisted</span></div>
                    {!brokerReview ? (
                      <div className="analysis-empty compact-analysis">
                        <FileSearch />
                        <b>{analyzingReview ? "Reviewing live evidence…" : "Short review available"}</b>
                        <p>Generate a concise analyst summary from the currently correlated broker signals.</p>
                        <button className="secondary-button" disabled={analyzingReview} onClick={generateReview}>{analyzingReview ? "Reviewing…" : "Generate short review"}</button>
                      </div>
                    ) : (
                      <div className="broker-review-result">
                        <span>{brokerReview.classification} · {brokerReview.confidence}% confidence</span>
                        <p>{brokerReview.summary}</p>
                        <b>Recommended: {brokerReview.recommendedAction}</b>
                        <small>{brokerReview.evidence.join(" · ")}</small>
                        <small className="review-provider">Generated by {brokerReview.provider} · {brokerReview.model}</small>
                      </div>
                    )}
                  </section>
                  <section className="panel human-action">
                    <div className="approval"><LockKeyhole /><div><b>Human approval required</b><span>Case risk is cumulative. Review the broker account before any release.</span></div></div>
                    <div className="action-buttons"><button className="block-control" disabled={actioning || caseStatus !== "Action required"} onClick={() => takeAction("BLOCK")}>Block account changes</button><button disabled={actioning || caseStatus !== "Action required"} onClick={() => takeAction("ESCALATE")}>Escalate case</button><button disabled={actioning || caseStatus !== "Action required"} onClick={() => takeAction("ALLOW")}>Allow</button></div>
                    {caseStatus !== "Action required" && <div className="broker-action-result"><Check /> Case {caseStatus.toLowerCase()} by Maya Patel. Audit trail updated.</div>}
                  </section>
                </aside>
              </section>
            </>
          )}
        </main>
      </section>
    </div>
  );
}
function Nav({
  icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {badge && <b>{badge}</b>}
    </button>
  );
}
function OperationsWorkspace({ page, onNavigate }: { page: Exclude<Page, 'overview' | 'broker-portal' | 'invoice-intelligence'>; onNavigate: (page: Page) => void }) {
  const [broker, setBroker] = useState<BrokerMonitor | null>(null);
  const [invoice, setInvoice] = useState<InvoiceMonitor | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  useEffect(() => {
    const refresh = async () => {
      try {
        const [brokerMonitor, invoiceMonitor] = await Promise.all([api('/broker/monitor'), api('/invoices/monitor')]);
        setBroker(brokerMonitor as BrokerMonitor); setInvoice(invoiceMonitor as InvoiceMonitor);
      } catch { /* keep the last available values */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, []);
  const titles: Record<typeof page, { kicker: string; title: string; description: string }> = {
    'threat-queue': { kicker: 'SECURITY OPERATIONS', title: 'Threat Queue', description: 'Prioritized cases requiring investigator attention.' },
    investigations: { kicker: 'SECURITY OPERATIONS', title: 'Investigations', description: 'Active cases with evidence and analyst conclusions.' },
    'activity-log': { kicker: 'SECURITY OPERATIONS', title: 'Activity Log', description: 'Observed broker and invoice security events.' },
    'identity-directory': { kicker: 'IDENTITY OPERATIONS', title: 'Identity Directory', description: 'Authorized logistics identities and their current access state.' },
    'carrier-controls': { kicker: 'PARTNER CONTROLS', title: 'Carrier Controls', description: 'Carrier payment and delivery verification controls.' },
    integrations: { kicker: 'PLATFORM OPERATIONS', title: 'Integrations', description: 'Data sources connected to BER Shield.' },
  };
  const title = titles[page];
  const activeCases = [broker?.detection, invoice?.detection].filter(Boolean);
  const events = [...(broker?.events || []).map((event) => ({ ...event, source: 'Broker monitor' })), ...(invoice?.events || []).map((event) => ({ ...event, source: 'Invoice integrity' }))].sort((a, b) => b.at.localeCompare(a.at));
  const formatTime = (value: string) => new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
  const active = (target: Page) => page === target;
  return <div className="enterprise-shell">
    <aside className="app-nav"><div className="product"><img className="brand-logo" src="/brand/ber-cropped.png" alt="BER" /><div><b>BER Shield</b><span>SECURITY OPERATIONS</span></div></div><div className="nav-org"><span>PROTECTED ORGANIZATION</span><b>FastFreight Logistics</b><small>Production tenant</small></div><nav><span className="nav-label">SECURITY</span><Nav icon={<Radar />} label="Overview" onClick={() => onNavigate('overview')} /><Nav icon={<ShieldAlert />} label="Threat Queue" active={active('threat-queue')} badge={activeCases.length ? String(activeCases.length) : undefined} onClick={() => onNavigate('threat-queue')} /><Nav icon={<FileSearch />} label="Investigations" active={active('investigations')} onClick={() => onNavigate('investigations')} /><Nav icon={<Activity />} label="Activity Log" active={active('activity-log')} onClick={() => onNavigate('activity-log')} /><span className="nav-label">OPERATIONS</span><Nav icon={<FileSearch />} label="Invoice Intelligence" onClick={() => onNavigate('invoice-intelligence')} /><Nav icon={<Users />} label="Identity Directory" active={active('identity-directory')} onClick={() => onNavigate('identity-directory')} /><Nav icon={<Landmark />} label="Carrier Controls" active={active('carrier-controls')} onClick={() => onNavigate('carrier-controls')} /><Nav icon={<Network />} label="Integrations" active={active('integrations')} onClick={() => onNavigate('integrations')} /></nav><div className="nav-footer"><div><i /> SYSTEM STATUS <b>Operational</b></div><small>Broker and invoice monitors: online<br />US-East production</small></div></aside>
    <section className="app-body"><header className="topbar"><div className="crumb">{title.kicker} <ChevronRight /> {title.title.toUpperCase()}</div><div className="topbar-info"><span><b>ORG</b> FastFreight Logistics</span><span><b>ENV</b> <i className="production-dot" /> Production</span><span className="live-monitoring"><Activity /> Live monitoring</span><div className="investigator"><div>MP</div><span>Maya Patel<small>Senior Investigator</small></span></div></div></header><main className="workspace secondary-workspace"><div className="page-heading"><div><p>{title.kicker}</p><h1>{title.title}</h1><span>{title.description}</span></div></div>
      {(page === 'threat-queue' || page === 'investigations') && <section className="secondary-grid">{activeCases.length ? activeCases.map((item) => <section className="panel case-card" key={item!.caseId}><div className="panel-title"><div><ShieldAlert /><h2>{'invoice' in item! ? 'Invoice integrity anomaly' : 'Broker account change anomaly'}</h2></div><Severity level={item!.severity} /></div><div className="case-card-body"><span className="mono">{item!.caseId}</span><b>{'invoice' in item! ? (item as InvoiceDetection).invoice.invoiceNumber : (item as BrokerDetection).transaction.identity}</b><p>{item!.signals.length} correlated findings · risk {item!.riskScore}/100</p><button onClick={() => onNavigate('invoice' in item! ? 'invoice-intelligence' : 'broker-portal')}>Open investigation <ChevronRight /></button></div></section>) : <section className="empty-monitor secondary-empty"><ShieldCheck /><div><p>NO ACTIVE CASES</p><h2>Queue is clear</h2><span>New broker and invoice deviations will appear here automatically.</span></div></section>}{page === 'investigations' && <section className="panel saved-case"><div className="panel-title"><div><FileSearch /><h2>Investigation standard</h2></div></div><div><b>Human decision required</b><span>All detections retain their evidence timeline before any case is blocked, released, or escalated.</span></div></section>}</section>}
      {page === 'activity-log' && <section className="panel operations-log"><div className="panel-title"><div><Clock3 /><h2>Observed activity</h2><span>Live source events</span></div></div>{events.length ? events.map((event, index) => <div className="operation-row" key={event.at + index}><time>{formatTime(event.at)}</time><span className="event-dot signal" /><div><b>{event.title}</b><small>{event.detail}</small></div><em>{event.source}</em><code>+{event.points}</code></div>) : <div className="empty-inline">No security events have been recorded in this session.</div>}</section>}
      {page === 'identity-directory' && <section className="panel directory-table"><div className="panel-title"><div><Users /><h2>Authorized identities</h2><span>Broker and carrier access directory</span></div><button onClick={() => onNavigate('broker-portal')}>Open broker portal</button></div><div className="directory-row head"><span>Identity</span><span>Role</span><span>Access state</span><span>Last activity</span><span>Risk context</span></div><div className="directory-row"><b>John Smith<small>john.smith@fastfreight.test</small></b><span>Freight Broker</span><Status label="Authorized" /><span>Current session</span><span>{broker?.detection ? 'Case linked' : 'No active case'}</span></div><div className="directory-row"><b>Jordan Lee<small>DRV-4817</small></b><span>Driver</span><Status label="Authorized" /><span>Driver chat</span><span>Behavior monitored</span></div><div className="directory-row"><b>Maya Patel<small>maya.patel@fastfreight.test</small></b><span>Senior Investigator</span><Status label="Privileged" /><span>Current session</span><span>Case owner</span></div></section>}
      {page === 'carrier-controls' && <section className="panel directory-table"><div className="panel-title"><div><Landmark /><h2>Carrier verification controls</h2><span>Approved payees and delivery-state checks</span></div><button onClick={() => onNavigate('invoice-intelligence')}>Open invoice intelligence</button></div><div className="directory-row head"><span>Carrier</span><span>Payment destination</span><span>Verification</span><span>Delivery control</span><span>Action</span></div>{[['NorthStar Freight','•••• 1128','Verified','Delivered'],['BlueLine Transport','•••• 4017','Verified','Delivered'],['Continental Haulage','•••• 7091','Verified','In transit']].map(([carrier, payee, verification, delivery]) => <div className="directory-row" key={carrier}><b>{carrier}<small>Approved carrier record</small></b><span>{payee}</span><Status label={verification} /><span>{delivery}</span><button onClick={() => onNavigate('invoice-intelligence')}>Review invoices</button></div>)}</section>}
      {page === 'integrations' && <section className="integration-grid">{[['Broker Portal Event Stream','Authorized broker actions and session telemetry','Connected'],['Invoice Ledger','Approved invoice baseline and payment verification','Connected'],['Local Qwen Investigation','Private incident and invoice summaries','Available']].map(([name, description, status]) => <section className="panel integration-card" key={name}><div><Network /><Status label={status} /></div><h2>{name}</h2><p>{description}</p><button onClick={() => setCheckedAt(new Date().toLocaleTimeString())}>{checkedAt ? `Checked ${checkedAt}` : 'Check connection'}</button></section>)}</section>}
    </main></section>
  </div>;
}
function Severity({ level }: { level: string }) {
  return (
    <span className={"severity-pill " + level.toLowerCase()}>{level}</span>
  );
}
function Status({ label }: { label: string }) {
  return (
    <span className={"status-pill " + label.toLowerCase().replace(/\s+/g, "-")}>
      {label}
    </span>
  );
}
function Meta({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="meta-row">
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function Analysis({ report }: { report: Report }) {
  return (
    <div className="analysis-report">
      <div className="classification">
        <span>THREAT CLASSIFICATION</span>
        <b>{report.threatType}</b>
        <em>{report.confidence}% confidence</em>
      </div>
      <section>
        <span>EXECUTIVE SUMMARY</span>
        <p>{report.summary}</p>
      </section>
      <section>
        <span>ATTACK RECONSTRUCTION</span>
        <ol>
          {report.reconstruction.map((item) => (
            <li key={item.step}>
              <i>{item.step}</i>
              {item.text}
            </li>
          ))}
        </ol>
      </section>
      <section className="recommendation">
        <span>RECOMMENDED RESPONSE</span>
        <b>{report.recommendedAction}</b>
        <p>{report.rationale}</p>
      </section>
    </div>
  );
}
type BrokerTransaction = {
  id: string;
  identity: string;
  email: string;
  shipmentId: string;
  origin: string;
  destination: string;
  baselineValue: number;
  paymentDestination: string;
  knownIp: string;
  knownDevice: string;
  lastApproved: string;
};
type BrokerDetection = {
  riskScore: number;
  severity: string;
  recommendation: string;
  signals: {
    id: string;
    label: string;
    points: number;
    detail: string;
    category: string;
  }[];
  detectedAt: string;
  caseId: string;
  firstSeen: string;
  lastSeen: string;
  policyTriggered: string;
  status: string;
  transaction: BrokerTransaction;
};
type ConversationProfile = {
  id: string;
  channel: string;
  participant: string;
  baseline: string;
  normalTraits: string[];
  suspiciousSamples: { id: string; label: string; message: string }[];
};
type ConversationResult = {
  profile: { id: string; channel: string; participant: string };
  message: string;
  riskScore: number;
  severity: string;
  signals: { id: string; label: string; points: number; detail: string }[];
  confidence: number;
  recommendation: string;
  analysis: string;
  detectedAt: string;
  status: string;
};

type BrokerShipment = { id: string; origin: string; destination: string; value: number; status: string; paymentDestination: string };
type BrokerAccount = { id: string; name: string; email: string; company: string; role: string; lastLogin: string; knownIp: string; knownDevice: string; shipments: BrokerShipment[] };
type BrokerNotice = { message: string; detected: boolean } | null;

const driverMessages = [
  { label: "Normal check-in", text: "Checked in at 09:20. ETA remains 14:30. Please confirm receipt.", suspicious: false },
  { label: "Urgent instruction", text: "Hurry up—skip dispatch confirmation and release it now.", suspicious: true },
  { label: "Delivery change", text: "Please change the delivery instruction ASAP; do not wait for confirmation.", suspicious: true },
];

function InvoiceIntelligence({ onExit }: { onExit: () => void }) {
  const [baseline, setBaseline] = useState<Invoice[]>([]);
  const [monitor, setMonitor] = useState<InvoiceMonitor | null>(null);
  const [review, setReview] = useState<InvoiceReview | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);

  const refresh = async () => setMonitor((await api('/invoices/monitor')) as InvoiceMonitor);
  useEffect(() => {
    api('/invoices/baseline').then((data: { approvedInvoices: Invoice[] }) => setBaseline(data.approvedInvoices));
    void refresh();
    const poll = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(poll);
  }, []);
  const generateReview = async () => {
    setSubmitting('analysis');
    try { setReview((await api('/invoices/case/analysis', { method: 'POST' })) as InvoiceReview); } finally { setSubmitting(null); }
  };
  const action = async (value: 'BLOCK' | 'ALLOW' | 'ESCALATE') => {
    setActioning(true);
    try { await api('/invoices/case/action', { method: 'POST', body: JSON.stringify({ action: value }) }); await refresh(); } finally { setActioning(false); }
  };
  const detection = monitor?.detection;
  const formatTime = (value?: string) => value ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '—';

  return <div className="enterprise-shell invoice-shell">
    <aside className="app-nav invoice-nav">
      <div className="product"><img className="brand-logo" src="/brand/ber-cropped.png" alt="BER" /><div><b>BER Shield</b><span>SECURITY OPERATIONS</span></div></div>
      <div className="nav-org"><span>PROTECTED ORGANIZATION</span><b>FastFreight Logistics</b><small>Production tenant</small></div>
      <nav>
        <span className="nav-label">SECURITY</span>
        <Nav icon={<Radar />} label="Overview" onClick={onExit} />
        <Nav icon={<ShieldAlert />} label="Threat Queue" />
        <Nav icon={<FileSearch />} label="Investigations" />
        <Nav icon={<Activity />} label="Activity Log" />
        <span className="nav-label">OPERATIONS</span>
        <Nav icon={<Landmark />} label="Broker Portal" />
        <Nav icon={<FileSearch />} label="Invoice Intelligence" active />
        <Nav icon={<Users />} label="Identity Directory" />
        <Nav icon={<Landmark />} label="Carrier Controls" />
        <Nav icon={<Network />} label="Integrations" />
      </nav>
      <div className="nav-footer"><div><i /> SYSTEM STATUS <b>Operational</b></div><small>Invoice integrity monitor: online<br />US-East production</small></div>
    </aside>
    <main className="app-body invoice-main">
      <header className="topbar invoice-topbar"><div className="crumb">SECURITY OPERATIONS <ChevronRight /> INVOICE INTELLIGENCE</div><div className="topbar-info"><span><b>ORG</b> FastFreight Logistics</span><span><b>ENV</b> <i className="production-dot" /> Production</span><span className="live-monitoring"><Activity /> Live monitoring</span><div className="investigator"><div>MP</div><span>Maya Patel<small>Senior Investigator</small></span></div></div></header>
      <section className="invoice-workspace">
        <div className="invoice-heading"><div><p>ACCOUNTS PAYABLE SECURITY</p><h1>Invoice Intelligence</h1><span>Detect duplicate billing, payment destination changes, and invoice anomalies before payment.</span></div><div className="invoice-monitor"><Check /> Baseline monitoring active</div></div>
        <section className="invoice-panel invoice-intake">
          <div className="invoice-panel-title"><div><ShieldCheck /><h2>Invoice intake monitor</h2><span>Invoices submitted from authorized broker accounts are checked against the approved ledger before payment.</span></div><b>LIVE</b></div>
          <div className="invoice-intake-content"><FileSearch /><div><b>Waiting for broker invoice submissions</b><span>Duplicate billing, amount changes, bank-account changes, and delivery state are evaluated automatically.</span></div><span className="intake-source">SOURCE: Broker Portal</span></div>
        </section>
        <section className="invoice-panel approved-ledger">
          <div className="invoice-panel-title"><div><Check /><h2>Approved invoice baseline</h2><span>Known good transactions used to validate new submissions.</span></div><b>{baseline.length} APPROVED</b></div>
          <div className="invoice-table"><div className="invoice-table-head"><span>Invoice</span><span>Shipment</span><span>Carrier</span><span>Amount</span><span>Payment destination</span><span>Delivery</span></div>{baseline.map((invoice) => <div className="invoice-table-row" key={invoice.invoiceNumber}><b className="mono">{invoice.invoiceNumber}</b><span className="mono">{invoice.shipmentId}</span><span>{invoice.carrier}</span><strong>{money(invoice.amount)}</strong><span>{invoice.paymentDestination}</span><i>{invoice.deliveryStatus}</i></div>)}</div>
        </section>
        {!detection ? <section className="invoice-empty"><ShieldCheck /><div><p>NO ACTIVE INVOICE CASES</p><h2>Approved invoices are being monitored</h2><span>Submit a demo invoice above to see duplicate and payment-integrity detection.</span></div></section> : <section className="invoice-case-grid">
          <div>
            <section className="invoice-panel invoice-case-header"><div><span>{detection.caseId}</span><h2>Invoice integrity anomaly</h2><p>Detection source: {detection.policyTriggered}</p></div><div><small>SEVERITY</small><b className={'severity-text ' + detection.severity.toLowerCase()}>{detection.severity}</b></div><div><small>CASE RISK SCORE</small><b>{detection.riskScore}<em>/100</em></b></div><Status label={monitor?.caseStatus || 'Payment hold required'} /></section>
            <section className="invoice-panel invoice-details"><div className="invoice-panel-title"><div><FileSearch /><h2>Invoice evidence</h2><span>{detection.signals.length} correlated findings</span></div><span className="mono">TOTAL {detection.riskScore}/100</span></div><div className="invoice-metadata"><Meta label="Invoice" value={detection.invoice.invoiceNumber} sub={detection.invoice.carrier} /><Meta label="Shipment" value={detection.invoice.shipmentId} /><Meta label="Amount" value={money(detection.invoice.amount)} /><Meta label="Payment destination" value={detection.invoice.paymentDestination} /><Meta label="First seen" value={formatTime(detection.firstSeen)} /><Meta label="Case status" value={monitor?.caseStatus || 'Payment hold required'} /></div><div className="invoice-evidence">{detection.signals.map((signal) => <div key={signal.id}><CircleAlert /><span><b>{signal.label}</b><small>{signal.detail}</small></span><strong>+{signal.points}</strong></div>)}</div></section>
          </div>
          <aside>
            <section className="invoice-panel invoice-events"><div className="invoice-panel-title"><div><Clock3 /><h2>Case activity</h2></div><span className="live-badge">LIVE</span></div>{monitor?.events.map((event, index) => <div className="invoice-event" key={event.at + index}><time>{formatTime(event.at)}</time><span><b>{event.title}</b><small>{event.detail}</small></span><code>+{event.points}</code></div>)}</section>
            <section className="invoice-panel invoice-analysis"><div className="invoice-panel-title"><div><Bot /><h2>Investigation Analysis</h2></div><span className="ai-badge">AI-assisted</span></div>{!review ? <div className="invoice-review-empty"><FileSearch /><b>{submitting === 'analysis' ? 'Reviewing invoice evidence…' : 'Short review available'}</b><p>Generate a concise payment-risk assessment from the correlated evidence.</p><button disabled={!!submitting} onClick={generateReview}>{submitting === 'analysis' ? 'Reviewing…' : 'Generate short review'}</button></div> : <div className="invoice-review"><span>{review.classification} · {review.confidence}% confidence</span><p>{review.summary}</p><b>Recommended: {review.recommendedAction}</b><small>{review.evidence.join(' · ')}</small><small>Generated by {review.provider} · {review.model}</small></div>}</section>
            <section className="invoice-panel invoice-actions"><div><LockKeyhole /><span><b>Human approval required</b><small>Payment remains on hold until an investigator acts.</small></span></div><section><button className="block-control" disabled={actioning || monitor?.caseStatus !== 'Payment hold required'} onClick={() => action('BLOCK')}>Block payment</button><button disabled={actioning || monitor?.caseStatus !== 'Payment hold required'} onClick={() => action('ESCALATE')}>Escalate</button><button disabled={actioning || monitor?.caseStatus !== 'Payment hold required'} onClick={() => action('ALLOW')}>Allow</button></section></section>
          </aside>
        </section>}
      </section>
    </main>
  </div>;
}

function BrokerPortal({ onExit, onOpenInvoices }: { onExit: () => void; onOpenInvoices: () => void }) {
  const [account, setAccount] = useState<BrokerAccount | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState<BrokerNotice>(null);
  const [updating, setUpdating] = useState(false);
  const [heatmap, setHeatmap] = useState<number[]>(Array(16).fill(0));
  const [chat, setChat] = useState<{ text: string; suspicious: boolean }[]>([]);
  const [invoiceScenarios, setInvoiceScenarios] = useState<InvoiceScenario[]>([]);

  useEffect(() => {
    api('/broker/account').then((data: BrokerAccount) => {
      setAccount(data);
      setSelectedId(data.shipments[0]?.id || '');
    });
  }, []);
  useEffect(() => {
    api('/invoices/baseline').then((data: { scenarios: InvoiceScenario[] }) => setInvoiceScenarios(data.scenarios));
  }, []);

  const selected = account?.shipments.find((item) => item.id === selectedId);
  const showResult = (result: { detection: { status: string; riskScore: number; signals: { length: number }[] } }) =>
    setNotice({
      message: result.detection.status === 'DETECTED'
        ? `${result.detection.signals.length} behavioral/policy signals detected · case risk ${result.detection.riskScore}/100`
        : 'Activity matches the approved baseline.',
      detected: result.detection.status === 'DETECTED',
    });

  const apply = async (type: 'value' | 'payment' | 'status') => {
    if (!selected) return;
    setUpdating(true);
    setNotice(null);
    const payload = type === 'value' ? { value: 84000 } : type === 'payment' ? { paymentDestination: 'New account ·•••• 8842' } : { status: 'Tender released' };
    try {
      const result = await api(`/broker/shipments/${selected.id}/update`, { method: 'POST', body: JSON.stringify(payload) });
      setAccount((previous) => previous ? { ...previous, shipments: previous.shipments.map((item) => item.id === result.shipment.id ? result.shipment : item) } : previous);
      showResult(result);
    } finally {
      setUpdating(false);
    }
  };

  const simulateClicks = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      const result = await api('/broker/session/interaction', { method: 'POST', body: JSON.stringify({ shipmentId: selected.id }) });
      setHeatmap(result.heatmap);
      showResult(result);
    } finally {
      setUpdating(false);
    }
  };

  const sendDriverMessage = async (choice: typeof driverMessages[number]) => {
    if (!selected) return;
    setUpdating(true);
    setChat((messages) => [...messages, { text: choice.text, suspicious: choice.suspicious }]);
    try {
      const result = await api('/broker/driver-chat', { method: 'POST', body: JSON.stringify({ shipmentId: selected.id, message: choice.text }) });
      showResult(result);
    } finally {
      setUpdating(false);
    }
  };
  const submitInvoice = async (scenario: InvoiceScenario) => {
    setUpdating(true);
    setNotice(null);
    try {
      const result = await api('/invoices/submit', { method: 'POST', body: JSON.stringify({ scenarioId: scenario.id }) });
      const detection = result.detection as InvoiceDetection;
      setNotice({ message: `${scenario.invoice.invoiceNumber} was submitted. BER Shield created an invoice case with ${detection.signals.length} findings and risk ${detection.riskScore}/100.`, detected: detection.status === 'DETECTED' });
    } finally { setUpdating(false); }
  };

  if (!account) return <div className="loading">Loading broker account…</div>;

  return (
    <div className="broker-shell">
      <header className="broker-topbar">
        <div className="broker-brand"><img src="/brand/ber-cropped.png" alt="BER" /><span>Broker workspace</span></div>
        <div className="broker-top-actions"><span className="ber-connected"><Check /> BER Shield protected</span><button onClick={onExit}>Open BER Shield</button><div className="broker-avatar">JS</div></div>
      </header>
      <aside className="broker-nav">
        <div className="broker-company"><b>{account.company}</b><small>Transportation management</small></div>
        <button className="selected"><Landmark /> Shipments</button><button><Users /> Carriers</button><button><Activity /> Activity</button><button><FileSearch /> Documents</button>
        <div className="broker-support">Signed in as<br /><b>{account.name}</b><small>{account.role}</small></div>
      </aside>
      <main className="broker-main">
        <div className="broker-heading">
          <div><p>BROKER OPERATIONS</p><h1>Shipment workspace</h1><span>Authorized account activity · {account.name}</span></div>
          <div className="account-trust"><Check /><div><b>Account authorized</b><small>Identity verified by BER Shield</small></div></div>
        </div>

        {notice && <section className={'broker-notice ' + (notice.detected ? 'detected' : '')}><ShieldAlert /><div><b>{notice.detected ? 'BER Shield detection created' : 'Activity submitted'}</b><span>{notice.message}</span></div>{notice.detected && <button onClick={notice.message.includes('invoice') ? onOpenInvoices : onExit}>Review in BER Shield <ChevronRight /></button>}</section>}

        <div className="broker-layout">
          <section className="broker-card shipment-list">
            <div className="broker-card-title"><h2>Open shipments</h2><span>{account.shipments.length} active</span></div>
            {account.shipments.map((shipment) => <button key={shipment.id} className={shipment.id === selectedId ? 'selected' : ''} onClick={() => { setSelectedId(shipment.id); setNotice(null); }}><div><b>{shipment.id}</b><small>{shipment.origin} → {shipment.destination}</small></div><span>{money(shipment.value)}</span><i>{shipment.status}</i></button>)}
          </section>
          <section className="broker-card shipment-detail">
            <div className="broker-card-title"><div><h2>{selected?.id}</h2><span>{selected?.origin} → {selected?.destination}</span></div><i>{selected?.status}</i></div>
            <div className="broker-data"><div><span>SHIPMENT VALUE</span><b>{money(selected?.value || 0)}</b></div><div><span>PAYMENT DESTINATION</span><b>{selected?.paymentDestination}</b></div><div><span>ACCOUNT OWNER</span><b>{account.name}</b></div><div><span>ACTIVE SESSION</span><b>{account.knownIp}</b><small>{account.knownDevice}</small></div></div>
            <div className="broker-actions"><span>Shipment controls</span><p>These are regular broker controls. BER Shield checks each change against approved activity.</p><div><button disabled={updating} onClick={() => apply('value')}>Update value to $84,000</button><button disabled={updating} onClick={() => apply('payment')}>Change payment destination</button><button disabled={updating} onClick={() => apply('status')}>Release tender</button></div></div>
          </section>
        </div>

        <div className="broker-behavior-grid">
          <section className="broker-card behavior-card">
            <div className="broker-card-title"><div><h2>Session interaction telemetry</h2><span>Behavioral session baseline</span></div><span className={heatmap.some(Boolean) ? 'behavior-status attention' : 'behavior-status'}>{heatmap.some(Boolean) ? 'Anomaly observed' : 'Monitored'}</span></div>
            <div className="telemetry-summary"><div><span>CONTROLS VISITED</span><b>{heatmap.some(Boolean) ? '12' : '4'}</b><small>{heatmap.some(Boolean) ? 'outside expected sequence' : 'approved workflow'}</small></div><div><span>INPUT CADENCE</span><b>{heatmap.some(Boolean) ? '2.6s' : '14.8s'}</b><small>{heatmap.some(Boolean) ? 'rapid interaction burst' : 'normal session pace'}</small></div><div><span>BURST SCORE</span><b>{heatmap.some(Boolean) ? 'High' : 'Low'}</b><small>{heatmap.some(Boolean) ? '46 events in 18 seconds' : 'no behavior deviation'}</small></div></div>
            <div className={'heatmap telemetry-map ' + (heatmap.some(Boolean) ? 'anomaly' : '')}><div><b>Control interaction distribution</b><small>{heatmap.some(Boolean) ? 'A concentrated interaction burst was recorded across unrelated controls.' : 'Activity is evenly distributed across the broker workflow.'}</small></div><div className="heatmap-grid">{heatmap.map((value, index) => <i key={index} style={{ opacity: value ? Math.min(0.25 + value / 7, 1) : 0.12 }} />)}</div></div>
            <button className="telemetry-action" disabled={updating || heatmap.some(Boolean)} onClick={simulateClicks}><MousePointer2 />{heatmap.some(Boolean) ? 'Interaction anomaly recorded' : 'Record unusual interaction pattern'}<span>{heatmap.some(Boolean) ? 'Sent to BER Shield' : 'Session event'}</span></button>
          </section>
          <section className="broker-card driver-chat">
            <div className="broker-card-title"><div><h2>Driver chat</h2><span>Jordan Lee · DRV-4817</span></div><span className="behavior-status">Live</span></div>
            <div className="chat-window"><div className="driver-message">Jordan: “Arrived at pickup. Loading is in progress.”</div>{chat.map((message, index) => <div key={index} className={'broker-message ' + (message.suspicious ? 'suspicious' : '')}>You: “{message.text}”</div>)}</div>
            <div className="chat-options"><span>Quick messages</span><div>{driverMessages.map((choice) => <button key={choice.label} disabled={updating} onClick={() => sendDriverMessage(choice)}>{choice.label}</button>)}</div></div>
          </section>
        </div>

        <section className="broker-card broker-invoices"><div className="broker-card-title"><div><h2>Invoice submission</h2><span>Send carrier invoices to Accounts Payable</span></div><span className="behavior-status">BER Shield protected</span></div><div className="broker-invoice-intro"><FileSearch /><span>Choose a prepared invoice for the demo. Every submission is sent to BER Shield’s financial-integrity monitor.</span></div><div className="broker-invoice-options">{invoiceScenarios.map((scenario) => <button key={scenario.id} disabled={updating} onClick={() => submitInvoice(scenario)}><b>{scenario.label.replace('Submit ', '')}</b><span>{scenario.invoice.invoiceNumber} · {money(scenario.invoice.amount)}</span><small>{scenario.description}</small></button>)}</div></section>

        <section className="broker-card broker-audit"><div className="broker-card-title"><h2>Account activity</h2><span>Current authorized session</span></div><div><span>08:12:03</span><p>John Smith signed in from recognized location <b>{account.knownIp}</b></p></div><div><span>08:14:11</span><p>Opened shipment <b>{selected?.id}</b></p></div><div><span>08:15:42</span><p>BER Shield session protection validated</p></div></section>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
