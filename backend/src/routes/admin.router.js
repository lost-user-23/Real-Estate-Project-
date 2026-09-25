const express = require('express');
const {protect, restrictTo} = require('../middleware/auth.middleware');
const {updateLocation} = require('../controllers/location.controller');
const { createFacility, updateFacility, deleteFacility } = require('../controllers/facility.controller');

const router = express.Router();

router.patch('/locations/:id', protect, restrictTo('admin'), updateLocation);
router.post('/facilities', protect, restrictTo('admin'), createFacility);
router.patch('/facilities/:id', protect, restrictTo('admin'), updateFacility);
router.delete('/facilities/:id', protect, restrictTo('admin'), deleteFacility);

module.exports = router;