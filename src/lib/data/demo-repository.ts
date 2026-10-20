/**
 * DEMO MODE ONLY. In-memory storage, isolated per organization, used when Supabase
 * isn't configured. Data lives in server memory and is lost on restart. Sample
 * records are flagged isSample and shown with a "Sample" label in the UI.
 */
import { createHash, randomUUID } from "node:crypto";
import type { SaveConversationInput, VoiceInput } from "@/lib/domain/schemas";
import type {
  ActivityStats,
  AuthContext,
  ConversationRecord,
  ConversationSummary,
  Creator,
  Fan,
  Offer,
  OrgSettings,
  Voice,
} from "@/lib/domain/types";
import type { EventInput, Repository, ScreenshotRecordInput } from "./repository";
import { DEFAULT_VOICE } from "@/lib/voices";

interface StoredEvent extends EventInput {
  at: string;
  actorId: string;
}

interface OrgData {
  settings: OrgSettings;
  creators: Creator[];
  voices: Voice[];
  fans: Fan[];
  offers: Offer[];
  conversations: ConversationRecord[];
  screenshots: (ScreenshotRecordInput & { id: string })[];
  events: StoredEvent[];
  audit: { action: string; resourceType: string; resourceId: string | null; actorId: string; at: string }[];
  touchedAt: number;
}

const MAX_ORGS = 500;

/**
 * Stable ids derived from the organization, so every server instance seeds identical
 * sample records. Serverless hosts (Netlify, Vercel) run several instances, and a
 * request may land on one that hasn't seen this demo workspace yet.
 */
