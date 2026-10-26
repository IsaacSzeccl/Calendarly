// Prints which settings are present or missing. Never prints a value.
// Run: npm run check:env
import { loadEnvConfig } from "@next/env";

const { loadedEnvFiles } = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const groups: Record<string, string[]> = {
  "Supabase (database, sign-in)": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  "AI model (Z.ai GLM)": ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"],
  "Google Calendar": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  "Email (Brevo SMTP)": [
    "BREVO_SMTP_HOST",
    "BREVO_SMTP_PORT",
    "BREVO_SMTP_USER",
    "BREVO_SMTP_KEY",
    "EMAIL_FROM",
  ],
  App: ["APP_URL", "TOKEN_ENCRYPTION_KEY"],
};

const expected = new Set(Object.values(groups).flat());
console.log(`Env files loaded: ${loadedEnvFiles.map((f) => f.path).join(", ") || "none"}\n`);
for (const [group, names] of Object.entries(groups)) {
  console.log(group);
  for (const name of names) {
    console.log(`  ${process.env[name] ? "✓ set    " : "✗ missing"} ${name}`);
  }
}

const others = new Set<string>();
for (const file of loadedEnvFiles) {
  for (const name of Object.keys(file.env)) if (!expected.has(name)) others.add(name);
}
if (others.size) {
  console.log(`\nOther names in env files (not used by the app): ${[...others].sort().join(", ")}`);
}
