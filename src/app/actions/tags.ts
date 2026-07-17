"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export async function createTag(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#7c5cff");
  if (!name) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase.from("tags").insert({
    workspace_id: workspaceId,
    name,
    color,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tags");
  return { success: true };
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
  } else {
    await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", input.contactId)
      .eq("tag_id", input.tagId);
  }

  revalidatePath("/dashboard/contacts");
}
