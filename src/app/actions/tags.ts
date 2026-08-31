"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { runTagAddedAutomations } from "@/lib/automations/engine";
import { maybeTrackPurchaseFromTag } from "@/lib/meta/conversions";

export async function createTag(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#1ba84a");
  const excludesFollowups = formData.get("excludesFollowups") === "on";
  const marksPurchase = formData.get("marksPurchase") === "on";
  if (!name) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase.from("tags").insert({
    workspace_id: workspaceId,
    name,
    color,
    excludes_followups: excludesFollowups,
    marks_purchase: marksPurchase,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tags");
  return { success: true };
}

export async function updateTag(
  tagId: string,
  input: { name: string; color: string; excludesFollowups: boolean; marksPurchase?: boolean }
) {
  const name = input.name.trim();
  const color = input.color.trim();
  if (!name) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("tags")
    .update({
      name,
      color,
      excludes_followups: input.excludesFollowups,
      ...(input.marksPurchase !== undefined ? { marks_purchase: input.marksPurchase } : {}),
    })
    .eq("id", tagId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/tags");
  revalidatePath("/dashboard/contacts");
  return { success: true as const };
}

// Contacts with an "excludes_followups" tag (e.g. "Ya compró", "No interesados")
// never get another automation step — keyword, tag_added, or follow-up
// sequences — regardless of the conversation's own toggle. Checked both when
// a follow-up sequence is first scheduled and again right before it fires;
// keyword/tag_added automations check it inline before running.
export async function toggleTagExcludesFollowups(tagId: string, excludesFollowups: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .update({ excludes_followups: excludesFollowups })
    .eq("id", tagId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/tags");
  return { success: true as const };
}

// Contacts tagged with a "marks_purchase" tag (e.g. "Compró") report a
// Purchase event back to Meta's Conversions API using their conversation's
// ctwa_clid, if they came from a Click-to-WhatsApp ad — see src/lib/meta/conversions.ts.
export async function toggleTagMarksPurchase(tagId: string, marksPurchase: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("tags").update({ marks_purchase: marksPurchase }).eq("id", tagId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/tags");
  return { success: true as const };
}

export async function deleteTag(tagId: string) {
  const supabase = await createClient();
  await supabase.from("tags").delete().eq("id", tagId);
  revalidatePath("/dashboard/tags");
  revalidatePath("/dashboard/contacts");
}

export async function toggleContactTag(input: {
  contactId: string;
  tagId: string;
  assign: boolean;
}) {
  const supabase = await createClient();

  if (input.assign) {
    await supabase
      .from("contact_tags")
      .insert({ contact_id: input.contactId, tag_id: input.tagId });

    const workspaceId = await getWorkspaceId(supabase);
    if (workspaceId) {
      await runTagAddedAutomations(supabase, workspaceId, input.contactId, input.tagId);
      await maybeTrackPurchaseFromTag(supabase, workspaceId, input.contactId, input.tagId);
    }
  } else {
    await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", input.contactId)
      .eq("tag_id", input.tagId);
  }

  revalidatePath("/dashboard/contacts");
}

// Persists the drag-and-drop order from the dashboard's tag stats table —
// `orderedTagIds` is the full list in its new order, position = index.
export async function reorderTags(orderedTagIds: string[]) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  await Promise.all(
    orderedTagIds.map((tagId, index) =>
      supabase.from("tags").update({ position: index }).eq("id", tagId).eq("workspace_id", workspaceId)
    )
  );

  revalidatePath("/dashboard");
  return { success: true as const };
}
