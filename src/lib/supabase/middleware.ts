import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_SERVER_URL, SUPABASE_ANON_KEY, SUPABASE_COOKIE_NAME } from "./config";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    SUPABASE_ANON_KEY,
    {
      cookieOptions: { name: SUPABASE_COOKIE_NAME },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if expired — required for Server Components to see a valid session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user && pathname.startsWith("/dashboard")) {
    // Platform admins impersonating a workspace bypass every gate below —
    // they need full access to support a locked-out or agent-only account.
    const impersonatedId = request.cookies.get("impersonate_workspace_id")?.value;
    let isImpersonatingAdmin = false;
    if (impersonatedId) {
      const { data: adminRow } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      isImpersonatingAdmin = !!adminRow;
    }

    if (!isImpersonatingAdmin) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("role, workspaces(status)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const workspaceStatus = (membership as unknown as { workspaces: { status: string } | null })
        ?.workspaces?.status;

      // Trial expired or payment lapsed: total lockout except Facturación,
      // for every role — there's nothing to do in the app until they pay.
      if (
        (workspaceStatus === "past_due" || workspaceStatus === "canceled") &&
        !pathname.startsWith("/dashboard/billing")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/billing";
        return NextResponse.redirect(url);
      }

      // Agents only get the inbox — every other /dashboard/* route bounces back there.
      if (membership?.role === "agent" && !pathname.startsWith("/dashboard/inbox")) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/inbox";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
