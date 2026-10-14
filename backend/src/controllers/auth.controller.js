const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const jti = require("crypto").randomBytes(32).toString("hex");
const AppError = require("../utils/AppError");
const Property = require("../models/Property");
const PropertyImage = require("../models/PropertyImage");
const { SavedProperty } = require("../models");
const { deleteAssetsForImages } = require("../services/cloudinaryAssets.service");
const mailer = require("../services/mailer.service");
const config = require("../config");
const { generateVerificationToken, hashToken } = require("../utils/verificationToken");
const {
  generateResetOtp,
  verifyResetOtp: verifyResetOtpHash,
  MAX_OTP_ATTEMPTS,
  RESET_TOKEN_TTL_MS,
  RESET_TOKEN_AUDIENCE,
} = require("../utils/resetOtp");
const {
  hashPassword,
  comparePasswords,
  generateToken,
  REFRESH_TOKEN_TTL_MS,
  newSessionId,
  createRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeSessionByAccessToken,
  revokeAllRefreshTokens,
} = require("../services/auth.service");
const { bearerToken } = require("../middleware/auth.middleware");

const {
  generateActionOtp,
  verifyActionOtp,
  ACTION_PURPOSES,
  MAX_ACTION_OTP_ATTEMPTS,
} = require("../utils/actionOtp");

const SAME_SITE_VALUES = ["lax", "strict", "none"];
const REFRESH_COOKIE = "refreshToken";

// Built per call so NODE_ENV / COOKIE_SAMESITE are read when the cookie is
// issued. An unknown COOKIE_SAMESITE falls back to "strict". SameSite=None is
// rejected by browsers unless the cookie is Secure, so it forces secure.
// The path covers /api/auth so the browser sends the cookie to /refresh and
// /logout (which needs it to revoke the right record) and to no other route.
function getCookieOptions() {
  const requested = String(process.env.COOKIE_SAMESITE || "").trim().toLowerCase();
  const sameSite = SAME_SITE_VALUES.includes(requested) ? requested : "strict";
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: "/api/auth",
  };
}

function clearRefreshCookie(res) {
  const options = getCookieOptions();
  delete options.maxAge;
  res.clearCookie(REFRESH_COOKIE, options);
}

// Starts a session: a new refresh token goes out as the cookie and a fresh
// access token is returned for the response body.
// A refresh passes its session id so the session stays the same across rotations.
async function startSession(req, res, user, sessionId = newSessionId()) {
  const refreshToken = await createRefreshToken(user._id, req, sessionId);
  res.cookie(REFRESH_COOKIE, refreshToken, getCookieOptions());
  return generateToken(user, sessionId);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;
// Real bcrypt hash (same cost as real passwords) of a throwaway value; only used to equalise timing.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", config.bcryptRounds);

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
    emailVerified: user.emailVerified,
  };
}

const REGISTER_MESSAGE =
  "If this email can be registered, we've sent a verification link to it. Check your inbox.";
const EMAIL_CHANGE_MESSAGE =
  "If this address can be used, we've sent a confirmation link to it. Your email stays the same until you confirm.";
const RESEND_MESSAGE =
  "If this address is waiting for verification, we've sent a new link to it.";
const INVALID_LINK_MESSAGE = "This verification link is invalid or has expired";
const MAIL_FAILED_MESSAGE = "We could not send the verification email. Please try again.";
const FORGOT_PASSWORD_MESSAGE =
  "If this email is registered, we've sent a password reset code to it.";
const INVALID_OTP_MESSAGE = "Invalid or expired code";

const RESET_OTP_FIELDS = { resetOtpHash: 1, resetOtpExpiry: 1, resetOtpAttempts: 1 };
const RESET_COOLDOWN_MS = 60 * 1000;

function resetOtpError(reason) {
  console.warn(`[auth] password reset OTP rejected: ${reason}`);
  return new AppError(INVALID_OTP_MESSAGE, 400);
}

