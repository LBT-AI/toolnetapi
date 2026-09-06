import { generateRootCA, loadRootCA, generateLeafCert } from "./rootCA.js";

export function generateCert() {
  return generateRootCA();
}

export function getCertForDomain(domain) {
  try {
    const rootCA = loadRootCA();
    const leafCert = generateLeafCert(domain, rootCA);
    return {
      key: leafCert.key,
      cert: leafCert.cert
    };
  } catch (error) {
    console.error(`Failed to generate cert for ${domain}:`, error.message);
    return null;
  }
}