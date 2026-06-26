const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://angcserifzxynvvgvruz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuZ2NzZXJpZnp4eW52dmd2cnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjY4NjcsImV4cCI6MjA5NzQwMjg2N30.e065-3qnCIRbt62QiKVeW_9ZOvh1cLPaZXUFo-rsbFY",
);

supabase.auth
  .signInWithPassword({
    email: "admin@portalej.test",
    password: "WrongPassword!!!",
  })
  .then((r) => console.log("Result:", JSON.stringify(r.error, null, 2)))
  .catch((e) => console.error("Caught Exception:", e));
