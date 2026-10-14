const express = require('express');
const { getAdminHero, updateHero, uploadHeroImage } = require('../controllers/hero.controller');
const { uploadImage } = require('../middleware/uploadImage');

const router = express.Router();

router.get('/', getAdminHero);
router.put('/', updateHero);
router.post('/image', uploadImage, uploadHeroImage);

module.exports = router;
