"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { maybeTrackPurchaseFromTag } from "@/lib/meta/conversions";
import { normalizeWaId } from "@/lib/phone";

type ImportRow = {
  phone: string;
  name: string | null;
  tagNames: string[];
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function matchColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseTagNames(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function rowsFromCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => normalizeHeader(h));
  const phoneIdx = matchColumn(headers, ["celular", "telefono", "phone", "numero"]);
  const nameIdx = matchColumn(headers, ["nombre", "name"]);
  const tagsIdx = matchColumn(headers, ["etiquetas", "tags", "etiqueta"]);

  const hasHeader = phoneIdx !== -1 || nameIdx !== -1 || tagsIdx !== -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const effectivePhoneIdx = phoneIdx === -1 ? 0 : phoneIdx;
  const effectiveNameIdx = nameIdx === -1 ? 1 : nameIdx;

  return dataLines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      phone: cols[effectivePhoneIdx] ?? "",
      name: cols[effectiveNameIdx] || null,
      tagNames: tagsIdx !== -1 ? parseTagNames(cols[tagsIdx]) : [],
    };
  });
}

async function rowsFromExcel(buffer: ArrayBuffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = normalizeHeader(String(cell.value ?? ""));
  });

  const phoneIdx = matchColumn(headers, ["celular", "telefono", "phone", "numero"]);
  const nameIdx = matchColumn(headers, ["nombre", "name"]);
  const tagsIdx = matchColumn(headers, ["etiquetas", "tags", "etiqueta"]);

  if (phoneIdx === -1) return [];

  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const phoneCell = row.getCell(phoneIdx + 1).value;
    const phone = phoneCell == null ? "" : String(phoneCell).trim();
    if (!phone) return;

    const nameCell = nameIdx !== -1 ? row.getCell(nameIdx + 1).value : null;
    const tagsCell = tagsIdx !== -1 ? row.getCell(tagsIdx + 1).value : null;

    rows.push({
      phone,
      name: nameCell ? String(nameCell).trim() || null : null,
      tagNames: parseTagNames(tagsCell),
    });
  });

  return rows;
}

export async function importContactsFile(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No se recibió ningún archivo." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const isExcel = file.name.toLowerCase().endsWith(".xlsx");
  const rawRows = isExcel
    ? await rowsFromExcel(await file.arrayBuffer())
    : rowsFromCsv(await file.text());

  const invalidCount = rawRows.length === 0 ? 0 : rawRows.filter((r) => !normalizeWaId(r.phone)).length;

  const byPhone = new Map<string, ImportRow>();
  for (const row of rawRows) {
    const normalized = normalizeWaId(row.phone);
    if (!normalized) continue;
    byPhone.set(normalized, { ...row, phone: normalized });
  }
  const rows = Array.from(byPhone.values());

  if (rows.length === 0) {
    return {
      error:
        "No se encontraron celulares válidos. Revisa que la columna \"Celular\" exista y tenga números de al menos 8 dígitos.",
    };
  }

  const phones = rows.map((r) => r.phone);

  const { error: upsertError } = await supabase.from("contacts").upsert(
    rows.map((r) => ({
      workspace_id: workspaceId,
      wa_id: r.phone,
      name: r.name,
    })),
    { onConflict: "workspace_id,wa_id", ignoreDuplicates: false }
  );
  if (upsertError) return { error: upsertError.message };

  const uniqueTagNames = Array.from(new Set(rows.flatMap((r) => r.tagNames)));
  if (uniqueTagNames.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from("tags")
      .upsert(
        uniqueTagNames.map((name) => ({ workspace_id: workspaceId, name })),
        { onConflict: "workspace_id,name", ignoreDuplicates: true }
      )
      .select("id, name");

    let tagIdByName = new Map((tagRows ?? []).map((t) => [t.name, t.id]));
    if (tagError || tagIdByName.size < uniqueTagNames.length) {
      const { data: allTags } = await supabase
        .from("tags")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .in("name", uniqueTagNames);
      tagIdByName = new Map((allTags ?? []).map((t) => [t.name, t.id]));
    }

    // `.in("wa_id", phones)` builds a `?wa_id=in.(573...,573...,...)` query
    // string — with a large import (thousands of phones) that trips
    // nginx's URL-length limit the same way the old bulk-delete/campaign
    // bugs did. No filter needed instead: page through every contact in
    // the workspace (workspace_id alone keeps the URL short regardless of
    // row count) and just look up by phone in memory.
    const phoneSet = new Set(phones);
    const contactIdByPhone = new Map<string, string>();
    const CONTACT_PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += CONTACT_PAGE_SIZE) {
      const { data: batch } = await supabase
        .from("contacts")
        .select("id, wa_id")
        .eq("workspace_id", workspaceId)
        .range(offset, offset + CONTACT_PAGE_SIZE - 1);
      if (!batch || batch.length === 0) break;
      for (const c of batch) {
        if (phoneSet.has(c.wa_id)) contactIdByPhone.set(c.wa_id, c.id);
      }
      if (batch.length < CONTACT_PAGE_SIZE) break;
    }

    const contactTagRows: { contact_id: string; tag_id: string }[] = [];
    for (const row of rows) {
      const contactId = contactIdByPhone.get(row.phone);
      if (!contactId) continue;
      for (const tagName of row.tagNames) {
        const tagId = tagIdByName.get(tagName);
        if (tagId) contactTagRows.push({ contact_id: contactId, tag_id: tagId });
      }
    }

    if (contactTagRows.length > 0) {
      await supabase
        .from("contact_tags")
        .upsert(contactTagRows, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    }
  }

  revalidatePath("/dashboard/contacts");
  return {
    success: true,
    count: rows.length,
    skipped: invalidCount,
  };
}