const VERIFICATION_COOLDOWN_MS = 60 * 1000;
const VERIFY_TOKEN_FIELDS = { verifyTokenHash: 1, verifyTokenExpiry: 1, verifyTokenPurpose: 1 };

// `flow` tells the /verify-email page whether to ask for a password. It is a UI
// hint only: the server decides from the stored verifyTokenPurpose.
function verificationLink(token, flow) {
  return `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}&flow=${flow}`;
}

// Matches an account whose `field` timestamp is unset or older than the
// cooldown. Used inside a conditional update so check and write are atomic.
function outsideCooldown(field, now) {
  return {
    $or: [{ [field]: null }, { [field]: { $lte: new Date(now.getTime() - VERIFICATION_COOLDOWN_MS) } }],
  };
}

// Runs work after the response has been sent. Whatever it throws or rejects
// with (even a non-Error such as undefined) is logged here and never becomes
// an unhandled rejection, which would crash the Node process. The logging
// itself cannot throw: it does not assume `err` is an Error.
function runInBackground(label, work) {
  Promise.resolve()
    .then(work)
    .catch((err) => {
      try {
        console.error(`[auth] ${label} failed:`, err instanceof Error ? err.message : String(err));
      } catch {
        // Nothing left to do; never let logging take the process down.
      }
    });
}

// Stores a fresh token for `purpose` and returns the raw token, or null when a
// verification mail went to this account less than a minute ago (the existing
// link stays valid then). The cooldown check and the write are one conditional
// update, so two concurrent requests cannot both send.
async function issueVerificationToken(userId, purpose, { cooldown = true, extraSet = {} } = {}) {
  const { token, tokenHash, expiresAt } = generateVerificationToken();
  const now = new Date();
  const filter = { _id: userId, ...(cooldown ? outsideCooldown("verifyTokenSentAt", now) : {}) };
  const result = await User.updateOne(filter, {
    $set: {
      ...extraSet,
      verifyTokenHash: tokenHash,
      verifyTokenExpiry: expiresAt,
      verifyTokenPurpose: purpose,
      verifyTokenSentAt: now,
    },
  });
  return result.modifiedCount === 1 ? token : null;
}

// Any mail failure surfaces as the same 503 whichever branch ran, so the
// outcome of a request never depends on whether the address was already taken.
async function sendOrFail(send) {
  try {
    await send();
  } catch (err) {
    console.error("[auth] could not send email:", err.message);
    throw new AppError(MAIL_FAILED_MESSAGE, 503);
  }
}

// Registration takes no password and never starts a session. The password is
// set on the verify step, by whoever can read the inbox, so registering
// someone else's address first gains nothing.
//
// The response goes out before any lookup, and the rest runs in the
// background, so neither the body nor the timing says which branch ran:
//   - new address        -> unverified account (no password) + link
//   - unverified account -> new link unless one went out <60s ago (name kept)
//   - verified account   -> "someone tried to use your address" notice,
//                           at most one per minute
async function register(req, res, next) {
  try {
    const { name, email } = req.body ?? {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw new AppError("Email is required", 400);
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new AppError("Invalid email address", 400);
    }
    if (name !== undefined && (typeof name !== "string" || name.trim().length > MAX_NAME_LENGTH)) {
      throw new AppError(`Name must be text of at most ${MAX_NAME_LENGTH} characters`, 400);
    }

    res.status(202).json({ message: REGISTER_MESSAGE });
    const cleanName = typeof name === "string" ? name.trim() : "";
    runInBackground("registration", () => processRegistration(normalizedEmail, cleanName));
  } catch (err) {
    return next(err);
  }
}

