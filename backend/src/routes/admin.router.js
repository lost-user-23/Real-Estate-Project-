const express = require('express');
const {protect, restrictTo} = require('../middleware/auth.middleware');
const {updateLocation, listAdminLocations} = require('../controllers/location.controller');
const { createFacility, updateFacility, deleteFacility } = require('../controllers/facility.controller');
const { bulkUpdateProperties, bulkDeleteProperties, listAdminProperties } = require('../controllers/property.controller');

const { getDashboard } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/dashboard', protect, restrictTo('admin'), getDashboard);
router.get('/locations', protect, restrictTo('admin'), listAdminLocations);
router.patch('/locations/:id', protect, restrictTo('admin'), updateLocation);
router.post('/facilities', protect, restrictTo('admin'), createFacility);
router.patch('/facilities/:id', protect, restrictTo('admin'), updateFacility);
router.delete('/facilities/:id', protect, restrictTo('admin'), deleteFacility);
router.get('/properties', protect, restrictTo('admin'), listAdminProperties);
router.patch('/properties/bulk', protect, restrictTo('admin'), bulkUpdateProperties);
router.delete('/properties/bulk', protect, restrictTo('admin'), bulkDeleteProperties);
router.use('/articles', protect, restrictTo('admin'), require('./admin-article.routes'));
router.use('/reports', protect, restrictTo('admin'), require('./admin-report.routes'));
router.use('/projects', protect, restrictTo('admin'), require('./admin-project.routes'));
module.exports = router;