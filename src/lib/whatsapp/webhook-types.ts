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
          // A tap-and-hold reaction (👍/❤️/etc.) on one of our messages.
          // emoji is "" when the customer removed a previously-set reaction.
          reaction?: { message_id: string; emoji: string };
          // Present when the customer replied by swiping/quoting a specific
          // earlier message instead of sending a plain message.
          context?: { from: string; id: string };
          // Present only on the first inbound message of a "Click to
          // WhatsApp" ad conversation — identifies which Meta ad it came from.
          referral?: {
            source_type?: string;
            source_id?: string;
            headline?: string;
            body?: string;
            ctwa_clid?: string;
          };
        }[];
        statuses?: {
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          errors?: { code: number; title: string; message?: string; error_data?: { details?: string } }[];
          // Present on the "sent" status update — Meta's own conversation id
          // plus how it was opened. "business_initiated" is the kind that
          // counts against the account's daily messaging limit tier.
          conversation?: { id: string; origin?: { type: string } };
        }[];
      };
    }[];
  }[];
};
