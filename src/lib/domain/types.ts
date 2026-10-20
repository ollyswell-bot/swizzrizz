import type { AnalysisOutput, TranscriptMessage, VoiceInput } from "./schemas";

export type Role = "owner" | "admin" | "operator" | "viewer";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
  email: string | null;
  authorizationConfirmed: boolean;
  mode: "demo" | "supabase";
}

export interface Creator {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Voice extends VoiceInput {
  id: string;
  updatedAt: string;
}

export interface Fan {
  id: string;
  creatorId: string;
  alias: string;
  segment: "new" | "returning" | "vip" | "lapsed" | "unknown";
  approvedNotes: string;
  contentPreferences: string[];
  communicationBoundaries: string[];
  firstInteractionAt: string | null;
  lastInteractionAt: string | null;
  followUpStatus: string;
  purchaseCount: number;
  purchasedOfferIds: string[];
  lastSummary: string | null;
  isSample: boolean;
}

export interface OfferEligibility {
  segments?: Fan["segment"][];
  minPriorPurchases?: number;
}

export interface Offer {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  category: string;
  includedContent: string;
  isActive: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  eligibility: OfferEligibility;
  bundleOfferIds: string[];
  isSample: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  creatorId: string;
  fanId: string | null;
  fanAlias: string | null;
  messageCount: number;
  recommendedAction: string | null;
  createdAt: string;
}

export interface ConversationRecord extends ConversationSummary {
  messages: TranscriptMessage[];
  analysis: (AnalysisOutput & { mode: "live" | "mock"; model: string }) | null;
}

/** Counts of things the app observed. None of these are sales. */
export interface ActivityStats {
  conversationsSaved: number;
  analysesRun: number;
  repliesGenerated: number;
  repliesCopied: number;
  offersRecommended: number;
}

export interface OrgSettings {
  retentionHours: number;
}
