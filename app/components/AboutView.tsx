'use client';

import './views.css';

export default function AboutView() {
  return (
    <div className="v-page">
      <div className="v-page-inner narrow">
        <header className="v-head">
          <div>
            <h1>About Jarvis Lite</h1>
            <p className="sub">A rule-based desktop assistant — no heavy AI/ML, no cloud APIs, runs fully offline.</p>
          </div>
        </header>

        <section className="glass v-card">
          <div className="v-list">
            <Row label="Version" value="1.0.0" />
            <Row label="Engine" value="Next.js 14 + Electron 31" />
            <Row label="Decision logic" value="Rule-based keyword matching (Observe → Decide → Act → Learn)" />
            <Row label="Voice input" value="Web Speech API" />
            <Row label="Voice output" value="SpeechSynthesis API" />
            <Row label="Memory" value="Local JSON file (no cloud sync)" />
          </div>
        </section>

        <p className="v-caption" style={{ padding: '0 4px' }}>
          Built as a lightweight agentic assistant demo — extend commands.ts and agent.ts to add new capabilities.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="v-row">
      <span className="v-row-k">{label}</span>
      <span className="v-row-v">{value}</span>
    </div>
  );
}
