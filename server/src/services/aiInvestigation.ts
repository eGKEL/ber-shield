import OpenAI from 'openai';

type Signal = { label: string; points: number; detail: string; category: string };
export type BrokerCaseForAi = {
  riskScore: number;
  severity: string;
  recommendation: string;
  transaction: { identity: string; shipmentId: string; origin: string; destination: string };
  signals: Signal[];
};

const localReview = (caseData: BrokerCaseForAi) => {
  const evidence = caseData.signals.map((signal) => `${signal.label} (+${signal.points})`);
  const categories = [...new Set(caseData.signals.map((signal) => signal.category.toLowerCase()))].join(', ');
  return {
    confidence: Math.min(96, 72 + caseData.signals.length * 7),
    classification: 'Broker account behavior anomaly',
    summary: `${caseData.transaction.identity} generated ${caseData.signals.length} correlated anomalies on shipment ${caseData.transaction.shipmentId}. The ${caseData.severity.toLowerCase()} risk assessment is driven by ${categories || 'observed'} signals; verify the broker and driver instructions before release.`,
    evidence,
    recommendedAction: caseData.recommendation === 'BLOCK' ? 'BLOCK ACCOUNT CHANGES' : caseData.recommendation === 'ESCALATE' ? 'ESCALATE CASE' : 'REVIEW BEFORE RELEASE',
    provider: 'Local behavioral model',
    model: 'BER signal classifier',
  };
};

async function investigateWithOllama(caseData: BrokerCaseForAi, fallback: ReturnType<typeof localReview>) {
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.1, num_predict: 180 },
        messages: [
          {
            role: 'system',
            content: 'You are a logistics security investigator. Return a concise factual 2-3 sentence executive summary. Use only supplied evidence. Do not give instructions other than the recommended response.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              identity: caseData.transaction.identity,
              shipment: caseData.transaction.shipmentId,
              route: `${caseData.transaction.origin} to ${caseData.transaction.destination}`,
              riskScore: caseData.riskScore,
              severity: caseData.severity,
              evidence: caseData.signals,
            }),
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { message?: { content?: string } };
    const summary = data.message?.content?.trim();
    return summary ? { ...fallback, summary, provider: 'Local Qwen', model } : null;
  } catch {
    return null;
  }
}

export async function investigateBrokerCase(caseData: BrokerCaseForAi) {
  const fallback = localReview(caseData);
  const localQwen = await investigateWithOllama(caseData, fallback);
  if (localQwen) return localQwen;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-5';
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      store: false,
      instructions: 'You are a logistics security investigator. Write a concise, factual 2-3 sentence executive investigation summary. Do not invent facts. Do not give operational instructions beyond the recommended response.',
      input: JSON.stringify({
        identity: caseData.transaction.identity,
        shipment: caseData.transaction.shipmentId,
        route: `${caseData.transaction.origin} to ${caseData.transaction.destination}`,
        riskScore: caseData.riskScore,
        severity: caseData.severity,
        evidence: caseData.signals.map(({ label, points, detail, category }) => ({ label, points, detail, category })),
      }),
    });
    return {
      ...fallback,
      summary: response.output_text || fallback.summary,
      provider: 'OpenAI',
      model,
    };
  } catch {
    return fallback;
  }
}
