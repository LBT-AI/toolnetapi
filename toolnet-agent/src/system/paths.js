import { join } from "path";
import { CONFIG_DIR, MITM_DIR, LOG_DIR } from "../config.js";

export { CONFIG_DIR, MITM_DIR, LOG_DIR };

export const ROOT_CA_KEY_PATH = join(MITM_DIR, "rootCA.key");
export const ROOT_CA_CERT_PATH = join(MITM_DIR, "rootCA.crt");
export const PID_FILE = join(MITM_DIR, ".mitm.pid");
export const LOCK_FILE = join(MITM_DIR, ".mitm.lock");
export const ALIASES_FILE = join(MITM_DIR, "aliases.json");