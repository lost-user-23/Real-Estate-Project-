const { verifyToken, isTokenStale } = require("../services/auth.service");
const User = require("../models/User");

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  let decoded;
  try {
    decoded = verifyToken(authHeader.split(" ")[1]);
  } catch {
    // Malformed, tampered or expired token.
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (isTokenStale(user, decoded)) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    req.user = user;
    next();
  } catch (error) {
    // A lookup failure (DB down, bad id in a signed token) is not the client's
    // auth problem; a 401 here would make the frontend log the user out.
    if (error?.name === "CastError") {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next(error);
  }
}

function restrictTo(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { protect, restrictTo };