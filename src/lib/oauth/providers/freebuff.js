import { FREEBUFF_CONFIG } from "../constants/oauth.js";
import { FreebuffService } from "../services/freebuff.js";

const freebuff = {
  config: FREEBUFF_CONFIG,
  flowType: "device_code",
  requestDeviceCode: async () => {
    const service = new FreebuffService();
    const login = await service.requestLoginCode();
    return {
      deviceCode: login.fingerprintId,
      userCode: login.fingerprintHash,
      verificationUri: login.loginUrl,
      verificationUriComplete: login.loginUrl,
      expiresIn: Math.floor((login.expiresInMs || 3600000) / 1000),
      interval: 5,
      providerSpecificData: {
        fingerprintId: login.fingerprintId,
        fingerprintHash: login.fingerprintHash,
        expiresAt: login.expiresAt,
      },
    };
  },
  pollToken: async (_config, deviceCodeData) => {
    const service = new FreebuffService();
    const res = await service.pollLoginStatus({
      fingerprintId: deviceCodeData.deviceCode || deviceCodeData.fingerprintId,
      fingerprintHash: deviceCodeData.userCode || deviceCodeData.fingerprintHash,
      expiresAt: deviceCodeData.providerSpecificData?.expiresAt || deviceCodeData.expiresAt,
    });

    if (res.status === "pending") {
      const err = new Error("authorization_pending");
      err.error = "authorization_pending";
      throw err;
    }

    if (res.status === "success" && res.user) {
      return {
        accessToken: res.user.authToken,
        email: res.user.email,
        name: res.user.name,
        expiresIn: 86400 * 30, // 30 days
        providerSpecificData: {
          userId: res.user.id,
          name: res.user.name,
          fingerprintId: res.user.fingerprintId,
          fingerprintHash: res.user.fingerprintHash,
          authMethod: "browser_login",
        },
      };
    }

    const err = new Error(res.error || "Login failed");
    err.error = "login_failed";
    throw err;
  },
  mapTokens: (tokens) => ({
    accessToken: tokens.accessToken,
    refreshToken: null,
    expiresIn: tokens.expiresIn || 86400 * 30,
    email: tokens.email || null,
    name: tokens.name || null,
    providerSpecificData: {
      userId: tokens.providerSpecificData?.userId || tokens.userId,
      name: tokens.providerSpecificData?.name || tokens.name,
      fingerprintId: tokens.providerSpecificData?.fingerprintId || tokens.fingerprintId,
      fingerprintHash: tokens.providerSpecificData?.fingerprintHash || tokens.fingerprintHash,
      authMethod: tokens.providerSpecificData?.authMethod || "oauth",
    },
  }),
};

export default freebuff;
