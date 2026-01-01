import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Validation rules for playlist ID parameter
 */
export const validatePlaylistId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Playlist ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

/**
 * Validation rules for pagination query parameters
 */
export const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
    .toInt(),
  handleValidationErrors
];

/**
 * Validation rules for resolve endpoint
 */
export const validateResolve = [
  body('url')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('URL must be between 1 and 2048 characters')
    .custom((value) => {
      if (!value) return true;
      try {
        const url = new URL(value.startsWith('http') ? value : `https://${value}`);
        // Only allow SoundCloud domains
        const host = url.hostname.toLowerCase();
        if (!/(^|\.)soundcloud\.com$/.test(host) && host !== 'on.soundcloud.com') {
          throw new Error('URL must be a SoundCloud domain');
        }
        return true;
      } catch (error) {
        throw new Error('Invalid URL format');
      }
    }),
  query('url')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('URL must be between 1 and 2048 characters')
    .custom((value) => {
      if (!value) return true;
      try {
        const url = new URL(value.startsWith('http') ? value : `https://${value}`);
        const host = url.hostname.toLowerCase();
        if (!/(^|\.)soundcloud\.com$/.test(host) && host !== 'on.soundcloud.com') {
          throw new Error('URL must be a SoundCloud domain');
        }
        return true;
      } catch (error) {
        throw new Error('Invalid URL format');
      }
    }),
  handleValidationErrors
];

/**
 * Validation rules for merge playlists endpoint
 */
export const validateMergePlaylists = [
  body('sourcePlaylistIds')
    .isArray({ min: 2 })
    .withMessage('At least 2 playlist IDs are required')
    .custom((value) => {
      if (!Array.isArray(value) || value.length < 2) {
        throw new Error('sourcePlaylistIds must be an array with at least 2 items');
      }
      if (value.length > 10) {
        throw new Error('Cannot merge more than 10 playlists at once');
      }
      // Validate each ID is a positive integer
      for (const id of value) {
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (!Number.isInteger(numId) || numId < 1) {
          throw new Error('All playlist IDs must be positive integers');
        }
      }
      return true;
    }),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .escape(), // Sanitize to prevent XSS
  handleValidationErrors
];

/**
 * Validation rules for update playlist endpoint
 */
export const validateUpdatePlaylist = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Playlist ID must be a positive integer')
    .toInt(),
  body('tracks')
    .isArray()
    .withMessage('tracks must be an array')
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error('tracks must be an array');
      }
      if (value.length === 0) {
        throw new Error('tracks array cannot be empty');
      }
      if (value.length > 500) {
        throw new Error('Cannot have more than 500 tracks');
      }
      // Validate each track ID is a positive integer
      for (const trackId of value) {
        const numId = typeof trackId === 'string' ? parseInt(trackId, 10) : trackId;
        if (!Number.isInteger(numId) || numId < 1) {
          throw new Error('All track IDs must be positive integers');
        }
      }
      return true;
    }),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .escape(),
  handleValidationErrors
];

/**
 * Validation rules for create playlist from likes endpoint
 */
export const validateCreateFromLikes = [
  body('trackIds')
    .isArray({ min: 1 })
    .withMessage('At least one track ID is required')
    .custom((value) => {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('trackIds must be a non-empty array');
      }
      if (value.length > 500) {
        throw new Error('Cannot have more than 500 tracks');
      }
      // Validate each track ID is a positive integer
      for (const trackId of value) {
        const numId = typeof trackId === 'string' ? parseInt(trackId, 10) : trackId;
        if (!Number.isInteger(numId) || numId < 1) {
          throw new Error('All track IDs must be positive integers');
        }
      }
      return true;
    }),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .escape(),
  handleValidationErrors
];

/**
 * Validation rules for likes pagination
 */
export const validateLikesPagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200')
    .toInt(),
  query('next')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('Next cursor must be a valid URL')
    .custom((value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Next cursor must be a valid URL');
      }
    }),
  handleValidationErrors
];

