import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type AudienceParams = {
  includeTagIds: string[];
  excludeTagIds: string[];
  createdFromRaw: string | null; // "YYYY-MM-DD"
  createdToRaw: string | null; // "YYYY-MM-DD"
  audienceWindow: "all" | "open";
};

// Contacts whose most recent inbound message is still within the 24h
// window — i.e. WhatsApp will accept a free-form (non-template) message to
// them right now. Loads every conversation for the given contacts and their
// most recent inbound message, same approach the inbox list uses.
export async function filterContactsWithOpenWindow(
  supabase: SupabaseClient,
  workspaceId: string,
  contactIds: string[]
): Promise<string[]> {
  if (contactIds.length === 0) return [];

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .eq("workspace_id", workspaceId)
    .in("contact_id", contactIds);
  if (!conversations || conversations.length === 0) return [];

  const conversationIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, created_at")
    .in("conversation_id", conversationIds)
    .eq("direction", "in")
    .order("created_at", { ascending: false });

  const lastInboundByConversation = new Map<string, string>();
  for (const m of messages ?? []) {
    if (!lastInboundByConversation.has(m.conversation_id)) {
      lastInboundByConversation.set(m.conversation_id, m.created_at);
    }
  }

  const now = Date.now();
  const openContactIds = new Set<string>();
  for (const c of conversations) {
    const lastInboundAt = lastInboundByConversation.get(c.id);
    if (lastInboundAt && now - new Date(lastInboundAt).getTime() < WINDOW_MS) {
      openContactIds.add(c.contact_id);
    }
  }

  return contactIds.filter((id) => openContactIds.has(id));
}

// Resolves a campaign's audience filters (include/exclude tags, creation
// date range, 24h window) down to the final list of contact ids that would
// receive the campaign — shared by campaign creation, editing, the "count
// recipients" preview, and the scheduler, so all four always agree.
export async function resolveCampaignAudience(
  supabase: SupabaseClient,
  workspaceId: string,
  params: AudienceParams
): Promise<{ contactIds: string[]; matchedBeforeWindow: number }> {
  const { includeTagIds, excludeTagIds, createdFromRaw, createdToRaw, audienceWindow } = params;

  let contactsQuery = supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("likely_blocked", false);

  if (createdFromRaw) contactsQuery = contactsQuery.gte("created_at", new Date(createdFromRaw).toISOString());
  if (createdToRaw) contactsQuery = contactsQuery.lte("created_at", new Date(`${createdToRaw}T23:59:59.999`).toISOString());

  if (includeTagIds.length > 0) {
    const { data: taggedContacts } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .in("tag_id", includeTagIds);
    const ids = Array.from(new Set((taggedContacts ?? []).map((c) => c.contact_id)));
    contactsQuery = contactsQuery.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: contacts } = await contactsQuery;
  let contactIds = (contacts ?? []).map((c) => c.id);

  if (excludeTagIds.length > 0 && contactIds.length > 0) {
    const { data: excludedContacts } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .in("tag_id", excludeTagIds)
      .in("contact_id", contactIds);
    const excludedIds = new Set((excludedContacts ?? []).map((c) => c.contact_id));
    contactIds = contactIds.filter((id) => !excludedIds.has(id));
  }

  // Hard, non-optional rule: a contact carrying ANY "excludes_followups"
  // tag (e.g. "No seguimientos") must never receive a mass campaign,
  // regardless of what the admin picked in the include/exclude tag
  // pickers — mass sends are opt-out-proof by design. Only manual chat
  // messages/templates sent from the inbox are allowed to reach them.
  if (contactIds.length > 0) {
    const { data: noFollowupTags } = await supabase
      .from("tags")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("excludes_followups", true);
    const noFollowupTagIds = (noFollowupTags ?? []).map((t) => t.id);

    if (noFollowupTagIds.length > 0) {
      const { data: excludedContacts } = await supabase
        .from("contact_tags")
        .select("contact_id")
        .in("tag_id", noFollowupTagIds)
        .in("contact_id", contactIds);
      const excludedIds = new Set((excludedContacts ?? []).map((c) => c.contact_id));
      contactIds = contactIds.filter((id) => !excludedIds.has(id));
    }
  }

  const matchedBeforeWindow = contactIds.length;
  if (audienceWindow === "open") {
    contactIds = await filterContactsWithOpenWindow(supabase, workspaceId, contactIds);
  }

  return { contactIds, matchedBeforeWindow };
}
