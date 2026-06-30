import { supabase } from "@/integrations/supabase/client";

export async function signedUrl(bucket: string, path: string, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("signedUrl error", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export function fileExt(name: string) {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "bin";
}
