import { useState, useCallback, useEffect } from "react";
import Head from "next/head";

interface FrictionPoint {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  detail: string;
  citation: string;
}

interface AnalyzeResult {
  url: string;
  company_name: string;
  pages_analyzed: string[];
  friction_points: FrictionPoint[];
  hook_text: string;
  citations: string[];
  cached: boolean;
  analysis_time_ms: number;
  error?: string;
}

const LOADING_STEPS = [
  "Checking robots.txt…",
  "Scraping homepage…",
  "Discovering internal pages…",
  "Fetching internal pages…",
  "Running heuristic checks…",
  "Analyzing friction signals…",
  "Generating outreach hook…",
  "Finalizing report…",
];

/* ─── Premium SVG Icons ─────────────────────────────────────────────────── */

const IconSun = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M5.25 12H3m18 0h-2.25m-2.813-6.188-1.59 1.59M6.827 17.173l-1.59 1.59m12.728 0-1.59-1.59M6.827 6.827l-1.59-1.59M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
  </svg>
);

const IconMoon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
  </svg>
);

const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: "1.2em", height: "1.2em" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
  </svg>
);

const IconSpinner = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: "1.1em", height: "1.1em" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const IconRadar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "40px", height: "40px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h.008v.008H12V12Z" />
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "36px", height: "36px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

const IconChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);

const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "12px", height: "12px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const IconDocument = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "12px", height: "12px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const IconLightning = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "12px", height: "12px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
  </svg>
);

const IconFlame = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "14px", height: "14px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z" />
  </svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "32px", height: "32px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const IconPin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "10px", height: "10px", display: "inline-block", verticalAlign: "middle" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
  </svg>
);

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "14px", height: "14px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
  </svg>
);

const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "12px", height: "12px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.47m8.53 10.5H18.75a1.125 1.125 0 0 0 1.125-1.125V11.25m-1.5-6h-.75A1.05 1.05 0 0 0 16.5 4.5v-.75a1.05 1.05 0 0 0-1.05-1.05h-2.1a1.05 1.05 0 0 0-1.05 1.05v.75c0 .58.47 1.05 1.05 1.05h.75m.75 0H16.5M16.5 4.5v6H12v-6h4.5M12 18.75h3.75m-3.75-3h3.75" />
  </svg>
);

const IconGlobe = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "14px", height: "14px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9s2.015-9 4.5-9m0 0a9.004 9.004 0 0 1 8.716 6.747M12 3a9.004 9.004 0 0 0-8.716 6.747M3.284 14.25H20.716M3.284 9.75H20.716" />
  </svg>
);

