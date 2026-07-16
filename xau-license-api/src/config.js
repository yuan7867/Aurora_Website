function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const config = {
    port: Number(env.PORT || 8000),
    databaseUrl: env.DATABASE_URL || "",
    licenseKeyPepper: env.LICENSE_KEY_PEPPER || "",
    internalToken: env.LICENSE_API_INTERNAL_TOKEN || "",
    nodeEnv: env.NODE_ENV || "production"
  };

  if (!config.databaseUrl) {
    required("DATABASE_URL");
  }
  if (!config.licenseKeyPepper) {
    required("LICENSE_KEY_PEPPER");
  }
  if (!config.internalToken) {
    required("LICENSE_API_INTERNAL_TOKEN");
  }

  return config;
}
