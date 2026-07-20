const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graphFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Meta Graph API request failed");
  }
  return data;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    code,
  });
  const data = await graphFetch(`/oauth/access_token?${params.toString()}`);
  return data.access_token as string;
}

export async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  return graphFetch(`/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string
): Promise<{ display_phone_number: string; verified_name: string }> {
  return graphFetch(
    `/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export type PhoneNumberStatus = {
  display_phone_number: string;
  verified_name: string;
  code_verification_status: string;
  quality_rating: string;
  name_status?: string;
  messaging_limit_tier?: string;
};

export async function getPhoneNumberStatus(
  phoneNumberId: string,
  accessToken: string
): Promise<PhoneNumberStatus> {
  return graphFetch(
    `/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,name_status,messaging_limit_tier`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string
): Promise<{ messages: { id: string }[] }> {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
}

export type MetaTemplate = {
  name: string;
  language: string;
  status: string;
  category: string;
  components: { type: string; text?: string }[];
};

export async function listTemplates(
  wabaId: string,
  accessToken: string
): Promise<MetaTemplate[]> {
  const data = await graphFetch(
    `/${wabaId}/message_templates?fields=name,language,status,category,components&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data.data as MetaTemplate[];
}

export async function createMetaTemplate(
  wabaId: string,
  accessToken: string,
  input: {
    name: string;
    language: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
    headerText?: string;
    bodyText: string;
    footerText?: string;
  }
): Promise<{ id: string; status: string; category: string }> {
  const components: Record<string, unknown>[] = [];

  if (input.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: input.headerText });
  }
  components.push({ type: "BODY", text: input.bodyText });
  if (input.footerText) {
    components.push({ type: "FOOTER", text: input.footerText });
  }

  return graphFetch(`/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components,
    }),
  });
}

export async function sendMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  type: "image" | "audio" | "video" | "document",
  link: string,
  filename?: string,
  caption?: string
): Promise<{ messages: { id: string }[] }> {
  const mediaObject: Record<string, unknown> = { link };
  if (type === "document" && filename) mediaObject.filename = filename;
  // Audio messages don't support captions in the Cloud API.
  if (type !== "audio" && caption) mediaObject.caption = caption;

  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type,
      [type]: mediaObject,
    }),
  });
}

export async function getMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<{ url: string; mime_type: string }> {
  return graphFetch(`/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function downloadMedia(url: string, accessToken: string): Promise<Blob> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("No se pudo descargar el archivo multimedia.");
  return res.blob();
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  language: string
): Promise<{ messages: { id: string }[] }> {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: templateName, language: { code: language } },
    }),
  });
}