const IconHome = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "14px", height: "14px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const IconDocumentItem = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "14px", height: "14px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const IconExternalLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="page-item-arrow" style={{ width: "12px", height: "12px" }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

/* ─── Main Page Component ───────────────────────────────────────────────── */

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sync theme on mount and when changed
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      setTheme(systemTheme);
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const analyze = useCallback(async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep(0);

    // Simulate step progression
    const interval = setInterval(() => {
      setLoadingStep((prev) =>
        prev < LOADING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 2500);

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Analysis failed");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, [url]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      analyze();
    }
  };

  const copyHook = () => {
    if (result?.hook_text) {
      navigator.clipboard.writeText(result.hook_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const highCount = result?.friction_points.filter(
    (f) => f.severity === "high"
  ).length || 0;
  const medCount = result?.friction_points.filter(
    (f) => f.severity === "medium"
  ).length || 0;
  const lowCount = result?.friction_points.filter(
    (f) => f.severity === "low"
  ).length || 0;

  return (
    <>
      <Head>
        <title>Friction Sniffer — B2B Website Friction Analyzer</title>
        <meta
          name="description"
          content="Detect website friction points and generate personalised B2B outreach hooks automatically."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔍</text></svg>" />
      </Head>

      <div className="bg-mesh" />

      <div className="container">
        {/* Theme Toggle Button */}
        <div className="theme-toggle-container">
          <button 
            className="btn-theme-toggle" 
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
        </div>

        {/* Header Card */}
        <header className="header-card">
          <div className="header-badge">
            <span className="dot" />
            B2B Outreach Intelligence
          </div>
          <h1>Friction Sniffer</h1>
          <p>
            Paste a company URL to detect conversion friction — missing chat,
            no booking, stale content, slow pages, weak CTAs — and get a
            personalised outreach hook in seconds.
          </p>
        </header>

        {/* Input */}
        <section className="input-section" id="analyze-input">
          <div className="input-wrapper">
            <input
              id="url-input"
              type="url"
              placeholder="https://company-website.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="url"
              spellCheck={false}
            />
            <button
              id="btn-analyze"
              className="btn-analyze"
              onClick={analyze}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner"><IconSpinner /></span> Analyzing…
                </>
              ) : (
                <>
                  <IconSearch /> Analyze
                </>
              )}
            </button>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="loading-container" id="loading-state">
            <div className="scanner">
              <span className="scanner-icon"><IconRadar /></span>
            </div>
            <p className="loading-text">
              Scanning website for friction signals
              <span className="loading-dots" />
            </p>
            <p className="loading-step">{LOADING_STEPS[loadingStep]}</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="error-container" id="error-state">
            <div className="error-icon"><IconAlert /></div>
            <h3>Analysis Failed</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="results" id="results-section">
            {/* Results Header */}
            <div className="results-header">
              <h2 className="results-title">
                <IconChart /> {result.company_name}
              </h2>
              <div className="results-meta">
                <span className="meta-chip">
                  <IconClock /> {(result.analysis_time_ms / 1000).toFixed(1)}s
                </span>
                <span className="meta-chip">
                  <IconDocument /> {result.pages_analyzed.length} pages
                </span>
                {result.cached && (
                  <span className="meta-chip cached">
                    <IconLightning /> Cached
                  </span>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="summary-bar" id="summary-stats">
              <div className="summary-stat">
                <div className="stat-value">
                  {result.friction_points.length}
                </div>
                <div className="stat-label">Total Issues</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value" style={{ color: "var(--severity-high)" }}>
                  {highCount}
                </div>
                <div className="stat-label">High Severity</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value" style={{ color: "var(--severity-medium)" }}>
                  {medCount}
                </div>
                <div className="stat-label">Medium</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value" style={{ color: "var(--severity-low)" }}>
                  {lowCount}
                </div>
                <div className="stat-label">Low</div>
              </div>
            </div>

            {/* Friction Points */}
            <div className="section-card" id="friction-points">
              <h2>
                <span className="icon"><IconFlame /></span>
                Friction Points Detected
              </h2>
              {result.friction_points.length === 0 ? (
                <div className="no-friction">
                  <div className="check-icon"><IconCheck /></div>
                  <p>
                    No major friction points detected — this site is
                    well-optimized!
                  </p>
                </div>
              ) : (
                <div className="friction-list">
                  {result.friction_points
                    .sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return order[a.severity] - order[b.severity];
                    })
                    .map((fp, i) => (
                      <div
                        key={`${fp.id}-${i}`}
                        className={`friction-item ${fp.severity}`}
                        id={`friction-${fp.id}`}
                      >
                        <div className="friction-header">
                          <span
                            className={`severity-badge ${fp.severity}`}
                          >
                            {fp.severity}
                          </span>
                          <span className="friction-label">{fp.label}</span>
                        </div>
                        <p className="friction-detail">{fp.detail}</p>
                        <span className="friction-citation">
                          <IconPin /> {fp.citation}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Outreach Hook */}
            <div className="section-card" id="outreach-hook">
              <h2>
                <span className="icon"><IconMail /></span>
                Personalised Outreach Hook
              </h2>
              <button
                className={`btn-copy ${copied ? "copied" : ""}`}
                onClick={copyHook}
                id="btn-copy-hook"
              >
                {copied ? "✓ Copied!" : <><IconCopy /> Copy</>}
              </button>
              <div className="hook-content">
                <p className="hook-text">{result.hook_text}</p>
              </div>
              {result.citations.length > 0 && (
                <div className="hook-citations">
                  <h3>Based on</h3>
                  <div className="citation-list">
                    {result.citations.map((c, i) => (
                      <span key={i} className="citation-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pages Analyzed */}
            <div className="section-card" id="pages-analyzed">
              <h2>
                <span className="icon"><IconGlobe /></span>
                Pages Analyzed
              </h2>
              <div className="pages-list">
                {result.pages_analyzed.map((pageUrl, i) => (
                  <a
                    key={i}
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="page-item"
                  >
                    <span className="page-icon">
                      {i === 0 ? <IconHome /> : <IconDocumentItem />}
                    </span>
                    <span className="page-item-url">{pageUrl}</span>
                    <IconExternalLink />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