async function processRegistration(email, name) {
  const existing = await User.findOne({ email });

  if (existing?.emailVerified) {
    // Same one-minute cooldown as verification mails, on its own timestamp so
    // the two never block each other.
    const now = new Date();
    const claimed = await User.updateOne(
      { _id: existing._id, ...outsideCooldown("accountNoticeSentAt", now) },
      { $set: { accountNoticeSentAt: now } }
    );
    if (claimed.modifiedCount === 1) {
      await mailer.sendAccountExistsEmail(email);
    }
    return;
  }

  if (existing) {
    // The name is set only when the account is first created; a re-register
    // (possibly by someone else) must not choose what the inbox owner gets.
    const token = await issueVerificationToken(existing._id, "register");
    if (token) {
      await mailer.sendVerificationEmail(email, verificationLink(token, "register"));
    }
    return;
  }

  const { token, tokenHash, expiresAt } = generateVerificationToken();
  let user;
  try {
    user = await User.create({
      email,
      name,
      emailVerified: false,
      verifyTokenHash: tokenHash,
      verifyTokenExpiry: expiresAt,
      verifyTokenPurpose: "register",
      verifyTokenSentAt: new Date(),
    });
  } catch (err) {
    // A concurrent registration for the same address won the insert; it sends
    // its own link.
    if (err?.code === 11000) return;
    throw err;
  }

  try {
    await mailer.sendVerificationEmail(email, verificationLink(token, "register"));
  } catch (err) {
    // No account that nobody was told about: the address is free to try again.
    await User.deleteOne({ _id: user._id, emailVerified: false, verifyTokenHash: tokenHash });
    throw err;
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

    const accessToken = await startSession(req, res, user);
    return res.status(200).json({ user: serializeUser(user), accessToken });
  } catch (err) {
    return next(err);
  }
}

// Rotates the refresh token: the presented one is spent and a new one replaces
// it. A replay of an already-spent token revokes every session of that user.
async function refresh(req, res, next) {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (typeof presented !== "string" || !presented) {
      throw AppError.unauthorized();
    }

    const { userId, sessionId, inGrace } = await consumeRefreshToken(presented);
    const user = userId ? await User.findById(userId) : null;
    if (!user) {
      // A lost race between two tabs: the other response is setting the live
      // cookie, so this one must not clear it.
      if (!inGrace) clearRefreshCookie(res);
      throw AppError.unauthorized();
    }

    // Records from before sessions had ids get one on their first rotation.
    const accessToken = await startSession(req, res, user, sessionId || undefined);
    return res.status(200).json({ user: serializeUser(user), accessToken });
  } catch (err) {
    return next(err);
  }
}

// Needs no access token (it may have expired): the refresh cookie identifies the
// session. Only that session ends, and repeating the call is harmless.
async function logout(req, res, next) {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (typeof presented === "string" && presented) {
      await revokeRefreshToken(presented);
    } else {
      // No cookie: a valid Bearer token still ends its own session.
      const accessToken = bearerToken(req);
      if (accessToken) await revokeSessionByAccessToken(accessToken);
    }
    clearRefreshCookie(res);
    return res.status(200).json({ message: "Logged out" });
  } catch (err) {
    return next(err);
  }
}

