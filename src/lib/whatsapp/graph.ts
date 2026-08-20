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

// Embedded Signup's own OTP check (code_verification_status: VERIFIED)
// confirms the business owns the number, but that's a separate thing from
// actually *registering* it on the Cloud API — skip this and every send
// fails with "Registra este número de teléfono con la API de registro..."
// even though the number looks fully connected everywhere else. A fixed PIN
// is fine here: nothing in this app's flow ever re-registers the number
// interactively, so there's no real 2FA challenge to remember it for.
export async function registerPhoneNumber(phoneNumberId: string, accessToken: string) {
  return graphFetch(`/${phoneNumberId}/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", pin: "246813" }),
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
  body: string,
  // Quotes an earlier message ("swipe to reply") when set — Meta shows it
  // as a small reply preview above this message, same as the WhatsApp app.
  replyToWaMessageId?: string
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
      ...(replyToWaMessageId ? { context: { message_id: replyToWaMessageId } } : {}),
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
    headerMedia?: { format: "IMAGE" | "VIDEO" | "DOCUMENT"; handle: string };
    bodyText: string;
    footerText?: string;
  }
): Promise<{ id: string; status: string; category: string }> {
  const components: Record<string, unknown>[] = [];

  if (input.headerMedia) {
    components.push({
      type: "HEADER",
      format: input.headerMedia.format,
      example: { header_handle: [input.headerMedia.handle] },
    });
  } else if (input.headerText) {
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

export async function deleteMetaTemplate(
  wabaId: string,
  accessToken: string,
  templateName: string
): Promise<void> {
  await graphFetch(`/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Template media headers require the file to already exist on Meta's side
// as an "example" before the template can be submitted for review — done via
// the app-level Resumable Upload API (distinct from the phone-number media
// endpoint used for regular chat sends). Two steps: open a session sized for
// the file, then upload the bytes in one shot and get back a reusable handle.
export async function uploadTemplateHeaderExample(
  appId: string,
  accessToken: string,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const sessionRes = await fetch(
    `${GRAPH_BASE}/${appId}/uploads?file_name=${encodeURIComponent(filename)}&file_length=${buffer.byteLength}&file_type=${encodeURIComponent(mimeType)}&access_token=${encodeURIComponent(accessToken)}`,
    { method: "POST" }
  );
  const session = await sessionRes.json();
  if (!sessionRes.ok || !session.id) {
    throw new Error(session?.error?.message ?? "No se pudo iniciar la subida del archivo de ejemplo.");
  }

  const uploadRes = await fetch(`${GRAPH_BASE}/${session.id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      "file_offset": "0",
    },
    body: new Uint8Array(buffer),
  });
  const uploaded = await uploadRes.json();
  if (!uploadRes.ok || !uploaded.h) {
    throw new Error(uploaded?.error?.message ?? "No se pudo subir el archivo de ejemplo a Meta.");
  }
  return uploaded.h as string;
}

// Uploads a file straight to Meta's media storage and returns its media id.
// Sending audio by id (instead of by link) makes Meta fetch/validate the
// file synchronously at upload time — sending by link instead defers that to
// an async CDN fetch that can succeed (message shows "delivered") while still
// leaving the recipient with an unplayable voice note ("no disponible").
export async function uploadMedia(
  phoneNumberId: string,
  accessToken: string,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "No se pudo subir el archivo a WhatsApp.");
  }
  return data.id as string;
}

export async function sendMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  type: "image" | "audio" | "video" | "document",
  source: { link: string } | { id: string },
  filename?: string,
  caption?: string
): Promise<{ messages: { id: string }[] }> {
  const mediaObject: Record<string, unknown> = { ...source };
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
  language: string,
  bodyParams?: string[],
  headerMedia?: { type: "image" | "video" | "document"; link: string }
): Promise<{ messages: { id: string }[] }> {
  const template: Record<string, unknown> = { name: templateName, language: { code: language } };
  const components: Record<string, unknown>[] = [];

  if (headerMedia) {
    components.push({
      type: "header",
      parameters: [{ type: headerMedia.type, [headerMedia.type]: { link: headerMedia.link } }],
    });
  }
  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  if (components.length > 0) template.components = components;

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
      template,
    }),
  });
}
