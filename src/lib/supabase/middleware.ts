import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  // Agents only get the inbox — every other /dashboard/* route bounces back there.
  const pathname = request.nextUrl.pathname;
  if (user && pathname.startsWith("/dashboard") && !pathname.startsWith("/dashboard/inbox")) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership?.role === "agent") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/inbox";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
