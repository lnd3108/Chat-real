export const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

export const ACCESS_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;
export const REFRESH_TOKEN_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === "production";

export const getAuthCookieOptions = (overrides = {}) => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? "none" : "lax",
  path: "/",
  ...overrides,
});

export const setAccessTokenCookie = (res, token) => {
  res.cookie(
    ACCESS_TOKEN_COOKIE_NAME,
    token,
    getAuthCookieOptions({ maxAge: ACCESS_TOKEN_MAX_AGE_MS }),
  );
};

export const setRefreshTokenCookie = (res, token) => {
  res.cookie(
    REFRESH_TOKEN_COOKIE_NAME,
    token,
    getAuthCookieOptions({ maxAge: REFRESH_TOKEN_MAX_AGE_MS }),
  );
};

export const clearAuthCookies = (res) => {
  const clearOptions = getAuthCookieOptions();
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearOptions);
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, clearOptions);
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getAuthCookieOptions());
};

export const clearAccessTokenCookie = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, getAuthCookieOptions());
};