// Ends every session of the caller; their access tokens stop working at once.
async function logoutAll(req, res, next) {
  try {
    await revokeAllRefreshTokens(req.user._id);
    clearRefreshCookie(res);
    return res.status(200).json({ message: "Logged out everywhere" });
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

const ACTION_LABELS = {
  "change-password": "change your password",
  "change-email": "change your email address",
};
const ACTION_OTP_FIELDS = {
  actionOtpHash: 1,
  actionOtpExpiry: 1,
  actionOtpPurpose: 1,
  actionOtpAttempts: 1,
};

function actionCodeError(reason) {
  console.warn(`[auth] action code rejected: ${reason}`);
  return new AppError(INVALID_OTP_MESSAGE, 400);
}

// Emails a confirmation code to the address currently on the account. The
// caller is authenticated, so there is nothing to hide about whether the
// address exists; the one-minute cooldown (claimed atomically) stops inbox spam.
async function requestActionCode(req, res, next) {
  try {
    const { purpose } = req.body ?? {};
    if (!ACTION_PURPOSES.includes(purpose)) {
      throw new AppError("Invalid purpose", 400);
    }

    const { otp, otpHash, expiresAt } = generateActionOtp(purpose, config.jwtSecret);
    const now = new Date();
    const claimed = await User.updateOne(
      { _id: req.user._id, ...outsideCooldown("actionOtpSentAt", now) },
      {
        $set: {
          actionOtpHash: otpHash,
          actionOtpExpiry: expiresAt,
          actionOtpPurpose: purpose,
          actionOtpAttempts: 0,
          actionOtpSentAt: now,
        },
      }
    );
    if (claimed.modifiedCount !== 1) {
      throw new AppError("A code was sent a moment ago. Please wait a minute before requesting another.", 429);
    }

    try {
      await sendOrFail(() => mailer.sendActionCodeEmail(req.user.email, otp, ACTION_LABELS[purpose]));
    } catch (err) {
      await User.updateOne({ _id: req.user._id }, { $unset: { ...ACTION_OTP_FIELDS, actionOtpSentAt: 1 } });
      throw err;
    }
    return res.status(202).json({ message: "We've sent a confirmation code to your current email." });
  } catch (err) {
    return next(err);
  }
}

// Checks and spends the emailed code for `purpose`. One attempt is consumed
// BEFORE comparing, in a conditional update, so parallel guesses cannot share a
// counter; success burns the code so it works exactly once.
async function consumeActionCode(userId, purpose, code) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    throw actionCodeError("missing or malformed code");
  }
  const user = await User.findById(userId).select(
    "+actionOtpHash +actionOtpExpiry +actionOtpPurpose"
  );
  if (!user?.actionOtpHash || user.actionOtpPurpose !== purpose) {
    throw actionCodeError("no pending code for this action");
  }
  if (!user.actionOtpExpiry || user.actionOtpExpiry <= new Date()) {
    await User.updateOne({ _id: userId, actionOtpHash: user.actionOtpHash }, { $unset: ACTION_OTP_FIELDS });
    throw actionCodeError("expired code");
  }

  const spent = await User.findOneAndUpdate(
    {
      _id: userId,
      actionOtpHash: user.actionOtpHash,
      actionOtpExpiry: { $gt: new Date() },
      actionOtpAttempts: { $lt: MAX_ACTION_OTP_ATTEMPTS },
    },
    { $inc: { actionOtpAttempts: 1 } }
  );
  if (!spent) {
    await User.updateOne(
      { _id: userId, actionOtpHash: user.actionOtpHash, actionOtpAttempts: { $gte: MAX_ACTION_OTP_ATTEMPTS } },
      { $unset: ACTION_OTP_FIELDS }
    );
    throw actionCodeError("attempt limit exceeded");
  }

  if (!verifyActionOtp(code, purpose, user.actionOtpHash, config.jwtSecret)) {
    throw actionCodeError("incorrect code");
  }
  const burned = await User.updateOne(
    { _id: userId, actionOtpHash: user.actionOtpHash },
    { $unset: ACTION_OTP_FIELDS }
  );
  if (burned.modifiedCount !== 1) {
    throw actionCodeError("code already used");
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, code } = req.body ?? {};

    const pwError = passwordError(newPassword);
    if (pwError) {
      throw new AppError(pwError.replace("Password", "New password"), 400);
    }

    const user = await loadUserWithVerifiedPassword(req, currentPassword);
    await consumeActionCode(user._id, "change-password", code);
    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    // Every earlier access token is now rejected by protect and every refresh
    // token is revoked; start a new session so this device keeps working.
    await revokeAllRefreshTokens(user._id);
    const accessToken = await startSession(req, res, user);
    return res.status(200).json({ user: serializeUser(user), accessToken });
  } catch (err) {
    return next(err);
  }
}

