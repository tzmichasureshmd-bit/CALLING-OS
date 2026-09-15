import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, Play, Pause, Square, Sparkles, Loader2, AlertCircle,
  CheckCircle2, RefreshCw, Search, Filter, ChevronDown, Brain,
  Clock, Phone, User, Wifi, WifiOff, FileAudio, XCircle,
} from "lucide-react";
import {
  PageContainer, Card, CardHeader, Badge, EmptyState,
  Button, LoadingState, ErrorState, SearchInput, Pagination,
} from "../components/ui.jsx";
import { formatDuration, formatDateTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { callsApi, transcriptsApi } from "../api/resources.js";
import client from "../api/client.js";

// ── Recording status helpers ──────────────────────────────────────────────────
const REC_STATUS = {
  not_available: { label: "Not Available", tone: "neutral", icon: XCircle },
  queued:        { label: "Queued",         tone: "info",    icon: Clock },
  uploading:     { label: "Uploading",      tone: "info",    icon: Loader2 },
  uploaded:      { label: "Uploaded",       tone: "success", icon: CheckCircle2 },
  failed:        { label: "Upload Failed",  tone: "danger",  icon: AlertCircle },
};

const TX_STATUS = {
  pending:    { label: "Pending",          tone: "neutral" },
  processing: { label: "Transcribing…",   tone: "info" },
  completed:  { label: "Transcribed",      tone: "success" },
  failed:     { label: "Failed",           tone: "danger" },
};

const SUM_STATUS = {
  processing: { label: "Summarizing…",  tone: "info" },
  completed:  { label: "Summary Ready", tone: "success" },
  failed:     { label: "Summary Failed",tone: "danger" },
};

// ── Poll transcript status every 8s while processing ─────────────────────────
function usePollTranscript(id, active) {
  const [result, setResult] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!active || !id) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await client.get(`/transcripts/${id}`);
        const { transcript_status, transcript_text, transcript_error,
                summary_status, summary_text, summary_data } = res.data;
        if (cancelled) return;
        if (transcript_status === "completed" || transcript_status === "failed") {
          setResult({ transcript_status, transcript_text, transcript_error,
                      summary_status, summary_text, summary_data });
        } else {
          timer.current = setTimeout(poll, 8000);
        }
      } catch {
        if (!cancelled) setResult({ transcript_status: "failed", transcript_text: null });
      }
    }

    timer.current = setTimeout(poll, 8000);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [id, active]);

  return result;
}

// ── Real audio player with signed URL fetch ───────────────────────────────────
function AudioPlayer({ callId, hasRecording, recordingStatus }) {
  const [state, setState] = useState("idle"); // idle|loading|playing|paused|error
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const audioRef = useRef(null);

  // Fetch a fresh signed URL every time play is requested
  async function fetchSignedUrl() {
    setState("loading");
    setErrorMsg(null);
    try {
      const data = await callsApi.getRecordingUrl(callId);
      if (!data?.signed_url) throw new Error("No signed URL returned");
      setSignedUrl(data.signed_url);
      return data.signed_url;
    } catch (e) {
      const msg = e?.message || "Could not load recording";
      setState("error");
      setErrorMsg(msg);
      return null;
    }
  }

  async function handlePlay() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("paused");
      return;
    }
    if (state === "paused" && audioRef.current) {
      audioRef.current.play();
      setState("playing");
      return;
    }
    const url = await fetchSignedUrl();
    if (!url) return;
  }

  function handleStop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState("idle");
    setProgress(0);
  }

  // When signedUrl changes, start playing
  useEffect(() => {
    if (!signedUrl || !audioRef.current) return;
    audioRef.current.src = signedUrl;
    audioRef.current.play().then(() => setState("playing")).catch((e) => {
      setState("error");
      setErrorMsg(e.message || "Playback failed");
    });
  }, [signedUrl]);

  if (!hasRecording || recordingStatus === "not_available") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
        <XCircle size={13} /> Recording not available
      </div>
    );
  }
  if (recordingStatus !== "uploaded") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
        <Clock size={13} /> {REC_STATUS[recordingStatus]?.label || recordingStatus}
      </div>
    );
  }

  const isPlaying = state === "playing";
  const isLoading = state === "loading";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress(a.currentTime / a.duration);
        }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setState("idle"); setProgress(0); }}
        onError={() => {
          setState("error");
          setErrorMsg("Playback error — the signed URL may have expired");
        }}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={handlePlay}
          disabled={isLoading}
          style={{
            width: 34, height: 34, borderRadius: 9, border: "none",
            background: "var(--accent-soft)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: isLoading ? "wait" : "pointer", flexShrink: 0,
          }}
        >
          {isLoading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
            : isPlaying ? <Pause size={15} />
            : <Play size={15} />}
        </button>

        {(isPlaying || state === "paused") && (
          <button
            onClick={handleStop}
            style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Square size={12} />
          </button>
        )}

        {/* Progress bar */}
        {(isPlaying || state === "paused") && (
          <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: "var(--accent)", transition: "width 0.5s linear" }} />
          </div>
        )}

        {duration > 0 && (
          <span style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
            {formatDuration(Math.round(progress * duration))} / {formatDuration(Math.round(duration))}
          </span>
        )}
      </div>

      {state === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--danger)" }}>
          <AlertCircle size={12} /> {errorMsg}
          <button onClick={handlePlay} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Retry</button>
        </div>
      )}
    </div>
  );
}