export function stableId(orgId: string, label: string): string {
  const h = createHash("sha256").update(`${orgId}:${label}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const globalStore = globalThis as unknown as { __swizzrizzDemoStore?: Map<string, OrgData> };
function store(): Map<string, OrgData> {
  if (!globalStore.__swizzrizzDemoStore) globalStore.__swizzrizzDemoStore = new Map();
  return globalStore.__swizzrizzDemoStore;
}

function seed(orgId: string, defaultRetentionHours: number): OrgData {
  const id = (label: string) => stableId(orgId, label);
  const creatorId = id("creator");
  const now = new Date().toISOString();
  const offers: Offer[] = [
    {
      id: id("offer:beach"), creatorId, title: "Beach Set Bundle", description: "12-photo beach set from the summer shoot.",
      priceCents: 2500, currency: "USD", category: "photo set", includedContent: "12 photos",
      isActive: true, availableFrom: null, availableUntil: null, eligibility: {}, bundleOfferIds: [], isSample: true,
    },
    {
      id: id("offer:bts"), creatorId, title: "Behind-the-Scenes Clip", description: "Short behind-the-scenes video.",
      priceCents: 1200, currency: "USD", category: "video", includedContent: "1 video, 3 min",
      isActive: true, availableFrom: null, availableUntil: null,
      eligibility: { segments: ["returning", "vip"] }, bundleOfferIds: [], isSample: true,
    },
    {
      id: id("offer:holiday"), creatorId, title: "Holiday Set (archived)", description: "Retired seasonal set.",
      priceCents: 3000, currency: "USD", category: "photo set", includedContent: "20 photos",
      isActive: false, availableFrom: null, availableUntil: null, eligibility: {}, bundleOfferIds: [], isSample: true,
    },
  ];
  return {
    settings: { retentionHours: defaultRetentionHours },
    creators: [{ id: creatorId, name: "Demo Creator", isActive: true }],
    voices: [{ ...DEFAULT_VOICE, creatorId, id: id("voice:default"), updatedAt: now }],
    fans: [
      {
        id: id("fan:sample_mike"), creatorId, alias: "sample_mike", segment: "returning",
        approvedNotes: "Likes beach content. Prefers short replies.", contentPreferences: ["beach sets"],
        communicationBoundaries: ["no voice notes"], firstInteractionAt: now, lastInteractionAt: now,
        followUpStatus: "none", purchaseCount: 2, purchasedOfferIds: [], lastSummary: "Chatted about travel plans.", isSample: true,
      },
      {
        id: id("fan:sample_jay"), creatorId, alias: "sample_jay", segment: "new",
        approvedNotes: "", contentPreferences: [], communicationBoundaries: [], firstInteractionAt: now,
        lastInteractionAt: now, followUpStatus: "none", purchaseCount: 0, purchasedOfferIds: [], lastSummary: null, isSample: true,
      },
    ],
    offers,
    conversations: [],
    screenshots: [],
    events: [],
    audit: [],
    touchedAt: Date.now(),
  };
}

function org(orgId: string, defaultRetentionHours: number): OrgData {
  const s = store();
  let data = s.get(orgId);
  if (!data) {
    if (s.size >= MAX_ORGS) {
      const oldest = [...s.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
      if (oldest) s.delete(oldest[0]);
    }
    data = seed(orgId, defaultRetentionHours);
    s.set(orgId, data);
  }
  data.touchedAt = Date.now();
  return data;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export class DemoRepository implements Repository {
  private readonly data: OrgData;
  constructor(private readonly ctx: AuthContext, defaultRetentionHours = 24) {
    this.data = org(ctx.orgId, defaultRetentionHours);
  }

  async getSettings() {
    return clone(this.data.settings);
  }
  async updateSettings(settings: OrgSettings) {
    this.data.settings = { ...settings };
    return clone(this.data.settings);
  }

  async listCreators() {
    return clone(this.data.creators);
  }

  async listVoices() {
    return clone(this.data.voices);
  }

  async saveVoice(id: string | null, input: VoiceInput) {
    if (input.creatorId && !this.data.creators.some((c) => c.id === input.creatorId)) {
      throw new Error("Unknown creator");
    }
    if (input.isDefault) this.data.voices.forEach((v) => (v.isDefault = false));
    const updatedAt = new Date().toISOString();
    if (id) {
      const i = this.data.voices.findIndex((v) => v.id === id);
      if (i < 0) throw new Error("Voice not found");
      this.data.voices[i] = { ...input, id, updatedAt };
      return clone(this.data.voices[i]);
    }
    const voice: Voice = { ...input, id: randomUUID(), updatedAt };
    this.data.voices.push(voice);
    return clone(voice);
  }

  async deleteVoice(id: string) {
    const before = this.data.voices.length;
    const wasDefault = this.data.voices.find((v) => v.id === id)?.isDefault;
    this.data.voices = this.data.voices.filter((v) => v.id !== id);
    if (wasDefault && this.data.voices[0]) this.data.voices[0].isDefault = true;
    return this.data.voices.length < before;
  }

  async listFans(creatorId?: string) {
    return clone(this.data.fans.filter((f) => !creatorId || f.creatorId === creatorId));
  }

  async getFan(id: string) {
    const fan = this.data.fans.find((f) => f.id === id);
    return fan ? clone(fan) : null;
  }

  async createFan(creatorId: string, alias: string) {
    if (!this.data.creators.some((c) => c.id === creatorId)) throw new Error("Unknown creator");
    const existing = this.data.fans.find((f) => f.creatorId === creatorId && f.alias.toLowerCase() === alias.toLowerCase());
    if (existing) return clone(existing);
    const now = new Date().toISOString();
    const fan: Fan = {
      id: stableId(this.ctx.orgId, `fan:${creatorId}:${alias.toLowerCase()}`), creatorId, alias, segment: "new", approvedNotes: "", contentPreferences: [],
      communicationBoundaries: [], firstInteractionAt: now, lastInteractionAt: now, followUpStatus: "none",
      purchaseCount: 0, purchasedOfferIds: [], lastSummary: null, isSample: false,
    };
    this.data.fans.push(fan);
    return clone(fan);
  }

  async listOffers(creatorId?: string) {
    return clone(this.data.offers.filter((o) => !creatorId || o.creatorId === creatorId));
  }

  private summarize(c: ConversationRecord): ConversationSummary {
    const { messages: _m, analysis, ...rest } = c;
    void _m;
    return { ...rest, recommendedAction: analysis?.recommended_action ?? null };
  }

  async listConversations() {
    return this.data.conversations
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => clone(this.summarize(c)));
  }

  async getConversation(id: string) {
    const c = this.data.conversations.find((x) => x.id === id);
    return c ? clone(c) : null;
  }

  async saveConversation(input: SaveConversationInput) {
    if (!this.data.creators.some((c) => c.id === input.creatorId)) throw new Error("Unknown creator");
    const fan = input.fanId ? this.data.fans.find((f) => f.id === input.fanId) : null;
    if (input.fanId && !fan) throw new Error("Unknown fan");
    const record: ConversationRecord = {
      id: randomUUID(),
      title: input.title || `Conversation ${this.data.conversations.length + 1}`,
      creatorId: input.creatorId,
      fanId: fan?.id ?? null,
      fanAlias: fan?.alias ?? null,
      messageCount: input.messages.length,
      recommendedAction: input.analysis?.output.recommended_action ?? null,
      createdAt: new Date().toISOString(),
      messages: clone(input.messages),
      analysis: input.analysis ? { ...clone(input.analysis.output), mode: input.analysis.mode, model: input.analysis.model } : null,
    };
    this.data.conversations.push(record);
    if (fan) {
      fan.lastInteractionAt = record.createdAt;
      if (input.analysis) fan.lastSummary = input.analysis.output.next_step;
    }
    return clone(this.summarize(record));
  }

  async deleteConversation(id: string) {
    const before = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter((c) => c.id !== id);
    return this.data.conversations.length < before;
  }

  async findScreenshotByHash(sha256: string) {
    return this.data.screenshots.some((s) => s.sha256 === sha256);
  }

  async recordScreenshot(input: ScreenshotRecordInput) {
    this.data.screenshots.push({ ...input, id: randomUUID() });
  }

  async recordEvent(event: EventInput) {
    this.data.events.push({ ...event, at: new Date().toISOString(), actorId: this.ctx.userId });
  }

  async getActivityStats(): Promise<ActivityStats> {
    const count = (t: EventInput["type"]) => this.data.events.filter((e) => e.type === t).length;
    return {
      conversationsSaved: this.data.conversations.length,
      analysesRun: count("analysis_run"),
      repliesGenerated: count("reply_generated"),
      repliesCopied: count("reply_copied"),
      offersRecommended: count("offer_recommended"),
    };
  }

  async audit(action: string, resourceType: string, resourceId: string | null = null) {
    this.data.audit.push({ action, resourceType, resourceId, actorId: this.ctx.userId, at: new Date().toISOString() });
  }

  async deleteAllConversationData() {
    this.data.conversations = [];
    this.data.screenshots = [];
    this.data.events = [];
    this.data.fans = [];
  }
}

/** Test helper: forget every demo organization. */
export function resetDemoStore() {
  store().clear();
}
