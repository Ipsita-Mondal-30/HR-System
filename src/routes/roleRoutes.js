const express = require('express');
const router = express.Router();
const { isHRorAdmin } = require('../middleware/auth');
const roleController = require('../controllers/roleController');

router.post('/', isHRorAdmin, roleController.createRole);
router.get('/', roleController.getRoles);

module.exports = router;
