import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!authorization || !supabaseUrl || !supabaseKey) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // Verify the currently signed-in user.
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json(
      { error: "Please sign in to search for traders." },
      { status: 401, headers: corsHeaders },
    );
  }

  // The service-role key must remain server-side.
  const serviceRoleKey = Deno.env.get("PINFOLIO_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("Missing PINFOLIO_SERVICE_ROLE_KEY");

    return Response.json(
      { error: "Trader search is not configured." },
      { status: 500, headers: corsHeaders },
    );
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Read and validate the requested username.
  let body: { username?: unknown };

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid request body." },
      { status: 400, headers: corsHeaders },
    );
  }

  if (
    typeof body.username !== "string" ||
    !/^[a-zA-Z0-9_.-]{2,30}$/.test(body.username.trim().replace(/^@/, ""))
  ) {
    return Response.json(
      { error: "Enter a username between 2 and 30 characters.",
        },
      { status: 400, headers: corsHeaders },
    );
  }

  const username = body.username.trim().replace(/^@/, "").toLowerCase();

  // Find a profile by username, excluding the signed-in user.
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .eq("is_collection_public", true)
    .neq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Trader profile lookup failed:",
      profileError.message,
    );

    return Response.json(
      { error: "Unable to search for traders right now." },
      { status: 500, headers: corsHeaders },
    );
  }

  return Response.json(
    {
      user: profile
        ? {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : null,
      message: profile
        ? "Trader found."
        : "No matching trader found. Check the username and make sure their profile is discoverable.",
    },
    { status: 200, headers: corsHeaders },
  );
});