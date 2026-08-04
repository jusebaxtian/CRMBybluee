"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { runTagAddedAutomations } from "@/lib/automations/engine";

export async function createTag(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#1ba84a");
  const excludesFollowups = formData.get("excludesFollowups") === "on";
  if (!name) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase.from("tags").insert({
    workspace_id: workspaceId,
    name,
    color,
    excludes_followups: excludesFollowups,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tags");
  return { success: true };
}

export async function updateTag(tagId: string, input: { name: string; color: string }) {
  const name = input.name.trim();
  const color = input.color.trim();
  if (!name) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("tags")
    .update({ name, color })
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
