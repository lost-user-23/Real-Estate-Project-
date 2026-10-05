const { normalizeCity } = require('../../utils/normalizeCity');

// Keeps cityLower (and localityLower when asked) in sync on create and on any
// document save. Query-level writes (updateMany, findByIdAndUpdate, bulkWrite)
// skip document hooks, so those call sites set the fields explicitly.
function normalizedLocationPlugin(schema, { locality = false } = {}) {
  schema.pre('validate', function syncNormalizedLocation() {
    if (this.isNew || this.isModified('city') || !this.cityLower) {
      this.cityLower = normalizeCity(this.city);
    }
    if (locality && (this.isNew || this.isModified('locality') || (this.locality && !this.localityLower))) {
      this.localityLower = this.locality ? normalizeCity(this.locality) : null;
    }
  });
}

module.exports = normalizedLocationPlugin;
