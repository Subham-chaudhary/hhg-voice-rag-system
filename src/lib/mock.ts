import { ChunkRepresentation } from "./contract";

interface MockEvidence {
  id: string;
  text: string;
  score: number;
  dense_score: number;
  sparse_score: number;
  rrf_score: number;
  language: string;
  representation: ChunkRepresentation;
  parent_id?: string;
  parent_text?: string;
  query_id?: string;
  passage_rank?: number;
}

interface MockScenario {
  match: RegExp;
  language: string;
  status: "answered" | "refused" | "error";
  answer?: string;
  evidence_ids?: string[];
  evidence?: MockEvidence[];
  confidence: number;
  refusal_reason?: string;
  fallback?: "extractive" | null;
}

const HYDRO: MockEvidence[] = [
  {
    id: "msx-hi-482913-p2-c1",
    text: "हाइड्रोइलेक्ट्रिक ऊर्जा बहते पानी की गतिज ऊर्जा को टरबाइन के माध्यम से विद्युत ऊर्जा में परिवर्तित करती है। यह विश्व की सबसे बड़ी नवीकरणीय बिजली स्रोत है और वैश्विक उत्पादन का लगभग सोलह प्रतिशत हिस्सा देती है।",
    score: 0.891,
    dense_score: 0.874,
    sparse_score: 12.41,
    rrf_score: 0.0328,
    language: "hi",
    representation: "parent_child",
    parent_id: "msx-hi-482913-p2",
    parent_text:
      "जलविद्युत संयंत्र नदियों पर बांध बनाकर पानी का भंडारण करते हैं। जब पानी छोड़ा जाता है तो वह टरबाइन को घुमाता है, जो जनरेटर से जुड़ा होता है। हाइड्रोइलेक्ट्रिक ऊर्जा बहते पानी की गतिज ऊर्जा को टरबाइन के माध्यम से विद्युत ऊर्जा में परिवर्तित करती है। यह विश्व की सबसे बड़ी नवीकरणीय बिजली स्रोत है और वैश्विक उत्पादन का लगभग सोलह प्रतिशत हिस्सा देती है। बड़े बांधों के पारिस्थितिक प्रभाव भी होते हैं।",
    query_id: "482913",
    passage_rank: 2,
  },
  {
    id: "msx-en-482913-p2-tw",
    text: "Hydroelectric power converts the kinetic energy of flowing water into electricity by driving turbines. It is the largest renewable source of electricity worldwide, supplying roughly sixteen percent of global generation.",
    score: 0.867,
    dense_score: 0.858,
    sparse_score: 11.87,
    rrf_score: 0.0312,
    language: "en",
    representation: "cross_lingual",
    query_id: "482913",
    passage_rank: 2,
  },
  {
    id: "msx-hi-771204-p5-s3",
    text: "एक विशिष्ट जलविद्युत संयंत्र में बांध, जलाशय, पेनस्टॉक, टरबाइन और जनरेटर शामिल होते हैं। ऊर्जा रूपांतरण दक्षता आमतौर पर नब्बे प्रतिशत से अधिक होती है।",
    score: 0.742,
    dense_score: 0.731,
    sparse_score: 9.02,
    rrf_score: 0.0241,
    language: "hi",
    representation: "sentence_window",
    query_id: "771204",
    passage_rank: 5,
  },
  {
    id: "msx-hi-119887-p1-a",
    text: "नवीकरणीय ऊर्जा स्रोतों में सौर, पवन, जलविद्युत, भूतापीय और बायोमास शामिल हैं। इनमें से जलविद्युत सबसे पुराना और सबसे व्यापक रूप से तैनात है।",
    score: 0.688,
    dense_score: 0.679,
    sparse_score: 7.44,
    rrf_score: 0.0198,
    language: "hi",
    representation: "atomic",
    query_id: "119887",
    passage_rank: 1,
  },
];

