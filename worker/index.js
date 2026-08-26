if (url.pathname === "/api/test") {
  return jsonResponse({
    success: true,
    version: "D1-BACKEND-V2",
    message: "NEW D1 WORKER IS ACTIVE",

    envCheck: {
      GOOGLE_CLIENT_EMAIL: Boolean(env.GOOGLE_CLIENT_EMAIL),
      GOOGLE_PRIVATE_KEY: Boolean(env.GOOGLE_PRIVATE_KEY),
      MASTER_SHEET_ID: Boolean(env.MASTER_SHEET_ID),
      ADMIN_SYNC_KEY: Boolean(env.ADMIN_SYNC_KEY),
      D1_DATABASE: Boolean(env.DB),
    },
  });
}
