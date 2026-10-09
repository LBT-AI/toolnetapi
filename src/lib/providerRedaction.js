/**
 * Redacts secret-bearing fields from a connection's providerSpecificData before
 * it is serialized to an API response. Server-side code (executors, credential
 * resolution) reads the raw record straight from the DB and is unaffected.
 *
 * Never expose authToken, fingerprintId, fingerprintHash or cookies to the
 * dashboard/API clients.
 */
const REDACTED_KEYS = [
  "authToken",
  "accessToken",
  "refreshToken",
  "idToken",
  "sessionToken",
  "fingerprintHash",
  "fingerprintId",
  "cookies",
  "cookie",
];

export function redactProviderSecrets(provider, providerSpecificData) {
  if (!providerSpecificData || typeof providerSpecificData !== "object") {
    return providerSpecificData;
  }
  const clone = { ...providerSpecificData };
  for (const key of REDACTED_KEYS) {
    if (key in clone) delete clone[key];
  }
  return clone;
}
