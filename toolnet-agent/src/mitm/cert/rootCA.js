import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import forge from "node-forge";
import { ROOT_CA_KEY_PATH, ROOT_CA_CERT_PATH, MITM_DIR } from "../../../src/system/paths.js";

export const ROOT_CA_CN = "ToolNet API MITM Root CA";
export { ROOT_CA_KEY_PATH, ROOT_CA_CERT_PATH, MITM_DIR };

export function isCertExpired(certPath) {
  try {
    const cert = forge.pki.certificateFromPem(readFileSync(certPath, "utf8"));
    const expiryThreshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return cert.validity.notAfter < expiryThreshold;
  } catch {
    return true;
  }
}

export function generateRootCA() {
  const exists = existsSync(ROOT_CA_KEY_PATH) && existsSync(ROOT_CA_CERT_PATH);
  if (exists && !isCertExpired(ROOT_CA_CERT_PATH)) {
    console.log("✅ Root CA already exists");
    return { key: ROOT_CA_KEY_PATH, cert: ROOT_CA_CERT_PATH };
  }
  if (exists) {
    console.log("🔐 Root CA expired or expiring soon — regenerating...");
    try { writeFileSync(ROOT_CA_KEY_PATH, ""); } catch { }
    try { writeFileSync(ROOT_CA_CERT_PATH, ""); } catch { }
  }

  if (!existsSync(MITM_DIR)) mkdirSync(MITM_DIR, { recursive: true });

  console.log("🔐 Generating Root CA certificate...");

  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  const attrs = [
    { name: "commonName", value: ROOT_CA_CN },
    { name: "organizationName", value: "ToolNet API" },
    { name: "countryName", value: "US" }
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" }
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certPem = forge.pki.certificateToPem(cert);

  writeFileSync(ROOT_CA_KEY_PATH, privateKeyPem);
  writeFileSync(ROOT_CA_CERT_PATH, certPem);

  console.log("✅ Root CA generated successfully");
  return { key: ROOT_CA_KEY_PATH, cert: ROOT_CA_CERT_PATH };
}

export function loadRootCA() {
  if (!existsSync(ROOT_CA_KEY_PATH) || !existsSync(ROOT_CA_CERT_PATH)) {
    throw new Error("Root CA not found. Generate it first.");
  }

  const keyPem = readFileSync(ROOT_CA_KEY_PATH, "utf8");
  const certPem = readFileSync(ROOT_CA_CERT_PATH, "utf8");

  return {
    key: forge.pki.privateKeyFromPem(keyPem),
    cert: forge.pki.certificateFromPem(certPem)
  };
}

export function generateLeafCert(domain, rootCA) {
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Math.floor(Math.random() * 1000000).toString();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  cert.setSubject([{ name: "commonName", value: domain }]);
  cert.setIssuer(rootCA.cert.subject.attributes);

  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: domain },
        { type: 2, value: `*.${domain}` }
      ]
    }
  ]);

  cert.sign(rootCA.key, forge.md.sha256.create());

  return {
    key: forge.pki.privateKeyToPem(keys.privateKey),
    cert: forge.pki.certificateToPem(cert)
  };
}

export function getCertFingerprint(certPath) {
  const pem = readFileSync(certPath, "utf-8");
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""), "base64");
  return forge.md.sha1.create().update(der).digest().toHex().toUpperCase().match(/.{2}/g).join(":");
}