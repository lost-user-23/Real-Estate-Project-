const mongoose = require("mongoose");

const savedPropertySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true,
    }
},
    {timestamps: true}
);

savedPropertySchema.index({ userId: 1, propertyId: 1 }, { unique: true });
savedPropertySchema.index({ userId: 1, createdAt: -1});

module.exports = mongoose.model("SavedProperty", savedPropertySchema);