// The requested address is parked in pendingEmail and `email` is left alone
// until the link sent to the NEW address is used. The answer is identical
// whether or not another account already holds that address (that address gets
// a notice instead of a link), so the endpoint cannot be used to probe emails.
async function changeEmail(req, res, next) {
  try {
    const { currentPassword, newEmail, code } = req.body ?? {};
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
    await consumeActionCode(user._id, "change-email", code);

    const taken = await User.exists({ email: normalizedEmail });
    if (taken) {
      await sendOrFail(() => mailer.sendAccountExistsEmail(normalizedEmail));
      return res.status(202).json({ message: EMAIL_CHANGE_MESSAGE });
    }

    // No cooldown here: correcting a mistyped address must send at once.
    const token = await issueVerificationToken(user._id, "email-change", {
      cooldown: false,
      extraSet: { pendingEmail: normalizedEmail },
    });
    try {
      await sendOrFail(() =>
        mailer.sendVerificationEmail(normalizedEmail, verificationLink(token, "email-change"))
      );
    } catch (err) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { pendingEmail: 1, verifyTokenSentAt: 1, ...VERIFY_TOKEN_FIELDS } }
      );
      throw err;
    }
    return res.status(202).json({ message: EMAIL_CHANGE_MESSAGE });
  } catch (err) {
    return next(err);
  }
}

// The token is looked up first without being consumed, so a registration that
// arrives with a missing or weak password can be corrected and retried with the
// same link. Completing a flow consumes the token in the same atomic update that
// applies it, so a replay (or two clicks racing) cannot apply it twice.
async function verifyEmail(req, res, next) {
  try {
    const { token, password } = req.body ?? {};
    if (typeof token !== "string" || token.length < 1 || token.length > 200) {
      throw new AppError(INVALID_LINK_MESSAGE, 400);
    }
    const tokenHash = hashToken(token);
    const live = () => ({ verifyTokenHash: tokenHash, verifyTokenExpiry: { $gt: new Date() } });

    const holder = await User.findOne(live()).select("+pendingEmail +verifyTokenPurpose");
    if (!holder) {
      throw new AppError(INVALID_LINK_MESSAGE, 400);
    }
    const purpose = holder.verifyTokenPurpose || (holder.pendingEmail ? "email-change" : "register");

    if (purpose === "register") {
      const pwError = passwordError(password);
      if (pwError) {
        throw new AppError(pwError, 400);
      }
      const passwordHash = await hashPassword(password);
      // passwordChangedAt: setting the password is a password change, so any
      // session that predates it (an account created before this design) ends.
      const user = await User.findOneAndUpdate(
        { _id: holder._id, ...live() },
        {
          $set: { passwordHash, emailVerified: true, passwordChangedAt: new Date() },
          $unset: { pendingEmail: 1, ...VERIFY_TOKEN_FIELDS },
        },
        { returnDocument: "after" }
      );
      if (!user) {
        throw new AppError(INVALID_LINK_MESSAGE, 400);
      }
      // The inbox owner just set the password: sign them in.
      const accessToken = await startSession(req, res, user);
      return res
        .status(200)
        .json({ message: "Email verified", flow: "register", user: serializeUser(user), accessToken });
    }

    const consumed = await User.findOneAndUpdate(
      { _id: holder._id, ...live() },
      { $unset: VERIFY_TOKEN_FIELDS },
      { returnDocument: "before" }
    ).select("+pendingEmail");
    if (!consumed) {
      throw new AppError(INVALID_LINK_MESSAGE, 400);
    }

    const set = { emailVerified: true };
    if (consumed.pendingEmail) {
      set.email = consumed.pendingEmail;
    }
    try {
      await User.updateOne({ _id: consumed._id }, { $set: set, $unset: { pendingEmail: 1 } });
    } catch (err) {
      if (err?.code === 11000) {
        await User.updateOne({ _id: consumed._id }, { $unset: { pendingEmail: 1 } });
        throw new AppError(
          "That email address is no longer available. Request the change again with a different address.",
          409
        );
      }
      throw err;
    }

    const user = await User.findById(consumed._id);
    return res.status(200).json({ message: "Email verified", flow: "email-change", user: serializeUser(user) });
  } catch (err) {
    return next(err);
  }
}

