export type WhatsAppWebhookPayload = {
  object: string;
  entry: {
    id: string;
    changes: {
      field: string;
      value: {
        metadata?: { display_phone_number: string; phone_number_id: string };
        // "user_id" (BSUID) has been present alongside "wa_id" on every
        // inbound contact/message since 2026-03-31 — see BSUID migration
        // notes in the 0025_bsuid_support migration.
        contacts?: { profile?: { name?: string }; wa_id: string; user_id?: string }[];
        messages?: {
          from: string;
          user_id?: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; caption?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename?: string; caption?: string };
        }[];
        statuses?: {
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          errors?: { code: number; title: string; message?: string; error_data?: { details?: string } }[];
        }[];
      };
    }[];
  }[];
};
