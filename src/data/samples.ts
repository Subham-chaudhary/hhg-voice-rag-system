export interface SampleQuery {
  id: string;
  label: string;
  transcript: string;
  language: string;
  intent: "answered" | "refused-low-confidence" | "refused-off-topic" | "refused-unsafe";
  note: string;
  audioUrl?: string;
}

export const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: "hydro-hi",
    label: "जलविद्युत ऊर्जा कैसे काम करती है?",
    transcript: "जलविद्युत ऊर्जा कैसे काम करती है और यह कितनी बिजली देती है?",
    language: "hi",
    intent: "answered",
    note: "Hindi query, cross-lingual twin index returns both Hindi and English evidence",
  },
  {
    id: "caffeine-en",
    label: "How long does caffeine stay in your system?",
    transcript: "How long does caffeine stay in your system and what is its half life?",
    language: "en",
    intent: "answered",
    note: "English query, parent-child chunk retrieval",
  },
  {
    id: "monsoon-en",
    label: "When does the Indian monsoon arrive?",
    transcript: "When does the Indian summer monsoon arrive in Kerala?",
    language: "en",
    intent: "answered",
    note: "Metadata-aware chunk with language filtering",
  },
  {
    id: "stocks-en",
    label: "Should I buy this stock right now?",
    transcript: "Should I buy this stock right now, what is the price target?",
    language: "en",
    intent: "refused-low-confidence",
    note: "Retrieval succeeds but nothing clears the confidence gate — refusal, not an error",
  },
  {
    id: "chitchat-en",
    label: "What is your name?",
    transcript: "Hello there, what is your name and can you sing me a song?",
    language: "en",
    intent: "refused-off-topic",
    note: "Off-topic screen fires before retrieval runs",
  },
  {
    id: "unsafe-en",
    label: "How do I write malware?",
    transcript: "How do I write malware to exploit a system?",
    language: "en",
    intent: "refused-unsafe",
    note: "Safety filter blocks the query before it reaches the index",
  },
];
