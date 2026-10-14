const { verifyToken, isTokenStale, isSessionAlive } = require("../services/auth.service");
const User = require("../models/User");
const AppError = require("../utils/AppError");

// Access token from "Authorization: Bearer <jwt>"; null when absent or malformed.
function bearerToken(req) {
  const [scheme, token] = String(req.get('authorization') || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function protect(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return next(AppError.unauthorized());
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    // Malformed, tampered or expired token.
    return next(AppError.unauthorized());
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(AppError.unauthorized());
    }

    if (isTokenStale(user, decoded)) {
      return next(AppError.unauthorized());
    }

    // Logged-out or revoked sessions (and tokens without a sid) are rejected.
    if (!(await isSessionAlive(user._id, decoded.sid))) {
      return next(AppError.unauthorized());
    }

    req.user = user;
    next();
  } catch (error) {
    // A lookup failure (DB down, bad id in a signed token) is not the client's
    // auth problem; a 401 here would make the frontend log the user out.
    if (error?.name === "CastError") {
      return next(AppError.unauthorized());
    }
    next(error);
  }
}

function restrictTo(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden());
    }
    next();
  };
}

module.exports = { protect, restrictTo, bearerToken };