// Always the same quick answer; the lookup and send happen after responding so
// neither the body nor the timing says whether the address is registered. At
// most one mail per account per minute (see issueVerificationToken).
function resendVerification(req, res) {
  const normalizedEmail = normalizeEmail(req.body?.email);
  res.status(202).json({ message: RESEND_MESSAGE });
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) return;

  runInBackground("resend verification", async () => {
    const user = await User.findOne({
      $or: [{ email: normalizedEmail, emailVerified: false }, { pendingEmail: normalizedEmail }],
    }).select("+pendingEmail");
    if (!user) return;
    const purpose = user.pendingEmail === normalizedEmail ? "email-change" : "register";
    const token = await issueVerificationToken(user._id, purpose);
    if (!token) return;
    await mailer.sendVerificationEmail(normalizedEmail, verificationLink(token, purpose));
  });
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
    await revokeAllRefreshTokens(user._id);
    clearRefreshCookie(res);

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

// The response is always the same 202 with a generic message, so neither the
// body nor the timing reveals whether the address is registered. The mail is
// sent in the background after responding, matching the register pattern.
async function forgotPassword(req, res, next) {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      throw new AppError("Email is required", 400);
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new AppError("Invalid email address", 400);
    }

    res.status(202).json({ message: FORGOT_PASSWORD_MESSAGE });

    runInBackground("forgot-password", async () => {
      const user = await User.findOne({ email: normalizedEmail })
        .select("+resetOtpSentAt +resetOtpHash");
      // Only verified, password-based accounts can reset.
      if (!user) return;
      if (!user.emailVerified) {
        // Development aid only (the response is identical either way). No address
        // is logged.
        if (config.env === "development") {
          console.debug("[auth] password reset skipped: account is not verified");
        }
        return;
      }

      // One-minute per-account cooldown: prevents spamming the inbox.
      const now = new Date();
      if (user.resetOtpSentAt && now - user.resetOtpSentAt < RESET_COOLDOWN_MS) return;

      const { otp, otpHash, expiresAt } = generateResetOtp(config.jwtSecret);
      // Atomic conditional update so concurrent requests cannot both send.
      const claimed = await User.updateOne(
        {
          _id: user._id,
          ...outsideCooldown("resetOtpSentAt", now),
        },
        {
          $set: {
            resetOtpHash: otpHash,
            resetOtpExpiry: expiresAt,
            resetOtpAttempts: 0,
            resetOtpSentAt: now,
          },
        }
      );
      if (claimed.modifiedCount !== 1) return;
      await mailer.sendPasswordResetEmail(normalizedEmail, otp);
    });
  } catch (err) {
    return next(err);
  }
}

