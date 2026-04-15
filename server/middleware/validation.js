import { body, param, query, validationResult } from 'express-validator';

function validateSoundCloudUrl(value) {
  if (!value) return true;
  const normalized = value.startsWith('http') ? value : `https://${value}`;
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    if (!/(^|\.)soundcloud\.com$/.test(host) && host !== 'on.soundcloud.com') {
      throw new Error('URL must be a SoundCloud domain');
    }
    return true;
  } catch {
    throw new Error('Invalid URL format');
  }
}

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
    .custom((value) => validateSoundCloudUrl(value)),
  query('url')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('URL must be between 1 and 2048 characters')
    .custom((value) => validateSoundCloudUrl(value)),
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
      if (value.length > 20) {
        throw new Error('Cannot merge more than 20 playlists at once');
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
  body('targetPlaylistId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('targetPlaylistId must be a positive integer')
    .toInt(),
  body('deleteAfterMerge')
    .optional()
    .isBoolean()
    .withMessage('deleteAfterMerge must be a boolean')
    .toBoolean(),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .escape(),
  // Custom: title is required when targetPlaylistId is absent
  body('title').custom((value, { req }) => {
    if (!req.body.targetPlaylistId && !value) {
      throw new Error('title is required when targetPlaylistId is not provided');
    }
    return true;
  }),
  // Custom: targetPlaylistId must not appear in sourcePlaylistIds (Requirement 1.6)
  body('targetPlaylistId').custom((value, { req }) => {
    if (value && Array.isArray(req.body.sourcePlaylistIds)) {
      const sourceIds = req.body.sourcePlaylistIds.map((id) =>
        typeof id === 'string' ? parseInt(id, 10) : id
      );
      if (sourceIds.includes(value)) {
        throw new Error('targetPlaylistId must not be one of the sourcePlaylistIds');
      }
    }
    return true;
  }),
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
 * POST /api/playlists/transfer-track — move or duplicate one track between playlists
 */
export const validatePlaylistTrackTransfer = [
  body('action')
    .isIn(['move', 'duplicate'])
    .withMessage('action must be move or duplicate'),
  body('trackId')
    .isInt({ min: 1 })
    .withMessage('trackId must be a positive integer')
    .toInt(),
  body('sourcePlaylistId')
    .isInt({ min: 1 })
    .withMessage('sourcePlaylistId must be a positive integer')
    .toInt(),
  body('targetPlaylistId')
    .isInt({ min: 1 })
    .withMessage('targetPlaylistId must be a positive integer')
    .toInt(),
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
      if (value.length > 5000) {
        throw new Error('Cannot have more than 5000 tracks in one request');
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
  body('targetPlaylistId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('targetPlaylistId must be a positive integer')
    .toInt(),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .escape(),
  // Custom: title is required when targetPlaylistId is absent
  body('title').custom((value, { req }) => {
    if (!req.body.targetPlaylistId && !value) {
      throw new Error('title is required when targetPlaylistId is not provided');
    }
    return true;
  }),
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

/**
 * Validate batch resolve request
 */
export const validateBatchResolve = [
  body('urls')
    .isArray({ min: 1, max: 50 })
    .withMessage('urls must be an array with 1-50 items'),
  body('urls.*')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('Each URL must be a non-empty string')
    .custom((value) => validateSoundCloudUrl(value)),
  handleValidationErrors
];

/**
 * Validate clone playlist request
 */
export const validateClonePlaylist = [
  body('url')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('url must be a valid SoundCloud URL string')
    .custom((value) => validateSoundCloudUrl(value)),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .escape(),
  handleValidationErrors
];

/**
 * Validate activities request
 */
export const validateActivities = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500')
    .toInt(),
  handleValidationErrors
];

/**
 * Validate bulk unlike request
 */
export const validateBulkUnlike = [
  body('trackIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('trackIds must be an array with 1-100 items'),
  body('trackIds.*')
    .isInt({ min: 1 })
    .withMessage('Each trackId must be a positive integer'),
  handleValidationErrors
];

/**
 * Validate bulk unfollow request
 */
export const validateBulkUnfollow = [
  body('userIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('userIds must be an array with 1-100 items'),
  body('userIds.*')
    .isInt({ min: 1 })
    .withMessage('Each userId must be a positive integer'),
  handleValidationErrors
];

/**
 * Validate bulk unrepost request
 */
export const validateBulkUnrepost = [
  body('items')
    .isArray({ min: 1, max: 100 })
    .withMessage('items must be an array with 1-100 items'),
  body('items.*.id')
    .isInt({ min: 1 })
    .withMessage('Each item id must be a positive integer'),
  body('items.*.resourceType')
    .isIn(['track', 'playlist'])
    .withMessage('Each item resourceType must be track or playlist'),
  handleValidationErrors
];

/**
 * Validation rules for track search endpoint (GET /api/tracks/search)
 */
export const validateTrackSearch = [
  query('genres')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('genres must be at most 200 characters'),
  query('tags')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('tags must be at most 200 characters'),
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('q must be at most 200 characters'),
  query('bpm_from')
    .optional()
    .isInt({ min: 1, max: 300 })
    .withMessage('bpm_from must be an integer between 1 and 300')
    .toInt(),
  query('bpm_to')
    .optional()
    .isInt({ min: 1, max: 300 })
    .withMessage('bpm_to must be an integer between 1 and 300')
    .toInt(),
  query('duration_from')
    .optional()
    .isInt({ min: 0 })
    .withMessage('duration_from must be a non-negative integer')
    .toInt(),
  query('duration_to')
    .optional()
    .isInt({ min: 0 })
    .withMessage('duration_to must be a non-negative integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('limit must be between 1 and 200')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset must be a non-negative integer')
    .toInt(),
  // Require at least one of genres, tags, or q
  query('genres').custom((value, { req }) => {
    if (!value && !req.query.tags && !req.query.q) {
      throw new Error('At least one of genres, tags, or q is required');
    }
    return true;
  }),
  // Validate bpm_from <= bpm_to when both provided
  query('bpm_from').custom((value, { req }) => {
    if (value && req.query.bpm_to) {
      const from = Number(value);
      const to = Number(req.query.bpm_to);
      if (from > to) {
        throw new Error('bpm_from must be less than or equal to bpm_to');
      }
    }
    return true;
  }),
  // Validate duration_from <= duration_to when both provided
  query('duration_from').custom((value, { req }) => {
    if (value && req.query.duration_to) {
      const from = Number(value);
      const to = Number(req.query.duration_to);
      if (from > to) {
        throw new Error('duration_from must be less than or equal to duration_to');
      }
    }
    return true;
  }),
  handleValidationErrors
];

/**
 * Validation rules for delete playlist endpoint (DELETE /api/playlists/:id)
 */
export const validateDeletePlaylist = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Playlist ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

