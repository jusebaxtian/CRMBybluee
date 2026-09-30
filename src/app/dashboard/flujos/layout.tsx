import type { ReactNode } from "react";
import { CampaignsSection } from "@/components/layout/campaigns-section";

export default function Layout({ children }: { children: ReactNode }) {
  return <CampaignsSection>{children}</CampaignsSection>;
}
