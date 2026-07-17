function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT || 8000),
    databaseUrl: required("DATABASE_URL"),
    internalToken: required("MT5_LICENSE_INTERNAL_TOKEN"),
    licenseKeyPepper: required("MT5_LICENSE_KEY_PEPPER"),
    recoveryEncryptionKey: required("MT5_LICENSE_RECOVERY_ENCRYPTION_KEY")
  };
}
