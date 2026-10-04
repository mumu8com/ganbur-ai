import {createClient} from "../../../lib/supabase/server";
import {NextResponse} from "next/server";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/";

  const supabase = await createClient();
  let error = null;

  if (code) {
    ({error} = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({error} = await supabase.auth.verifyOtp({type, token_hash: tokenHash}));
  } else {
    error = new Error("Missing confirmation parameters");
  }

  const destination = new URL(error ? "/login" : next, url.origin);
  if (error) destination.searchParams.set("error", "auth_confirmation_failed");
  return NextResponse.redirect(destination);
}
