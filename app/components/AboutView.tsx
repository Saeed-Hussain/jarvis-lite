'use client';

export default function AboutView() {
  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-2xl">
      <h2 className="text-[15px] font-semibold mb-1">About Jarvis Lite</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--jarvis-subtext)' }}>
        A rule-based desktop assistant — no heavy AI/ML, no cloud APIs, runs fully offline.
      </p>

      <div className="glass-panel rounded-lg p-3.5 flex flex-col gap-2.5 text-[12.5px]">
        <Row label="Version" value="1.0.0" />
        <Row label="Engine" value="Next.js 14 + Electron 31" />
        <Row label="Decision Logic" value="Rule-based keyword matching (Observe → Decide → Act → Learn)" />
        <Row label="Voice Input" value="Web Speech API" />
        <Row label="Voice Output" value="SpeechSynthesis API" />
        <Row label="Memory" value="Local JSON file (no cloud sync)" />
      </div>

      <p className="text-xs mt-6" style={{ color: 'var(--jarvis-subtext)' }}>
        Built as a lightweight agentic assistant demo — extend commands.ts and agent.ts to add new capabilities.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--jarvis-subtext)' }}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
