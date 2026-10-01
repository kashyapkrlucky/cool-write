import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z
  .object({
    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: optionalString,
    NEXTAUTH_SECRET: optionalString,
    GOOGLE_CLIENT_ID: z.string().trim().min(1, "GOOGLE_CLIENT_ID is required"),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1, "GOOGLE_CLIENT_SECRET is required"),
    OPENAI_API_KEY: optionalString,
    OPENAI_MODEL: z.string().trim().default("gpt-4o-mini"),
    AI_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
    AI_REQUESTS_PER_DAY: z.coerce.number().int().positive().default(200),
    // Desktop builds. Local driver: a directory on disk
    // (default ./files). Remote driver: a base URL where the same tree is
    // hosted — required on serverless hosts such as Vercel.
    DESKTOP_RELEASES_DIR: optionalString,
    DESKTOP_RELEASES_URL: z.url({ protocol: /^https?$/ }).optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((env) => env.AUTH_SECRET || env.NEXTAUTH_SECRET, {
    message: "AUTH_SECRET (or NEXTAUTH_SECRET) is required",
    path: ["AUTH_SECRET"],
  })
  .transform(({ NEXTAUTH_SECRET, ...env }) => ({
    ...env,
    AUTH_SECRET: (env.AUTH_SECRET ?? NEXTAUTH_SECRET) as string,
  }));

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

// Validated lazily on first use so a misconfigured deployment fails with a clear
// message instead of an obscure runtime error deep inside a request.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
