import { useState, useRef, useEffect } from "react";
import { Mic, Play, Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, EmptyState, Button, LoadingState, ErrorState } from "../components/ui.jsx";
import { formatDuration, formatDateTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import client from "../api/client.js";

// Poll GET /transcripts/{id} every 3s until status is completed or failed
function usePollTranscript(id, active) {
  const [result, setResult] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!active || !id) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await client.get(`/transcripts/${id}`);
        const { transcript_status, transcript_text } = res.data;
        if (cancelled) return;
        if (transcript_status === "completed" || transcript_status === "failed") {
          setResult({ status: transcript_status, text: transcript_text });
        } else {
          timer.current = setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled) setResult({ status: "failed", text: null });
      }
    }

    timer.current = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [id, active]);

  return result;
}

function TranscriptRow({ c, onDone }) {
  const [localStatus, setLocalStatus] = useState(c.transcriptStatus || "pending");
  const [localText, setLocalText]     = useState(c.transcriptText || null);
  const [polling, setPolling]         = useState(false);

  const pollResult = usePollTranscript(c.id, polling);

  useEffect(() => {
    if (!pollResult) return;
    setPolling(false);
    setLocalStatus(pollResult.status);
    setLocalText(pollResult.text);
    if (pollResult.status === "completed") onDone?.();
  }, [pollResult]);

  async function handleTranscribe() {
    setLocalStatus("processing");
    setPolling(false);
    try {
      const res = await client.post(`/transcripts/${c.id}/transcribe`);
      const { status, transcript } = res.data;
      if (status === "completed") {
        setLocalStatus("completed");
        setLocalText(transcript);
      } else if (status === "processing") {
        setPolling(true);
      } else {
        setLocalStatus("failed");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setLocalStatus("failed");
      setLocalText(detail || "Request failed");
    }
  }

  const isProcessing = localStatus === "processing";
  const isDone       = localStatus === "completed";
  const isFailed     = localStatus === "failed";

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 12, padding: 14,
      borderLeftWidth: isDone ? 3 : 1,
      borderLeftColor: isDone ? "var(--success)" : isFailed ? "var(--danger)" : "var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Play button */}
        <button
          onClick={() => c.recordingUrl && window.open(c.recordingUrl, "_blank")}
          style={{
            width: 40, height: 40, borderRadius: 10, border: "none",
            cursor: c.recordingUrl ? "pointer" : "default",
            background: "var(--accent-soft)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <Play size={18} />
        </button>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
            {c.contact}{" "}
            <span style={{ color: "var(--accent)", fontWeight: 400 }}>{c.phone}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {c.employee} · {formatDateTime(c.date)} · {formatDuration(c.durationSeconds)}
          </div>
        </div>

        {/* Action button */}
        {isDone ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--success)", fontWeight: 600 }}>
            <CheckCircle2 size={15} /> Done
          </span>
        ) : isFailed ? (
          <Button variant="soft" icon={Sparkles} onClick={handleTranscribe}>Retry</Button>
        ) : (
          <Button
            variant="soft"
            icon={isProcessing ? Loader2 : Sparkles}
            onClick={handleTranscribe}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing…" : "Transcribe"}
          </Button>
        )}
      </div>

      {/* Transcript text */}
      {isDone && localText && (
        <div style={{
          marginTop: 12, fontSize: 13, lineHeight: 1.6,
          color: "var(--text-secondary)", background: "var(--bg-subtle, var(--bg-card))",
          borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)",
          whiteSpace: "pre-wrap",
        }}>
          {localText}
        </div>
      )}

      {/* Error detail */}
      {isFailed && localText && (
        <div style={{
          marginTop: 8, fontSize: 12, color: "var(--danger)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <AlertCircle size={13} /> {localText}
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
          Whisper is transcribing… this takes 10–30 seconds
        </div>
      )}
    </div>
  );
}

export default function Transcribe() {
  const { loading, error, data, reload } = useResource(() => dataSource.getRecordedCalls());

  if (loading) return <PageContainer><Card><LoadingState message="Loading recordings..." /></Card></PageContainer>;
  if (error)   return <PageContainer><Card><ErrorState title="Couldn't load recordings" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const recorded = data.items || [];

  return (
    <PageContainer>
      <Card>
        <CardHeader
          icon={Mic}
          title="Transcribe"
          subtitle="AI transcripts from recorded calls — powered by OpenAI Whisper"
          action={<Badge tone="accent"><Sparkles size={12} /> Whisper AI</Badge>}
        />
        {recorded.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No recordings to transcribe"
            message="Recordings synced from employee phones will appear here."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recorded.map((c) => (
              <TranscriptRow key={c.id} c={c} onDone={reload} />
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