const CAFFEINE: MockEvidence[] = [
  {
    id: "msx-en-330218-p1-a",
    text: "Caffeine is absorbed from the gastrointestinal tract within about forty-five minutes of ingestion, with peak plasma concentration reached between fifteen and one hundred and twenty minutes.",
    score: 0.913,
    dense_score: 0.902,
    sparse_score: 14.22,
    rrf_score: 0.0331,
    language: "en",
    representation: "atomic",
    query_id: "330218",
    passage_rank: 1,
  },
  {
    id: "msx-en-330218-p3-c2",
    text: "The half-life of caffeine in healthy adults ranges from three to seven hours, though this is prolonged in pregnancy and shortened in habitual smokers.",
    score: 0.884,
    dense_score: 0.871,
    sparse_score: 13.08,
    rrf_score: 0.0309,
    language: "en",
    representation: "parent_child",
    parent_id: "msx-en-330218-p3",
    parent_text:
      "Caffeine metabolism occurs primarily in the liver through the cytochrome P450 oxidase enzyme system. The half-life of caffeine in healthy adults ranges from three to seven hours, though this is prolonged in pregnancy and shortened in habitual smokers. Genetic variation in CYP1A2 accounts for much of the individual difference in clearance rate.",
    query_id: "330218",
    passage_rank: 3,
  },
  {
    id: "msx-ta-330218-p1-tw",
    text: "காஃபின் உட்கொண்ட சுமார் நாற்பத்தைந்து நிமிடங்களுக்குள் இரைப்பை குடல் பாதையிலிருந்து உறிஞ்சப்படுகிறது.",
    score: 0.721,
    dense_score: 0.714,
    sparse_score: 6.91,
    rrf_score: 0.0227,
    language: "ta",
    representation: "cross_lingual",
    query_id: "330218",
    passage_rank: 1,
  },
];

const MONSOON: MockEvidence[] = [
  {
    id: "msx-en-905441-p2-e",
    text: "The Indian summer monsoon typically arrives over Kerala around the first of June and withdraws from north-west India by mid-September, delivering about seventy-five percent of the country's annual rainfall.",
    score: 0.876,
    dense_score: 0.869,
    sparse_score: 13.55,
    rrf_score: 0.0324,
    language: "en",
    representation: "metadata",
    query_id: "905441",
    passage_rank: 2,
  },
  {
    id: "msx-bn-905441-p2-tw",
    text: "ভারতীয় গ্রীষ্মকালীন মৌসুমি বায়ু সাধারণত পয়লা জুনের কাছাকাছি কেরালায় পৌঁছায় এবং সেপ্টেম্বরের মাঝামাঝি উত্তর-পশ্চিম ভারত থেকে সরে যায়।",
    score: 0.812,
    dense_score: 0.804,
    sparse_score: 10.13,
    rrf_score: 0.0281,
    language: "bn",
    representation: "cross_lingual",
    query_id: "905441",
    passage_rank: 2,
  },
  {
    id: "msx-en-661029-p4-s1",
    text: "Monsoon onset dates have shown high interannual variability, with the standard deviation of the Kerala onset date being approximately eight days over the twentieth century record.",
    score: 0.703,
    dense_score: 0.698,
    sparse_score: 8.27,
    rrf_score: 0.0212,
    language: "en",
    representation: "sentence_window",
    query_id: "661029",
    passage_rank: 4,
  },
];

const WEAK: MockEvidence[] = [
  {
    id: "msx-en-204118-p7-a",
    text: "Quarterly revenue guidance is typically issued alongside earnings releases and is subject to revision.",
    score: 0.318,
    dense_score: 0.311,
    sparse_score: 2.04,
    rrf_score: 0.0102,
    language: "en",
    representation: "atomic",
    query_id: "204118",
    passage_rank: 7,
  },
  {
    id: "msx-en-889301-p3-c4",
    text: "Analysts caution that forward-looking statements should not be relied upon as predictions of future performance.",
    score: 0.291,
    dense_score: 0.286,
    sparse_score: 1.77,
    rrf_score: 0.0094,
    language: "en",
    representation: "parent_child",
    parent_id: "msx-en-889301-p3",
    query_id: "889301",
    passage_rank: 3,
  },
];

const SCENARIOS: MockScenario[] = [
  {
    match: /hydro|जलविद्युत|बिजली|electric|turbine|renewable/i,
    language: "hi",
    status: "answered",
    answer:
      "जलविद्युत बहते पानी की गतिज ऊर्जा को टरबाइन के माध्यम से बिजली में बदलती है। यह दुनिया का सबसे बड़ा नवीकरणीय बिजली स्रोत है और वैश्विक उत्पादन का लगभग 16% देता है।",
    evidence_ids: ["msx-hi-482913-p2-c1", "msx-en-482913-p2-tw"],
    evidence: HYDRO,
    confidence: 0.891,
  },
  {
    match: /caffeine|coffee|half.?life|absorb/i,
    language: "en",
    status: "answered",
    answer:
      "Caffeine is absorbed within about forty-five minutes and peaks in plasma between fifteen and one hundred twenty minutes. Its half-life in healthy adults is three to seven hours.",
    evidence_ids: ["msx-en-330218-p1-a", "msx-en-330218-p3-c2"],
    evidence: CAFFEINE,
    confidence: 0.913,
  },
  {
    match: /monsoon|rain|kerala|मानसून|বৃষ্টি/i,
    language: "en",
    status: "answered",
    answer:
      "The Indian summer monsoon reaches Kerala around 1 June and withdraws from north-west India by mid-September, supplying roughly seventy-five percent of India's annual rainfall.",
    evidence_ids: ["msx-en-905441-p2-e"],
    evidence: MONSOON,
    confidence: 0.876,
  },
  {
    match: /stock|invest|buy|price target|crypto|bitcoin/i,
    language: "en",
    status: "refused",
    refusal_reason: "insufficient_evidence",
    evidence: WEAK,
    confidence: 0.318,
  },
  {
    match: /weather today|who are you|your name|tell me a joke|sing|hello|hi there/i,
    language: "en",
    status: "refused",
    refusal_reason: "off_topic",
    evidence: [],
    confidence: 0.104,
  },
  {
    match: /hack|exploit|weapon|bomb|kill|malware/i,
    language: "en",
    status: "refused",
    refusal_reason: "unsafe_input",
    evidence: [],
    confidence: 0,
  },
];

