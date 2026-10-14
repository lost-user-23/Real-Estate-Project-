const express = require('express');
const { getPublicHero } = require('../controllers/hero.controller');

const router = express.Router();

router.get('/', getPublicHero);

module.exports = router;
