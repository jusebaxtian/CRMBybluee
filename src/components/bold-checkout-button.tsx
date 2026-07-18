"use client";

import Script from "next/script";

export function BoldCheckoutButton({
  orderId,
  amountCents,
  currency,
  signature,
  apiKey,
  description,
}: {
  orderId: string;
  amountCents: number;
  currency: string;
  signature: string;
  apiKey: string;
  description: string;
}) {
  return (
    <div>
      <Script
        src="https://checkout.bold.co/library/boldPaymentButton.js"
        strategy="afterInteractive"
      />
      <script
        data-bold-button="dark-M"
        data-order-id={orderId}
        data-currency={currency}
        data-amount={amountCents}
        data-api-key={apiKey}
        data-integrity-signature={signature}
        data-description={description}
        data-redirection-url="https://crmbybluee.blue/dashboard/billing"
      />
    </div>
  );
}
