import type { SaveConversationInput, VoiceInput } from "@/lib/domain/schemas";
import type {
  ActivityStats,
  ConversationRecord,
  ConversationSummary,
  Creator,
  Fan,
  Offer,
  OrgSettings,
  Voice,
} from "@/lib/domain/types";

export type ObservedEvent =
  | "analysis_run"
  | "reply_generated"
  | "reply_copied"
  | "offer_recommended"
  | "offer_presented"
  | "conversation_saved";

export interface EventInput {
  type: ObservedEvent;
  conversationId?: string | null;
  offerId?: string | null;
  /** Counts and ids only. Never message text. */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ScreenshotRecordInput {
  storagePath: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  byteSize: number;
  position: number;
  expiresAt: string;
}

/**
 * Data access, always scoped to one authenticated organization. Implementations take
 * the AuthContext at construction and never accept an organization id from a request.
 */
export interface Repository {
  getSettings(): Promise<OrgSettings>;
  updateSettings(settings: OrgSettings): Promise<OrgSettings>;

  listCreators(): Promise<Creator[]>;

  listVoices(): Promise<Voice[]>;
  saveVoice(id: string | null, input: VoiceInput): Promise<Voice>;
  deleteVoice(id: string): Promise<boolean>;

  listFans(creatorId?: string): Promise<Fan[]>;
  getFan(id: string): Promise<Fan | null>;
  createFan(creatorId: string, alias: string): Promise<Fan>;

  listOffers(creatorId?: string): Promise<Offer[]>;

  listConversations(): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationRecord | null>;
  saveConversation(input: SaveConversationInput): Promise<ConversationSummary>;
  deleteConversation(id: string): Promise<boolean>;

  findScreenshotByHash(sha256: string): Promise<boolean>;
  recordScreenshot(input: ScreenshotRecordInput): Promise<void>;

  recordEvent(event: EventInput): Promise<void>;
  getActivityStats(): Promise<ActivityStats>;

  audit(action: string, resourceType: string, resourceId?: string | null, metadata?: Record<string, unknown>): Promise<void>;

  /** Removes every conversation, message, screenshot record, fan and event for the org. */
  deleteAllConversationData(): Promise<void>;
}
