import type { SupabaseClient } from "@supabase/supabase-js";

export type AudienceParams = {
  includeTagIds: string[];
  excludeTagIds: string[];
  createdFromRaw: string | null; // "YYYY-MM-DD"
  createdToRaw: string | null; // "YYYY-MM-DD"
  audienceWindow: "all" | "open";
};

type ResolvedRecipientRow = { contact_id: string; has_open_window: boolean };

// Resolves a campaign's audience filters (include/exclude tags, creation
// date range, 24h window) down to the final list of contact ids that would
// receive the campaign — shared by campaign creation, editing, the "count
// recipients" preview, and the scheduler, so all four always agree.
//
// Everything (tag matching, date range, the mandatory "no seguimientos"
// exclusion, and the open-window check) is computed in a single RPC call
// (resolve_campaign_recipients) instead of a chain of REST queries chained
// with growing `?id=in.(...)` lists — a tag matching 100+ contacts used to
// build a query string long enough to get a silent 502 from nginx, which
// read back as "0 contacts" with no visible error. RPC parameters travel in
// the POST body, so this has no such ceiling.
export async function resolveCampaignAudience(
  supabase: SupabaseClient,
  workspaceId: string,
  params: AudienceParams
): Promise<{ contactIds: string[]; matchedBeforeWindow: number }> {
  const { includeTagIds, excludeTagIds, createdFromRaw, createdToRaw, audienceWindow } = params;

  // PostgREST hard-caps ANY single response (including an RPC that returns
  // a table, like this one) at 1000 rows — a tag matching more than that
  // used to make the count/send silently stop at 1000 regardless of the
  // real audience size, with no error. Page through with .range() until
  // a batch comes back short.
  const PAGE_SIZE = 1000;
  const rows: ResolvedRecipientRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("resolve_campaign_recipients", {
        p_workspace_id: workspaceId,
        p_include_tag_ids: includeTagIds.length > 0 ? includeTagIds : null,
        p_exclude_tag_ids: excludeTagIds.length > 0 ? excludeTagIds : null,
        p_created_from: createdFromRaw ? new Date(createdFromRaw).toISOString() : null,
        p_created_to: createdToRaw ? new Date(`${createdToRaw}T23:59:59.999`).toISOString() : null,
      })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("resolve_campaign_recipients failed:", error.message);
      break;
    }
    const batch = (data ?? []) as ResolvedRecipientRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  const matchedBeforeWindow = rows.length;
  const contactIds =
    audienceWindow === "open"
      ? rows.filter((r) => r.has_open_window).map((r) => r.contact_id)
      : rows.map((r) => r.contact_id);

  return { contactIds, matchedBeforeWindow };
}
