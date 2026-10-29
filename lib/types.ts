export type Lang = "en-IN" | "hi-IN" | "gu-IN" | "mr-IN" | "pa-IN";
export type Speaker = "agent" | "supplier";

export type CaptureKey =
  | "base"
  | "print"
  | "plate"
  | "freight"
  | "gst"
  | "moq"
  | "lead"
  | "payment"
  | "validity"
  | "docs"
  | "certs";

export type CallLine = {
  id: string;
  speaker: Speaker;
  at: string;
  lang: Lang;
  display: string;
  original: string;
  captures: CaptureKey[];
  negotiation?: boolean;
};

export type CallScript = {
  id: string;
  supplierId: string;
  language: Lang;
  supplierVoice: string;
  agentVoice: string;
  lines: CallLine[];
};

export type Supplier = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  area: string;
  since: number;
  category: string;
  products: string[];
  gstin: string;
  gstStatus: "active" | "inactive";
  foodGrade: boolean;
  certifications: string[];
  onTime: number;
  responseMins: number;
  orders: number;
  rating: number;
  verificationScore: number;
  relationship: string;
  note: string;
  accent: string;
  moq?: number;
  leadDays?: number;
};

export type Negotiation = {
  label: string;
  from: number;
  to: number;
  saved: number;
  note: string;
};

export type Quote = {
  supplierId: string;
  quantity: number;
  base: number;
  print: number;
  plate: number;
  freight: number;
  gstRate: number;
  moq: number;
  effectiveMoq: number;
  moqNote?: string;
  leadDays: number;
  payment: string;
  validityDays: number;
  printIncluded?: boolean;
  oneTimeLabel?: string;
  oneTimeNote?: string;
  specOk?: boolean;
  specDetail?: string;
  negotiation?: Negotiation;
  flags: string[];
  confidence: number;
};

export type ConstraintKey = "budget" | "delivery" | "moq" | "spec" | "certification";

export type ConstraintResult = {
  key: ConstraintKey;
  label: string;
  pass: boolean;
  detail: string;
  hard: boolean;
};

export type Offer = {
  supplier: Supplier;
  quote: Quote;
  goodsCost: number;
  printCost: number;
  oneTimeCost: number;
  freightCost: number;
  subtotal: number;
  gst: number;
  total: number;
  landed: number;
  constraints: ConstraintResult[];
  hardFails: number;
  feasible: boolean;
  score: number;
  costScore: number;
  speedScore: number;
  rank?: number;
};

export type Priority = "balanced" | "cost" | "speed" | "risk";

export type Levers = {
  budget: boolean;
  delivery: boolean;
  certification: boolean;
  priority: Priority;
  budgetCap: number;
  deadline: number;
  budgetBase: number;
  deadlineBase: number;
};

export type Recommendation = {
  offers: Offer[];
  feasible: Offer[];
  recommended: Offer | null;
  confidence: number;
  headline: string;
  rationale: string;
  changed: string | null;
};

export type Evidence = {
  id: string;
  supplierId: string;
  callId: string;
  lineId: string;
  at: string;
  speaker: Speaker;
  quote: string;
  field: string;
};

export type Buyer = {
  workspace: string;
  owner: string;
  role: string;
  city: string;
  initials: string;
  indentId: string;
  date: string;
  deadline: string;
};

export type PromptExample = {
  label: string;
  text: string;
};

export type PastPurchase = {
  id: string;
  date: string;
  supplier: string;
  item: string;
  amount: number;
  saved: number;
  delivery: string;
  status: string;
};

export type SupplierMemory = {
  supplier: string;
  line: string;
  tone: "good" | "warn";
};

export type Scenario = {
  id: string;
  industry: string;
  shortIndustry: string;
  buyer: Buyer;
  quantity: number;
  unit: string;
  unitShort: string;
  budgetDefault: number;
  daysDefault: number;
  prompts: PromptExample[];
  suppliers: Supplier[];
  quotes: Record<string, Quote>;
  callOrder: string[];
  screenedOut: { supplierId: string; reason: string }[];
  pastPurchases: PastPurchase[];
  supplierMemory: SupplierMemory[];
  po: { item: string; spec: string; hsn: string };
  requiresFoodGrade: boolean;
  specLabel: string;
  specCheck: string;
};

export type MatchResult = {
  shortlist: { id: string; fit: number; reason: string }[];
  excluded: { id: string; reason: string }[];
  source: "mistral" | "local";
  model: string;
  note?: string;
};

export type ChatAnswer = {
  text: string;
  citations: { label: string; lineId?: string }[];
  action?: "po" | "levers";
};
