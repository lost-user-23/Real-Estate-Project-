const router = require("express").Router();
const c = require("../controllers/savedProperty.controller");
const { protect } = require("../middleware/auth.middleware");
const requireVerified = require("../middleware/requireVerified");

router.use(protect);

router.get("/ids", c.listIds);
router.get('/', c.list);
router.post("/:propertyId", requireVerified, c.save);
router.delete("/:propertyId", c.remove);

module.exports = router;