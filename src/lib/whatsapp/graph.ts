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