// ── AI Summary display ────────────────────────────────────────────────────────
function SummaryPanel({ summaryStatus, summaryText, summaryData, callId, onRefresh }) {
  const [expanded, setExpanded] = useState(false);

  if (!summaryStatus) return null;

  if (summaryStatus === "processing") {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
        <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
        Generating AI summary…
      </div>
    );
  }

  if (summaryStatus === "failed") {
    return (
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--danger)" }}>
        <AlertCircle size={12} /> Summary failed
        <button onClick={() => client.post(`/transcripts/${callId}/summarize/retry`).then(onRefresh)} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Retry</button>
      </div>
    );
  }

  if (summaryStatus !== "completed") return null;

  const data = summaryData;
  const sentimentColor = { positive: "var(--success)", neutral: "var(--text-muted)", negative: "var(--danger)" }[data?.sentiment] || "var(--text-muted)";
  const leadColor = { hot: "var(--danger)", warm: "var(--warning)", cold: "var(--info)", not_a_lead: "var(--text-dim)" }[data?.lead_quality] || "var(--text-muted)";

  return (
    <div style={{ marginTop: 10, background: "var(--bg-subtle, var(--bg-card))", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
          <Brain size={13} color="var(--accent)" /> AI Summary
          <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 400 }}>
            {data?.ai_generated ? "(AI)" : "(rule-based)"}
          </span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {data?.sentiment && <span style={{ fontSize: 11, color: sentimentColor, fontWeight: 600 }}>{data.sentiment}</span>}
          {data?.lead_quality && <span style={{ fontSize: 11, color: leadColor, fontWeight: 600 }}>{data.lead_quality}</span>}
          <ChevronDown size={13} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 12px 12px", fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {summaryText && <p style={{ margin: "0 0 8px" }}>{summaryText}</p>}
          {data?.discussion_points?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: "var(--text-primary)" }}>Discussion:</strong>
              <ul style={{ margin: "2px 0 0 16px", padding: 0 }}>{data.discussion_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {data?.follow_up_actions?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: "var(--text-primary)" }}>Follow-up:</strong>
              <ul style={{ margin: "2px 0 0 16px", padding: 0 }}>{data.follow_up_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {data?.suggested_next_step && (
            <div style={{ marginBottom: 6 }}>
              <strong style={{ color: "var(--text-primary)" }}>Next step:</strong> {data.suggested_next_step}
            </div>
          )}
          {data?.keywords?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {data.keywords.map((k, i) => (
                <span key={i} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)" }}>{k}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Single call row ───────────────────────────────────────────────────────────
function TranscriptRow({ c, onDone }) {
  const [txStatus, setTxStatus]     = useState(c.transcriptStatus || "pending");
  const [txText, setTxText]         = useState(c.transcriptText || null);
  const [txError, setTxError]       = useState(c.transcriptError || null);
  const [sumStatus, setSumStatus]   = useState(c.summaryStatus || null);
  const [sumText, setSumText]       = useState(c.summaryText || null);
  const [sumData, setSumData]       = useState(c.summaryData || null);
  const [polling, setPolling]       = useState(false);

  const pollResult = usePollTranscript(c.id, polling);

  useEffect(() => {
    if (!pollResult) return;
    setPolling(false);
    setTxStatus(pollResult.transcript_status);
    setTxText(pollResult.transcript_text);
    setTxError(pollResult.transcript_error);
    if (pollResult.summary_status) setSumStatus(pollResult.summary_status);
    if (pollResult.summary_text)   setSumText(pollResult.summary_text);
    if (pollResult.summary_data) {
      try { setSumData(JSON.parse(pollResult.summary_data)); } catch {}
    }
    if (pollResult.transcript_status === "completed") onDone?.();
  }, [pollResult]);

  // Auto-start polling if already processing on mount
  useEffect(() => {
    if (txStatus === "processing") setPolling(true);
  }, []);

  async function handleTranscribe() {
    setTxStatus("processing");
    setTxError(null);
    setPolling(false);
    try {
      const res = await client.post(`/transcripts/${c.id}/transcribe`);
      const { status, transcript } = res.data;
      if (status === "completed") {
        setTxStatus("completed");
        setTxText(transcript);
        setPolling(false);
      } else if (status === "processing") {
        setPolling(true);
      } else {
        setTxStatus("failed");
      }
    } catch (err) {
      const detail = err?.message || err?.response?.data?.detail;
      setTxStatus("failed");
      setTxError(detail || "Request failed");
    }
  }

  async function handleRetry() {
    setTxStatus("processing");
    setTxText(null);
    setTxError(null);
    setPolling(false);
    try {
      await client.post(`/transcripts/${c.id}/transcribe/retry`);
      setPolling(true);
    } catch (err) {
      setTxStatus("failed");
      setTxError(err?.message || "Retry failed");
    }
  }

  const isDone       = txStatus === "completed";
  const isFailed     = txStatus === "failed";
  const isProcessing = txStatus === "processing";
  const recStatus    = c.recordingStatus || "not_available";
  const txMeta       = TX_STATUS[txStatus] || TX_STATUS.pending;

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 12, padding: 14,
      borderLeftWidth: isDone ? 3 : isFailed ? 3 : 1,
      borderLeftColor: isDone ? "var(--success)" : isFailed ? "var(--danger)" : "var(--border)",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Audio player */}
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <AudioPlayer callId={c.id} hasRecording={c.hasRecording} recordingStatus={recStatus} />
        </div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={12} />{c.contact}</span>
            <span style={{ color: "var(--accent)", fontWeight: 400, fontSize: 12.5 }}>{c.phone}</span>
            {c.callType && (
              <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, background: "var(--bg-hover)", color: "var(--text-muted)" }}>{c.callType}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><User size={11} />{c.employee}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} />{formatDateTime(c.date)}</span>
            <span>{formatDuration(c.durationSeconds)}</span>
            {c.source && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Phone size={11} />{c.source}</span>}
          </div>
        </div>

        {/* Status badges + action */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          {/* Recording status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
            <FileAudio size={12} color="var(--text-dim)" />
            <span style={{ color: recStatus === "uploaded" ? "var(--success)" : recStatus === "not_available" ? "var(--text-dim)" : "var(--warning)" }}>
              {REC_STATUS[recStatus]?.label || recStatus}
            </span>
          </div>

          {/* Transcription action */}
          {c.hasRecording && recStatus === "uploaded" && (
            isDone ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Transcribed
              </span>
            ) : isFailed ? (
              <Button variant="soft" icon={RefreshCw} onClick={handleRetry} style={{ fontSize: 12, padding: "5px 10px" }}>Retry</Button>
            ) : (
              <Button
                variant="soft"
                icon={isProcessing ? Loader2 : Sparkles}
                onClick={handleTranscribe}
                disabled={isProcessing}
                style={{ fontSize: 12, padding: "5px 10px" }}
              >
                {isProcessing ? "Processing…" : "Transcribe"}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
          Whisper is transcribing… this may take 10–120 seconds for long recordings
        </div>
      )}

      {/* Error */}
      {isFailed && txError && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={12} /> {txError}
        </div>
      )}

      {/* Transcript text */}
      {isDone && txText && (
        <div style={{
          marginTop: 10, fontSize: 13, lineHeight: 1.6,
          color: "var(--text-secondary)", background: "var(--bg-subtle, var(--bg-card))",
          borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)",
          whiteSpace: "pre-wrap",
        }}>
          {txText}
        </div>
      )}

      {/* AI Summary */}
      {isDone && (
        <SummaryPanel
          summaryStatus={sumStatus}
          summaryText={sumText}
          summaryData={sumData}
          callId={c.id}
          onRefresh={() => {
            client.get(`/transcripts/${c.id}`).then(r => {
              setSumStatus(r.data.summary_status);
              setSumText(r.data.summary_text);
              try { setSumData(JSON.parse(r.data.summary_data)); } catch {}
            }).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <SearchInput
        value={filters.q}
        onChange={(v) => onChange({ ...filters, q: v, page: 1 })}
        placeholder="Search contact, phone…"
        style={{ minWidth: 200 }}
      />
      <select
        value={filters.recording_status}
        onChange={(e) => onChange({ ...filters, recording_status: e.target.value, page: 1 })}
        style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}
      >
        <option value="">All recordings</option>
        <option value="uploaded">Uploaded</option>
        <option value="not_available">Not available</option>
        <option value="uploading">Uploading</option>
        <option value="failed">Upload failed</option>
      </select>
      <select
        value={filters.transcript_status}
        onChange={(e) => onChange({ ...filters, transcript_status: e.target.value, page: 1 })}
        style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13 }}
      >
        <option value="">All transcripts</option>
        <option value="completed">Transcribed</option>
        <option value="processing">Processing</option>
        <option value="pending">Pending</option>
        <option value="failed">Failed</option>
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={filters.recorded_only}
          onChange={(e) => onChange({ ...filters, recorded_only: e.target.checked, page: 1 })}
        />
        Recorded only
      </label>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Transcribe() {
  const [filters, setFilters] = useState({
    q: "", recording_status: "", transcript_status: "", recorded_only: false, page: 1,
  });
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const wsRef                 = useRef(null);

  const load = useCallback(async (f = filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: f.page,
        page_size: 30,
        ...(f.q              && { q: f.q }),
        ...(f.recording_status && { recording_status: f.recording_status }),
        ...(f.transcript_status && { transcript_status: f.transcript_status }),
        ...(f.recorded_only  && { recorded_only: true }),
      };
      const res = await dataSource.getRecordedCalls(params);
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(filters); }, [filters]);

  // WebSocket — real-time transcript/recording updates
  useEffect(() => {
    const wsBase = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1")
      .replace(/^http/, "ws");
    const token = localStorage.getItem("callos_token");
    if (!token) return;
    try {
      const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (["transcript_updated", "recording_uploaded", "summary_updated"].includes(msg.event)) {
            // Reload current page silently
            load(filters);
          }
        } catch {}
      };
      return () => ws.close();
    } catch {}
  }, []);

  function handleFiltersChange(newFilters) {
    setFilters(newFilters);
  }

  const items = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <PageContainer>
      <Card>
        <CardHeader
          icon={Mic}
          title="Recordings & Transcriptions"
          subtitle="All calls — recording detection, upload status, AI transcription, and summaries"
          action={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge tone="accent"><Sparkles size={12} /> Whisper AI</Badge>
              <Button variant="outline" icon={RefreshCw} onClick={() => load(filters)} style={{ fontSize: 12, padding: "5px 10px" }}>
                Refresh
              </Button>
            </div>
          }
        />

        <FilterBar filters={filters} onChange={handleFiltersChange} />

        <div style={{ marginTop: 14 }}>
          {loading ? (
            <LoadingState message="Loading calls…" />
          ) : error ? (
            <ErrorState title="Couldn't load calls" message={error.message} code={error.error_code} onRetry={() => load(filters)} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Mic}
              title="No calls found"
              message="Calls synced from employee phones will appear here. Recordings are detected automatically."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((c) => (
                <TranscriptRow key={c.id} c={c} onDone={() => load(filters)} />
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <Pagination
            page={filters.page}
            totalPages={totalPages}
            onChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        )}
      </Card>
    </PageContainer>
  );
}
