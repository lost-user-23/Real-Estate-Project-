const mongoose = require("mongoose");

// Only the SHA-256 hash of the refresh token is stored, so a leaked collection
// cannot be used to open sessions. A rotated token keeps its record with `usedAt`
// set until it expires: that is how a replay of an old token is recognised (and
// attributed to a user) instead of looking like an unknown value.
const refreshTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    usedAt: {
        type: Date,
        default: null,
    },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
},
    {timestamps: { createdAt: true, updatedAt: false }}
);

// MongoDB removes the record once expiresAt has passed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
