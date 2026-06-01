import { useState, useCallback } from "react";
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        {/* Header */}
        <header className="header">
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
                  <span className="spinner">⟳</span> Analyzing…
                </>
              ) : (
                <>🔍 Analyze</>
              )}
            </button>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="loading-container" id="loading-state">
            <div className="scanner">
              <span className="scanner-icon">🛰️</span>
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
            <div className="error-icon">⚠️</div>
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
                📊 {result.company_name}
              </h2>
              <div className="results-meta">
                <span className="meta-chip">
                  ⏱ {(result.analysis_time_ms / 1000).toFixed(1)}s
                </span>
                <span className="meta-chip">
                  📄 {result.pages_analyzed.length} pages
                </span>
                {result.cached && (
                  <span className="meta-chip cached">
                    ⚡ Cached
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
                <div className="stat-value" style={{ color: "var(--severity-high)", WebkitTextFillColor: "var(--severity-high)" }}>
                  {highCount}
                </div>
                <div className="stat-label">High Severity</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value" style={{ color: "var(--severity-medium)", WebkitTextFillColor: "var(--severity-medium)" }}>
                  {medCount}
                </div>
                <div className="stat-label">Medium</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value" style={{ color: "var(--severity-low)", WebkitTextFillColor: "var(--severity-low)" }}>
                  {lowCount}
                </div>
                <div className="stat-label">Low</div>
              </div>
            </div>

            {/* Friction Points */}
            <div className="section-card" id="friction-points">
              <h2>
                <span className="icon">🔥</span>
                Friction Points Detected
              </h2>
              {result.friction_points.length === 0 ? (
                <div className="no-friction">
                  <div className="check-icon">✅</div>
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
                          📍 {fp.citation}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Outreach Hook */}
            <div className="section-card" id="outreach-hook">
              <h2>
                <span className="icon">✉️</span>
                Personalised Outreach Hook
              </h2>
              <button
                className={`btn-copy ${copied ? "copied" : ""}`}
                onClick={copyHook}
                id="btn-copy-hook"
              >
                {copied ? "✓ Copied!" : "📋 Copy"}
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
                <span className="icon">🌐</span>
                Pages Analyzed
              </h2>
              <div className="pages-list">
                {result.pages_analyzed.map((pageUrl, i) => (
                  <div key={i} className="page-item">
                    <span className="page-icon">
                      {i === 0 ? "🏠" : "📄"}
                    </span>
                    {pageUrl}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
