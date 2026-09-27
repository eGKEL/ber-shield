# BER Shield — Logistics ITDR prototype

An interactive demo of an Identity Threat Detection & Response console for logistics companies. It detects account takeover, insider anomalies, and email payment fraud before suspicious shipments or payments are released.

## What’s included

- React + Vite frontend with enterprise BER Shield, broker-portal, and invoice-intelligence workspaces.
- Express API, deterministic risk engine, and three realistic demo scenarios.
- Animated attack timeline, signal activation, risk scoring, AI investigation report, and human BLOCK / ALLOW / ESCALATE decisions.
- A deterministic investigation fallback: it is always available and never needs an API key. The integration is isolated in `server/src/services/investigation.ts` for an LLM swap later.
- **Invoice Intelligence** with an approved invoice baseline, exact and near-duplicate detection, amount-variance checks, payment-destination verification, delivery-state checks, cumulative risk, local Qwen investigation, and human payment controls.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001`.

### Local Qwen investigation summaries

The default investigation provider is local Qwen through Ollama (`qwen2.5:1.5b`). It runs on the Mac and does not require an API key. BER Shield falls back to its local behavioral model while Ollama is unavailable.

### Optional OpenAI investigation summaries

The demo always includes a local behavioral-analysis fallback. To enable an OpenAI-backed executive summary, copy `.env.example` to `.env`, add your `OPENAI_API_KEY`, and restart the app. Set `OPENAI_MODEL` if your account uses a different approved model.

For a production frontend build check:

```bash
npm run build
```

## API

- `GET /api/health`
- `GET /api/scenarios` and `GET /api/scenarios/:id`
- `POST /api/risk/analyze` with `{ "scenarioId", "activeSignalIds" }`
- `POST /api/investigate` with `{ "scenarioId", "activeSignalIds" }`
- `POST /api/actions/block`, `/allow`, `/escalate` with `{ "scenarioId" }`
- `GET /api/invoices/baseline` and `GET /api/invoices/monitor`
- `POST /api/invoices/submit` with `{ "scenarioId" }`
- `POST /api/invoices/case/analysis` and `/api/invoices/case/action`

## Demo flow

1. Select **Account Takeover**.
2. Click **Simulate Account Takeover** and watch the signals and score progress for ~11 seconds.
3. At critical risk, click **Investigate** to generate the attack reconstruction.
4. Review the evidence and choose **Block**. The console records the human containment decision.

The other scenarios use the same engine: **Insider Anomaly** recommends human investigation, while **Email Payment Fraud** recommends containment.

### Invoice Intelligence demo flow

1. Open **Invoice Intelligence** from the BER Shield navigation.
2. Review the approved invoice baseline, then select a demo submission such as **Submit bank change** or **Submit exact duplicate**.
3. Review the correlated financial, duplicate, payment, and fulfillment evidence.
4. Generate the AI-assisted invoice review and choose **Block payment**, **Escalate**, or **Allow**.
