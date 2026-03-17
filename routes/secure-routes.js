const express = require('express');
const { body, validationResult } = require('express-validator');
const UserModel = require('../models/user');
const router = express.Router();

router.get('/current_user', (req, res) => {
  res.json({
    user: { _id: req.user._id, email: req.user.email },
  });
});

/**
 * PATCH /user/profile
 * Update the authenticated user's name.
 */
router.patch(
  '/profile',
  [body('name').trim().notEmpty().withMessage('Name is required')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    try {
      const user = await UserModel.findByIdAndUpdate(
        req.user._id,
        { $set: { name: req.body.name } },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: { _id: user._id, email: user.email, name: user.name } });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
