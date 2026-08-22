// Shared variable substitution for free-form text (automations, quick
// replies, campaigns) — a literal {{nombre}} token in the text gets
// replaced with the contact's name (falls back to their number if they
// don't have one saved). Case-insensitive so "{{Nombre}}" also works.
export function substituteContactVariables(
  text: string,
  contact: { name: string | null; wa_id: string }
): string {
  return text.replace(/\{\{\s*nombre\s*\}\}/gi, contact.name || contact.wa_id);
}

// Approved Meta templates only take NUMBERED {{1}}, {{2}}... placeholders,
// filled at send time via separate "components" — not the free-text
// {{nombre}} token above. Every current caller maps {{1}} in the body (and,
// if present, the one {{1}} a URL button's link is allowed to carry) to the
// contact's name, since that's the variable this feature was built for.
export function buildTemplateSendParams(
  template: {
    variable_count?: number | null;
    buttons?: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  },
  contact: { name: string | null; wa_id: string }
): {
  bodyParams: string[] | undefined;
  buttonUrlParam: { index: number; value: string } | undefined;
} {
  const contactName = contact.name || contact.wa_id;
  const bodyParams = (template.variable_count ?? 0) > 0 ? [contactName] : undefined;

  const urlButtonIndex = (template.buttons ?? []).findIndex(
    (b) => b.type === "URL" && b.url?.includes("{{1}}")
  );
  const buttonUrlParam = urlButtonIndex >= 0 ? { index: urlButtonIndex, value: contactName } : undefined;

  return { bodyParams, buttonUrlParam };
}
