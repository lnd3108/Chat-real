const isForceHttpsEnabled = () =>
  process.env.FORCE_HTTPS !== "false" && process.env.FORCE_HTTPS !== "0";

const isHttpsRequest = (req) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  return req.secure || forwardedProto === "https";
};

export const enforceHttps = (req, res, next) => {
  if (process.env.NODE_ENV !== "production" || !isForceHttpsEnabled()) {
    return next();
  }

  if (isHttpsRequest(req)) {
    return next();
  }

  if (process.env.HTTPS_ENFORCEMENT_MODE === "block") {
    return res.status(403).json({ message: "HTTPS is required." });
  }

  const host = req.headers.host;
  if (!host) {
    return res.status(403).json({ message: "HTTPS is required." });
  }

  return res.redirect(308, `https://${host}${req.originalUrl}`);
};
