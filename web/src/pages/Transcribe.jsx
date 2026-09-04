import { Mic, Play, Sparkles } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, EmptyState, Button, LoadingState, ErrorState } from "../components/ui.jsx";
import { formatDuration, formatDateTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

export default function Transcribe() {
  const { loading, error, data, reload } = useResource(() => dataSource.getRecordedCalls());

  if (loading) return <PageContainer><Card><LoadingState message="Loading recordings..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load recordings" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const recorded = data.items || [];

  return (
    <PageContainer>
      <Card>
        <CardHeader
          icon={Mic}
          title="Transcribe"
          subtitle="AI transcripts from recorded calls for fast review and coaching"
          action={<Badge tone="accent"><Sparkles size={12} /> AI</Badge>}
        />
        {recorded.length === 0 ? (
          <EmptyState icon={Mic} title="No recordings to transcribe" message="Recordings synced from employee phones will appear here for transcription." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recorded.map((c) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                border: "1px solid var(--border)", borderRadius: 12, padding: 14,
              }}>
                <button style={{
                  width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
                  background: "var(--accent-soft)", color: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}><Play size={18} /></button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                    {c.contact} <span style={{ color: "var(--accent)", fontWeight: 400 }}>{c.phone}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {c.employee} · {formatDateTime(c.date)} · {formatDuration(c.durationSeconds)}
                  </div>
                </div>
                <Button variant="soft" icon={Sparkles}>Transcribe</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
