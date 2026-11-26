export function parseProxyString(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  let customName = "";
  let proxyStr = trimmed;
  if (trimmed.includes("|")) {
    const pipeParts = trimmed.split("|");
    customName = pipeParts[0].trim();
    proxyStr = pipeParts.slice(1).join("|").trim();
  }

  if (proxyStr.includes("://")) {
    try {
      const parsed = new URL(proxyStr);
      const hostLabel = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
      return {
        proxyUrl: parsed.toString(),
        name: customName || `Proxy ${hostLabel}`,
        hostPort: hostLabel,
      };
    } catch {
      return null;
    }
  }

  if (proxyStr.includes("@")) {
    try {
      const parsed = new URL(`http://${proxyStr}`);
      const hostLabel = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
      return {
        proxyUrl: parsed.toString(),
        name: customName || `Proxy ${hostLabel}`,
        hostPort: hostLabel,
      };
    } catch {
      return null;
    }
  }

  const parts = proxyStr.split(":");
  if (parts.length === 4) {
    const [host, port, username, password] = parts;
    if (!host || !port || !username || !password) return null;
    try {
      const parsed = new URL(`http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`);
      return {
        proxyUrl: parsed.toString(),
        name: customName || `Proxy ${host}:${port}`,
        hostPort: `${host}:${port}`,
      };
    } catch {
      return null;
    }
  }

  if (parts.length === 2) {
    const [host, port] = parts;
    try {
      const parsed = new URL(`http://${host}:${port}`);
      return {
        proxyUrl: parsed.toString(),
        name: customName || `Proxy ${host}:${port}`,
        hostPort: `${host}:${port}`,
      };
    } catch {
      return null;
    }
  }

  return null;
}
