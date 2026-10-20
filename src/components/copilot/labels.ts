export const ACTION_LABELS: Record<string, string> = {
  continue_conversation: "Keep the conversation going",
  build_rapport: "Build rapport",
  ask_question: "Ask a question",
  present_offer: "Present an offer",
  follow_up_later: "Follow up later",
  no_sale: "No sale right now",
  escalate_to_human: "Escalate to a lead operator",
};

export const INTENT_LABELS: Record<string, string> = {
  none: "No buying intent",
  low: "Low intent",
  medium: "Some intent",
  high: "Strong intent",
  unknown: "Intent unclear",
};

export const SEGMENT_LABELS: Record<string, string> = {
  new: "New",
  returning: "Returning",
  vip: "VIP",
  lapsed: "Lapsed",
  unknown: "Unknown",
};
