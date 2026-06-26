const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  "https://rpubymahfervlxdmmqfx.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

async function fixUsers() {
  console.log("Testing connection...");
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error.message);
    return;
  }
  console.log("Users listed successfully. Count:", data.users.length);
}

fixUsers();