export async function createContact(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/[^0-9]/g, "");

  if (phone.length < 8) return { error: "Ingresa un número válido con código de país." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase.from("contacts").upsert(
    { workspace_id: workspaceId, wa_id: phone, name: name || null },
    { onConflict: "workspace_id,wa_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/contacts");
  return { success: true };
}

export async function updateContactNotes(contactId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ notes })
    .eq("id", contactId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inbox");
  return { success: true };
}

export async function updateContact(contactId: string, name: string, phone: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length < 8) return { error: "Ingresa un número válido con código de país." };

  const { error } = await supabase
    .from("contacts")
    .update({ name: name.trim() || null, wa_id: cleanPhone })
    .eq("id", contactId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/contacts");
  return { success: true };
}

const MAX_BULK_DELETE = 1000;

export async function bulkDeleteContacts(contactIds: string[]) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };
  if (contactIds.length === 0) return { error: "No hay contactos seleccionados." };
  // Enforced here too, not just in the UI — the RPC itself (see 0073) can
  // handle far more than this in one call, but capping the batch size keeps
  // any single delete (and its cascade to conversations/messages) short and
  // predictable instead of one huge transaction holding locks for a while.
  if (contactIds.length > MAX_BULK_DELETE) {
    return { error: `Puedes eliminar máximo ${MAX_BULK_DELETE} contactos a la vez.` };
  }

  // `.in("id", contactIds)` builds a `?id=in.(uuid,uuid,...)` query string —
  // with hundreds of contacts selected (e.g. "eliminar todos") that trips
  // nginx's URL-length limit and comes back as a literal 414, not a
  // catchable error. RPC sends the id list in the POST body instead.
  const { error } = await supabase.rpc("bulk_delete_contacts", {
    p_workspace_id: workspaceId,
    p_contact_ids: contactIds,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/contacts");
  return { success: true };
}

export async function bulkAddTagToContacts(contactIds: string[], tagId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };
  if (contactIds.length === 0) return { error: "No hay contactos seleccionados." };
  if (!tagId) return { error: "Selecciona una etiqueta." };

  const { error } = await supabase
    .from("contact_tags")
    .upsert(
      contactIds.map((contactId) => ({ contact_id: contactId, tag_id: tagId })),
      { onConflict: "contact_id,tag_id", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };

  await Promise.all(
    contactIds.map((contactId) => maybeTrackPurchaseFromTag(supabase, workspaceId, contactId, tagId))
  );

  revalidatePath("/dashboard/contacts");
  return { success: true };
}

// Manual override for the automatic "likely_blocked" flag (see
// UNREACHABLE_ERROR_CODES in ingest.ts) — an agent may know the number is
// actually fine (e.g. a typo got corrected) and want to resume automated
// sends to it without waiting for a successful delivery to clear it.
export async function resetContactBlockedStatus(contactId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ consecutive_failures: 0, likely_blocked: false })
    .eq("id", contactId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/inbox");
  return { success: true as const };
}
