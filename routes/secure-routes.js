const express = require('express');
const router = express.Router();

router.get(
  '/current_user',
  (req, res) => {
    res.json({
      message: 'You made it to the secure route',
      user: req.user,
    })
  }
);

module.exports = router;