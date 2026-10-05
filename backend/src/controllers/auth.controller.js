const bcrypt = require("bcrypt");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const Property = require("../models/Property");
const PropertyImage = require("../models/PropertyImage");
const { SavedProperty } = require("../models");
const { deleteAssetsForImages } = require("../services/cloudinaryAssets.service");
const {
  hashPassword,
  comparePasswords,
  generateToken,
} = require("../services/auth.service");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;
const USER_EXISTS_MESSAGE = "User already exists";
// Real bcrypt hash (cost 10) of a throwaway value; only used to equalise timing.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 10);

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Returns an error message, or null when the password is acceptable.
function passwordError(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

function serializeUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    phone: user.phone || "",
    role: user.role,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      throw new AppError("Email and password are required", 400);
    }

    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new AppError("Invalid email address", 400);
    }

    const pwError = passwordError(password);
    if (pwError) {
      throw new AppError(pwError, 400);
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AppError(USER_EXISTS_MESSAGE, 400);
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      name: typeof name === "string" ? name.trim() : "",
    });

    const token = generateToken(user);
    return res.status(201).json({ token, user: serializeUser(user) });
  } catch (err) {
    // Two concurrent registrations can both pass the findOne check above.
    if (err?.code === 11000) {
      return next(new AppError(USER_EXISTS_MESSAGE, 400));
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

    // Always run a bcrypt compare so response time doesn't reveal whether the
    // email exists.
    const isValid = await comparePasswords(
      typeof password === "string" ? password : "",
      user?.passwordHash || DUMMY_HASH
    ).then((match) => Boolean(user?.passwordHash) && match);

    if (!isValid) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = generateToken(user);
    return res.status(200).json({ token, user: serializeUser(user) });
  } catch (err) {
    return next(err);
  }
}

async function getCurrentUser(req, res) {
  return res.status(200).json({ user: serializeUser(req.user) });
}

// Only these body fields can ever reach the User document from PATCH /me.
// Anything else (role, email, passwordHash, ...) is ignored, never assigned.
async function updateProfile(req, res, next) {
  try {
    const updates = {};
    const { name, phone } = req.body ?? {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length > MAX_NAME_LENGTH) {
        throw new AppError(`Name must be text of at most ${MAX_NAME_LENGTH} characters`, 400);
      }
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      const trimmed = typeof phone === "string" ? phone.trim() : null;
      // An empty string clears the phone number.
      if (trimmed === null || (trimmed !== "" && !PHONE_RE.test(trimmed))) {
        throw new AppError("Invalid phone number", 400);
      }
      updates.phone = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError("Nothing to update", 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    );
    if (!user) {
      throw new AppError("Not authenticated", 401);
    }
    return res.status(200).json({ user: serializeUser(user) });
  } catch (err) {
    return next(err);
  }
}

// Loads the caller with their hash and checks the supplied password. Throws an
// AppError on failure. A wrong password is a 400, not a 401:
// the frontend treats any 401 on an authenticated request as "session expired"
// and logs the user out.
async function loadUserWithVerifiedPassword(req, password) {
  if (typeof password !== "string" || !password) {
    throw new AppError("Current password is required", 400);
  }
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!user) {
    throw new AppError("Not authenticated", 401);
  }
  const match = user.passwordHash
    ? await comparePasswords(password, user.passwordHash)
    : false;
  if (!match) {
    throw new AppError("Current password is incorrect", 400);
  }
  return user;
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    const pwError = passwordError(newPassword);
    if (pwError) {
      throw new AppError(pwError.replace("Password", "New password"), 400);
    }

    const user = await loadUserWithVerifiedPassword(req, currentPassword);
    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    // Every earlier token is now rejected by protect; hand back a fresh one so
    // this session keeps working.
    return res.status(200).json({ token: generateToken(user), user: serializeUser(user) });
  } catch (err) {
    return next(err);
  }
}

async function changeEmail(req, res, next) {
  try {
    const { currentPassword, newEmail } = req.body ?? {};
    const normalizedEmail = normalizeEmail(newEmail);

    if (!normalizedEmail) {
      throw new AppError("New email is required", 400);
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new AppError("Invalid email address", 400);
    }

    const user = await loadUserWithVerifiedPassword(req, currentPassword);
    if (normalizedEmail === user.email) {
      throw new AppError("New email is the same as the current email", 400);
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AppError(USER_EXISTS_MESSAGE, 400);
    }

    // TODO: require verification of the new address (emailed link/code) before
    // switching; today the change takes effect immediately.
    user.email = normalizedEmail;
    await user.save();

    return res.status(200).json({ user: serializeUser(user) });
  } catch (err) {
    if (err?.code === 11000) {
      return next(new AppError(USER_EXISTS_MESSAGE, 400));
    }
    return next(err);
  }
}

// MongoDB here is standalone (no transactions), so the cascade is ordered so
// that a failure never leaves a live listing without its images or a listing
// without an owner: properties -> user -> images. A failure before the user is
// deleted leaves the user in place and the request retryable. Image cleanup
// runs last and is best effort: if it fails, only unreachable image rows
// remain (their properties are already gone), so it is logged, not surfaced.
async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body ?? {};

    const user = await loadUserWithVerifiedPassword(req, password);
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        throw new AppError("The last remaining admin account cannot be deleted", 400);
      }
    }

    const propertyIds = await Property.find({ ownerId: user._id }).distinct("_id");
    if (propertyIds.length > 0) {
      await Property.deleteMany({ ownerId: user._id });
    }
    await SavedProperty.deleteMany({
      $or: [{ userId: user._id }, { propertyId: { $in: propertyIds } }],
    });
    await User.deleteOne({ _id: user._id });

    if (propertyIds.length > 0) {
      try {
        const images = await PropertyImage.find({ propertyId: { $in: propertyIds } }).lean();
        await PropertyImage.deleteMany({ propertyId: { $in: propertyIds } });
        await deleteAssetsForImages(images, user._id);
      } catch (cleanupErr) {
        console.error("[account] image cleanup failed after account deletion:", cleanupErr.message);
      }
    }

    return res.status(200).json({ message: "Account deleted" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
  changeEmail,
  deleteAccount,
};
