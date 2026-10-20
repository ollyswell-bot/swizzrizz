import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaveConversationInput, TranscriptMessage, VoiceInput } from "@/lib/domain/schemas";
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

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are mapped field by field below */

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what} failed`);
  return result.data as T;
}

const VOICE_COLUMNS =
  "id, creator_id, name, brand_description, tone, vocabulary, emoji_frequency, typical_length, approved_phrases, prohibited_phrases, content_boundaries, example_messages, default_sales_style, is_default, updated_at";

function toVoice(r: any): Voice {
  return {
    id: r.id,
    creatorId: r.creator_id,
    name: r.name,
    brandDescription: r.brand_description,
    tone: r.tone,
    vocabulary: r.vocabulary,
    emojiFrequency: r.emoji_frequency,
    typicalLength: r.typical_length,
    approvedPhrases: r.approved_phrases ?? [],
    prohibitedPhrases: r.prohibited_phrases ?? [],
    contentBoundaries: r.content_boundaries ?? [],
    exampleMessages: r.example_messages ?? [],
    defaultSalesStyle: r.default_sales_style,
    isDefault: r.is_default,
    updatedAt: r.updated_at,
  };
}

function fromVoice(input: VoiceInput) {
  return {
    creator_id: input.creatorId,
    name: input.name,
    brand_description: input.brandDescription,
    tone: input.tone,
    vocabulary: input.vocabulary,
    emoji_frequency: input.emojiFrequency,
    typical_length: input.typicalLength,
    approved_phrases: input.approvedPhrases,
    prohibited_phrases: input.prohibitedPhrases,
    content_boundaries: input.contentBoundaries,
    example_messages: input.exampleMessages,
    default_sales_style: input.defaultSalesStyle,
    is_default: input.isDefault,
  };
}

function toOffer(r: any): Offer {
  const e = r.eligibility ?? {};
  return {
    id: r.id,
    creatorId: r.creator_id,
    title: r.title,
    description: r.description,
    priceCents: r.price_cents,
    currency: r.currency,
    category: r.category,
    includedContent: r.included_content,
    isActive: r.is_active,
    availableFrom: r.available_from,
    availableUntil: r.available_until,
    eligibility: {
      segments: Array.isArray(e.segments) ? e.segments : undefined,
      minPriorPurchases: typeof e.min_prior_purchases === "number" ? e.min_prior_purchases : undefined,
    },
    bundleOfferIds: r.bundle_offer_ids ?? [],
    isSample: false,
  };
}

export class SupabaseRepository implements Repository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly ctx: AuthContext,
  ) {}

  private get org() {
    return this.ctx.orgId;
  }

  async getSettings(): Promise<OrgSettings> {
    const r = must(
      await this.db.from("organizations").select("screenshot_retention_hours").eq("id", this.org).single(),
      "load settings",
    ) as any;
    return { retentionHours: r.screenshot_retention_hours };
  }

  async updateSettings(settings: OrgSettings) {
    must(
      await this.db.from("organizations").update({ screenshot_retention_hours: settings.retentionHours }).eq("id", this.org),
      "update settings",
    );
    return settings;
  }

  async listCreators(): Promise<Creator[]> {
    const rows = must(
      await this.db.from("creators").select("id, name, is_active").eq("organization_id", this.org).order("created_at"),
      "list creators",
    ) as any[];
    return rows.map((r) => ({ id: r.id, name: r.name, isActive: r.is_active }));
  }

  async listVoices(): Promise<Voice[]> {
    const rows = must(
      await this.db.from("creator_voices").select(VOICE_COLUMNS).eq("organization_id", this.org).order("created_at"),
      "list voices",
    ) as any[];
    return rows.map(toVoice);
  }

  async saveVoice(id: string | null, input: VoiceInput): Promise<Voice> {
    if (input.isDefault) {
      must(
        await this.db.from("creator_voices").update({ is_default: false }).eq("organization_id", this.org).neq("id", id ?? ""),
        "clear default voice",
      );
    }
    const row = { ...fromVoice(input), organization_id: this.org };
    const result = id
      ? await this.db.from("creator_voices").update(row).eq("id", id).eq("organization_id", this.org).select(VOICE_COLUMNS).single()
      : await this.db.from("creator_voices").insert(row).select(VOICE_COLUMNS).single();
    return toVoice(must(result, "save voice"));
  }

  async deleteVoice(id: string) {
    const rows = must(
      await this.db.from("creator_voices").delete().eq("id", id).eq("organization_id", this.org).select("id"),
      "delete voice",
    ) as any[];
    return rows.length > 0;
  }

  async listFans(creatorId?: string): Promise<Fan[]> {
    let q = this.db
      .from("fans")
      .select("*, purchase_records(offer_id, verified)")
      .eq("organization_id", this.org)
      .order("last_interaction_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (creatorId) q = q.eq("creator_id", creatorId);
    const rows = must(await q, "list fans") as any[];
    return rows.map((r) => this.toFan(r, null));
  }

  private toFan(r: any, lastSummary: string | null): Fan {
    const purchases: { offer_id: string | null }[] = r.purchase_records ?? [];
    return {
      id: r.id,
      creatorId: r.creator_id,
      alias: r.alias,
      segment: r.segment,
      approvedNotes: r.approved_notes,
      contentPreferences: r.content_preferences ?? [],
      communicationBoundaries: r.communication_boundaries ?? [],
      firstInteractionAt: r.first_interaction_at,
      lastInteractionAt: r.last_interaction_at,
      followUpStatus: r.follow_up_status,
      purchaseCount: purchases.length,
      purchasedOfferIds: purchases.map((p) => p.offer_id).filter((x): x is string => Boolean(x)),
      lastSummary,
      isSample: false,
    };
  }

  async getFan(id: string) {
    const r = must(
      await this.db
        .from("fans")
        .select("*, purchase_records(offer_id, verified)")
        .eq("id", id)
        .eq("organization_id", this.org)
        .maybeSingle(),
      "load fan",
    );
    if (!r) return null;
    const last = must(
      await this.db
        .from("conversations")
        .select("summary")
        .eq("organization_id", this.org)
        .eq("fan_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      "load fan summary",
    ) as any[];
    return this.toFan(r, last[0]?.summary || null);
  }

  async createFan(creatorId: string, alias: string) {
    const existing = must(
      await this.db
        .from("fans")
        .select("id")
        .eq("organization_id", this.org)
        .eq("creator_id", creatorId)
        .ilike("alias", alias.replace(/[%_\\]/g, "\\$&"))
        .maybeSingle(),
      "find fan",
    ) as any;
    if (existing) return (await this.getFan(existing.id))!;
    const now = new Date().toISOString();
    const row = must(
      await this.db
        .from("fans")
        .insert({ organization_id: this.org, creator_id: creatorId, alias, first_interaction_at: now, last_interaction_at: now })
        .select("*")
        .single(),
      "create fan",
    );
    return this.toFan(row, null);
  }

  async listOffers(creatorId?: string) {
    let q = this.db.from("ppv_offers").select("*").eq("organization_id", this.org).order("price_cents");
    if (creatorId) q = q.eq("creator_id", creatorId);
    return (must(await q, "list offers") as any[]).map(toOffer);
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const rows = must(
      await this.db
        .from("conversations")
        .select("id, title, creator_id, fan_id, created_at, fans(alias), messages(count), ai_analyses(recommended_action, created_at)")
        .eq("organization_id", this.org)
        .order("created_at", { ascending: false })
        .limit(200),
      "list conversations",
    ) as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      creatorId: r.creator_id,
      fanId: r.fan_id,
      fanAlias: r.fans?.alias ?? null,
      messageCount: r.messages?.[0]?.count ?? 0,
      recommendedAction: r.ai_analyses?.at(-1)?.recommended_action ?? null,
      createdAt: r.created_at,
    }));
  }

  async getConversation(id: string): Promise<ConversationRecord | null> {
    const r = must(
      await this.db
        .from("conversations")
        .select("id, title, creator_id, fan_id, created_at, fans(alias), messages(*), ai_analyses(*)")
        .eq("id", id)
        .eq("organization_id", this.org)
        .maybeSingle(),
      "load conversation",
    ) as any;
    if (!r) return null;
    const messages: TranscriptMessage[] = (r.messages ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((m: any) => ({
        id: m.id,
        sender: m.sender,
        text: m.body,
        timestamp: m.sent_at_label,
        uncertain: m.is_uncertain,
        edited: m.edited,
        sourceImage: 0,
      }));
    const a = (r.ai_analyses ?? []).sort((x: any, y: any) => x.created_at.localeCompare(y.created_at)).at(-1);
    return {
      id: r.id,
      title: r.title,
      creatorId: r.creator_id,
      fanId: r.fan_id,
      fanAlias: r.fans?.alias ?? null,
      messageCount: messages.length,
      recommendedAction: a?.recommended_action ?? null,
      createdAt: r.created_at,
      messages,
      analysis: a ? { ...a.output, mode: a.mode, model: a.model } : null,
    };
  }

  async saveConversation(input: SaveConversationInput): Promise<ConversationSummary> {
    const conv = must(
      await this.db
        .from("conversations")
        .insert({
          organization_id: this.org,
          creator_id: input.creatorId,
          fan_id: input.fanId,
          operator_id: this.ctx.userId,
          title: input.title,
          summary: input.analysis?.output.next_step ?? "",
        })
        .select("id, created_at")
        .single(),
      "save conversation",
    ) as any;

    const messages = input.messages.map((m, position) => ({
      organization_id: this.org,
      conversation_id: conv.id,
      position,
      sender: m.sender,
      body: m.text,
      sent_at_label: m.timestamp,
      is_uncertain: m.uncertain,
      edited: m.edited,
    }));
    const msgResult = await this.db.from("messages").insert(messages);
    if (msgResult.error) {
      await this.db.from("conversations").delete().eq("id", conv.id).eq("organization_id", this.org);
      throw new Error("save messages failed");
    }

    if (input.analysis) {
      const o = input.analysis.output;
      const analysis = must(
        await this.db
          .from("ai_analyses")
          .insert({
            organization_id: this.org,
            conversation_id: conv.id,
            model: input.analysis.model,
            mode: input.analysis.mode,
            fan_segment: o.fan_segment,
            buying_intent: o.buying_intent,
            conversation_stage: o.conversation_stage,
            confidence: o.confidence,
            recommended_action: o.recommended_action,
            recommended_offer_id: o.recommended_offer_id,
            reasoning: o.reasoning,
            next_step: o.next_step,
            output: o,
            created_by: this.ctx.userId,
          })
          .select("id")
          .single(),
        "save analysis",
      ) as any;
      const chosen = input.analysis.chosenReply;
      const suggestions = [
        { kind: "best", body: o.best_reply },
        ...o.alternatives.map((alt) => ({ kind: alt.tone, body: alt.message })),
      ].map((s) => ({
        organization_id: this.org,
        analysis_id: analysis.id,
        kind: s.kind,
        body: s.body,
        edited_body: chosen && chosen !== s.body && s.kind === "best" ? chosen : null,
      }));
      must(await this.db.from("reply_suggestions").insert(suggestions), "save suggestions");
    }

    if (input.fanId) {
      await this.db
        .from("fans")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("id", input.fanId)
        .eq("organization_id", this.org);
    }

    return {
      id: conv.id,
      title: input.title,
      creatorId: input.creatorId,
      fanId: input.fanId,
      fanAlias: null,
      messageCount: input.messages.length,
      recommendedAction: input.analysis?.output.recommended_action ?? null,
      createdAt: conv.created_at,
    };
  }

  async deleteConversation(id: string) {
    const rows = must(
      await this.db.from("conversations").delete().eq("id", id).eq("organization_id", this.org).select("id"),
      "delete conversation",
    ) as any[];
    return rows.length > 0;
  }

  async findScreenshotByHash(sha256: string) {
    const rows = must(
      await this.db
        .from("screenshots")
        .select("id")
        .eq("organization_id", this.org)
        .eq("sha256", sha256)
        .is("deleted_at", null)
        .limit(1),
      "find screenshot",
    ) as any[];
    return rows.length > 0;
  }

  async recordScreenshot(input: ScreenshotRecordInput) {
    must(
      await this.db.from("screenshots").insert({
        organization_id: this.org,
        uploaded_by: this.ctx.userId,
        storage_path: input.storagePath,
        sha256: input.sha256,
        mime_type: input.mime,
        width: input.width,
        height: input.height,
        byte_size: input.byteSize,
        position: input.position,
        expires_at: input.expiresAt,
      }),
      "record screenshot",
    );
  }

  async recordEvent(event: EventInput) {
    must(
      await this.db.from("sales_events").insert({
        organization_id: this.org,
        event_type: event.type,
        evidence: "observed",
        conversation_id: event.conversationId ?? null,
        offer_id: event.offerId ?? null,
        actor_id: this.ctx.userId,
        metadata: event.metadata ?? {},
      }),
      "record event",
    );
  }

  async getActivityStats(): Promise<ActivityStats> {
    const count = async (type: string) => {
      const r = await this.db
        .from("sales_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", this.org)
        .eq("event_type", type);
      return r.count ?? 0;
    };
    const conversations = await this.db
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", this.org);
    const [analysesRun, repliesGenerated, repliesCopied, offersRecommended] = await Promise.all([
      count("analysis_run"),
      count("reply_generated"),
      count("reply_copied"),
      count("offer_recommended"),
    ]);
    return { conversationsSaved: conversations.count ?? 0, analysesRun, repliesGenerated, repliesCopied, offersRecommended };
  }

  async audit(action: string, resourceType: string, resourceId: string | null = null, metadata: Record<string, unknown> = {}) {
    // Audit failures must not block the user's action, but are reported.
    const r = await this.db.from("audit_logs").insert({
      organization_id: this.org,
      actor_id: this.ctx.userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
    });
    if (r.error) console.error("[swizzrizz] audit write failed");
  }

  async deleteAllConversationData() {
    const paths = must(
      await this.db.from("screenshots").select("storage_path").eq("organization_id", this.org),
      "list screenshots",
    ) as any[];
    if (paths.length) {
      await this.db.storage.from("screenshots").remove(paths.map((p) => p.storage_path));
    }
    must(await this.db.rpc("delete_organization_data", { org: this.org }), "delete organization data");
  }
}