// Verifies the OTP. On success, clears the OTP fields and returns a short-lived
// single-use "reset token" (a signed JWT with purpose=password-reset) that the
// frontend passes to /reset-password. This ensures the new password can only be
// set after the OTP was verified, without keeping the OTP alive.
async function verifyResetOtp(req, res, next) {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const { code } = req.body ?? {};

    if (!normalizedEmail || !code) {
      throw resetOtpError("missing email or code");
    }
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      throw resetOtpError("malformed code");
    }

    const user = await User.findOne({ email: normalizedEmail })
      .select("+resetOtpHash +resetOtpExpiry +resetOtpAttempts");

    if (!user || !user.resetOtpHash) {
      // No user or no pending OTP — same generic error.
      throw resetOtpError("no matching user or pending OTP");
    }

    // Expired?
    if (!user.resetOtpExpiry || user.resetOtpExpiry <= new Date()) {
      await User.updateOne({ _id: user._id }, { $unset: RESET_OTP_FIELDS });
      throw resetOtpError("expired OTP");
    }

    // Spend one attempt BEFORE comparing, in a single conditional update, so
    // parallel guesses cannot all be evaluated against the same counter. Once the
    // counter reaches the cap the update matches nothing, the OTP is discarded,
    // and requesting a new code is the only way forward (it resets the counter).
    const spent = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetOtpHash: user.resetOtpHash,
        resetOtpExpiry: { $gt: new Date() },
        resetOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
      },
      { $inc: { resetOtpAttempts: 1 } }
    );
    if (!spent) {
      await User.updateOne(
        { _id: user._id, resetOtpHash: user.resetOtpHash, resetOtpAttempts: { $gte: MAX_OTP_ATTEMPTS } },
        { $unset: RESET_OTP_FIELDS }
      );
      throw resetOtpError("attempt limit exceeded");
    }

    if (!verifyResetOtpHash(code, user.resetOtpHash, config.jwtSecret)) {
      throw resetOtpError("incorrect code");
    }

    
    const now = new Date();
    const resetToken = jwt.sign(
      { id: user._id, purpose: "password-reset", jti },
      config.jwtSecret,
      { expiresIn: Math.floor(RESET_TOKEN_TTL_MS / 1000), audience: RESET_TOKEN_AUDIENCE }
    );
    const claimed = await User.updateOne(
      {
        _id: user._id,
        resetOtpHash: user.resetOtpHash,
        resetOtpExpiry: { $gt: now },
        resetOtpAttempts: { $lte: MAX_OTP_ATTEMPTS },
      },
      {
        $set: {
          resetTokenHash: hashToken(jti),
          resetTokenExpiry: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
        },
        $unset: RESET_OTP_FIELDS,
      }
    );
    if (claimed.modifiedCount !== 1) {
      throw resetOtpError("OTP already consumed or no longer valid");
    }

    return res.status(200).json({ resetToken });
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword } = req.body ?? {};

    if (typeof resetToken !== "string" || !resetToken) {
      throw new AppError("Reset token is required", 400);
    }

    const pwError = passwordError(newPassword);
    if (pwError) {
      throw new AppError(pwError.replace("Password", "New password"), 400);
    }

    const jwt = require("jsonwebtoken");
    let decoded;
    try {
      decoded = jwt.verify(resetToken, config.jwtSecret, { audience: RESET_TOKEN_AUDIENCE });
    } catch {
      throw new AppError("Reset token is invalid or has expired", 400);
    }

    if (
      decoded.purpose !== "password-reset" ||
      typeof decoded.id !== "string" ||
      typeof decoded.jti !== "string" ||
      !/^[a-f\d]{64}$/i.test(decoded.jti)
    ) {
      throw new AppError("Reset token is invalid or has expired", 400);
    }

    const now = new Date();
    const passwordHash = await hashPassword(newPassword);
    const updated = await User.updateOne(
      {
        _id: decoded.id,
        resetTokenHash: hashToken(decoded.jti),
        resetTokenExpiry: { $gt: now },
      },
      {
        $set: { passwordHash, passwordChangedAt: now },
        $unset: { resetTokenHash: 1, resetTokenExpiry: 1 },
      }
    );
    if (updated.modifiedCount !== 1) {
      throw new AppError("Reset token is invalid or has expired", 400);
    }

    // Revoke every existing session: the password has changed.
    await revokeAllRefreshTokens(decoded.id);
    clearRefreshCookie(res);

    return res.status(200).json({ message: "Password has been reset. Please log in." });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getCurrentUser,
  updateProfile,
  requestActionCode,
  changePassword,
  changeEmail,
  deleteAccount,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
