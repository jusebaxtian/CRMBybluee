"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { togglePlanModule } from "@/app/actions/plans";

export function PlanModuleToggle({
  planId,
  moduleKey,
  moduleName,
  enabled,
}: {
  planId: string;
  moduleKey: string;
  moduleName: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        defaultChecked={enabled}
        disabled={pending}
        onChange={async (e) => {
          setPending(true);
          await togglePlanModule(planId, moduleKey, e.target.checked);
          setPending(false);
          router.refresh();
        }}
      />
      {moduleName}
    </label>
  );
}