const DEFAULT_SCENARIO: MockScenario = {
  match: /.*/,
  language: "en",
  status: "answered",
  answer:
    "Based on the retrieved passages, hydroelectric generation supplies roughly sixteen percent of global electricity and remains the largest renewable source on the grid.",
  evidence_ids: ["msx-en-482913-p2-tw"],
  evidence: HYDRO,
  confidence: 0.804,
};

function jitter(base: number, spread: number): number {
  return Math.round((base + (Math.random() - 0.5) * spread) * 10) / 10;
}

const MOCK_CORES = {
  stt: { id: "sarvam.saarika-v2", provider: "sarvam", model: "saarika:v2", version: "2.1" },
  validate: { id: "guard.rules-v1", provider: "internal", version: "1.0" },
  embed: { id: "e5.multilingual-base", provider: "huggingface", model: "intfloat/multilingual-e5-base" },
  retrieve: { id: "qdrant.hybrid-rrf", provider: "qdrant", version: "1.12" },
  rank: { id: "fusion.rrf-diversity", provider: "internal", version: "1.0" },
  generate: { id: "groq.gpt-oss-20b", provider: "groq", model: "openai/gpt-oss-20b" },
  ground: { id: "gate.token-coverage", provider: "internal", version: "1.0" },
};

export function buildMockResponse(transcript: string, withVoice: boolean) {
  const scenario = SCENARIOS.find((entry) => entry.match.test(transcript)) ?? DEFAULT_SCENARIO;
  const refused = scenario.status === "refused";
  const blockedEarly = scenario.refusal_reason === "unsafe_input" || scenario.refusal_reason === "off_topic";

  const validate = jitter(blockedEarly ? 1.4 : 2.1, 1.2);
  const embed = blockedEarly ? 0 : jitter(14.6, 6);
  const retrieve = blockedEarly ? 0 : jitter(9.8, 5);
  const rank = blockedEarly ? 0 : jitter(3.4, 1.8);
  const generate = refused ? 0 : jitter(68, 26);
  const ground = refused ? jitter(1.1, 0.8) : jitter(5.2, 2.6);
  const overhead = jitter(26, 12);

  const ragCore =
    Math.round((validate + embed + retrieve + rank + generate + ground + overhead) * 10) / 10;
  const stt = withVoice ? jitter(412, 140) : undefined;

  return {
    status: scenario.status,
    answer: refused ? "" : scenario.answer,
    transcript,
    language: scenario.language,
    confidence: scenario.confidence,
    threshold: 0.62,
    refusal_reason: scenario.refusal_reason,
    evidence_ids: scenario.evidence_ids ?? [],
    evidence: scenario.evidence ?? [],
    model: refused ? null : "groq/openai-gpt-oss-20b",
    trace_id: `mock-${Math.random().toString(36).slice(2, 10)}`,
    fallback: scenario.fallback ?? null,
    cores: {
      ...MOCK_CORES,
      ...(withVoice ? {} : { stt: { ...MOCK_CORES.stt, status: "disabled" } }),
      ...(blockedEarly
        ? {
            embed: { ...MOCK_CORES.embed, status: "disabled" },
            retrieve: { ...MOCK_CORES.retrieve, status: "disabled" },
            rank: { ...MOCK_CORES.rank, status: "disabled" },
          }
        : {}),
      ...(refused ? { generate: { ...MOCK_CORES.generate, status: "disabled" } } : {}),
    },
    latency_ms: {
      stt,
      validate,
      embed,
      retrieve,
      rank,
      generate,
      ground,
      rag_core: ragCore,
      voice_e2e: stt ? Math.round((stt + ragCore + jitter(48, 20)) * 10) / 10 : undefined,
    },
  };
}
