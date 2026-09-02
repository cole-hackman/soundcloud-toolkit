/**
 * Parser for rekordbox's exported collection XML.
 *
 * rekordbox writes this file from `File → Export Collection in xml format`. It
 * is machine-generated and shallow, so a small scanner beats pulling in an XML
 * dependency — and, unlike `DOMParser`, this runs unchanged in Node (so the
 * Jest suite exercises the same code the browser does).
 *
 * Shape of the input we care about:
 *
 *   <DJ_PLAYLISTS Version="1.0.0">
 *     <COLLECTION Entries="2">
 *       <TRACK TrackID="1" Name="Les Nuits" Artist="Nightmares On Wax"
 *              TotalTime="380" AverageBpm="92.00" Tonality="Am"
 *              Location="file://localhost/Users/x/Music/a.mp3" .../>
 *     </COLLECTION>
 *     <PLAYLISTS>
 *       <NODE Type="0" Name="ROOT" Count="1">
 *         <NODE Name="Techno" Type="1" KeyType="0" Entries="2">
 *           <TRACK Key="1"/>
 *         </NODE>
 *       </NODE>
 *     </PLAYLISTS>
 *   </DJ_PLAYLISTS>
 *
 * `Location` holds an absolute path to a file on the DJ's own machine. Callers
 * are expected to keep it local; nothing in this module sends it anywhere.
 */

/**
 * @typedef {Object} RekordboxTrack
 * @property {string} rbId          Value of `TrackID`, used as the playlist join key.
 * @property {string} title         `Name`.
 * @property {string} artist        `Artist`.
 * @property {string} album         `Album`.
 * @property {string} genre         `Genre`.
 * @property {number|null} bpm      `AverageBpm`, null when absent/unparseable.
 * @property {string} key           `Tonality` (musical key).
 * @property {number|null} durationMs Derived from `TotalTime` (whole seconds).
 * @property {number|null} rating   0–255 as rekordbox stores it, null when absent.
 * @property {number|null} playCount `PlayCount`, null when absent.
 * @property {string} dateAdded     `DateAdded` (YYYY-MM-DD).
 * @property {string} location      Raw `Location` URI. Local path — do not upload.
 */

/**
 * @typedef {Object} RekordboxPlaylist
 * @property {string} name    Leaf name of the playlist node.
 * @property {string} path    Full folder path, e.g. `House/Peak Time`.
 * @property {string[]} trackIds `TrackID` values, in playlist order.
 */

/**
 * @typedef {Object} RekordboxLibrary
 * @property {RekordboxTrack[]} tracks
 * @property {RekordboxPlaylist[]} playlists
 * @property {{ declaredEntries: number|null, parsedEntries: number, product: string, version: string }} meta
 */

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Expand the XML entities rekordbox actually emits, including numeric escapes.
 * Ampersands in track titles are extremely common ("Above & Beyond"), so this
 * has to be correct rather than a single `&amp;` replacement.
 *
 * @param {string} value
 * @returns {string}
 */
export function decodeXmlEntities(value) {
  if (!value || value.indexOf('&') === -1) return value || '';

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const codePoint = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/**
 * Pull every `name="value"` pair out of a single XML tag body.
 *
 * @param {string} tagBody Text between the tag name and the closing bracket.
 * @returns {Record<string, string>}
 */
function parseAttributes(tagBody) {
  /** @type {Record<string, string>} */
  const attributes = {};
  const pattern = /([A-Za-z_][\w.:-]*)\s*=\s*"([^"]*)"/g;
  let match = pattern.exec(tagBody);

  while (match !== null) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
    match = pattern.exec(tagBody);
  }

  return attributes;
}

/**
 * @param {string|undefined} value
 * @returns {number|null}
 */
function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {Record<string, string>} attributes
 * @returns {RekordboxTrack}
 */
function toTrack(attributes) {
  const totalTimeSeconds = toNumberOrNull(attributes.TotalTime);

  return {
    rbId: attributes.TrackID || '',
    title: (attributes.Name || '').trim(),
    artist: (attributes.Artist || '').trim(),
    album: (attributes.Album || '').trim(),
    genre: (attributes.Genre || '').trim(),
    bpm: toNumberOrNull(attributes.AverageBpm),
    key: (attributes.Tonality || '').trim(),
    durationMs: totalTimeSeconds === null ? null : Math.round(totalTimeSeconds * 1000),
    rating: toNumberOrNull(attributes.Rating),
    playCount: toNumberOrNull(attributes.PlayCount),
    dateAdded: (attributes.DateAdded || '').trim(),
    location: attributes.Location || '',
  };
}

/**
 * Locate a top-level section by tag name and return its inner text.
 *
 * Returns an empty string when the section is missing, and handles the
 * self-closing form (`<PLAYLISTS/>`) that rekordbox emits for empty trees.
 *
 * @param {string} xml
 * @param {string} tagName
 * @returns {string}
 */
function extractSection(xml, tagName) {
  const openPattern = new RegExp(`<${tagName}\\b[^>]*?(/?)>`, 'i');
  const openMatch = openPattern.exec(xml);
  if (!openMatch) return '';
  if (openMatch[1] === '/') return '';

  const start = openMatch.index + openMatch[0].length;
  const closeIndex = xml.toUpperCase().indexOf(`</${tagName.toUpperCase()}>`, start);

  return closeIndex === -1 ? xml.slice(start) : xml.slice(start, closeIndex);
}

/**
 * Parse the `<COLLECTION>` section into tracks.
 *
 * @param {string} collectionXml
 * @returns {RekordboxTrack[]}
 */
function parseCollection(collectionXml) {
  /** @type {RekordboxTrack[]} */
  const tracks = [];
  const pattern = /<TRACK\b([^>]*)>/gi;
  let match = pattern.exec(collectionXml);

  while (match !== null) {
    const track = toTrack(parseAttributes(match[1]));
    // Collection entries always carry a TrackID; anything else is malformed.
    if (track.rbId) tracks.push(track);
    match = pattern.exec(collectionXml);
  }

  return tracks;
}

/**
 * Walk the `<PLAYLISTS>` node tree, flattening folders into `path` strings.
 *
 * rekordbox nests playlists inside folder nodes (`Type="0"`) and stores actual
 * playlists as `Type="1"` with `<TRACK Key="..."/>` children. We track depth
 * with an explicit stack because nodes can self-close at any level.
 *
 * @param {string} playlistsXml
 * @returns {RekordboxPlaylist[]}
 */
function parsePlaylists(playlistsXml) {
  /** @type {RekordboxPlaylist[]} */
  const playlists = [];
  /** @type {{ name: string, isFolder: boolean, playlist: RekordboxPlaylist|null }[]} */
  const stack = [];

  const pattern = /<(\/?)(NODE|TRACK)\b([^>]*?)(\/?)>/gi;
  let match = pattern.exec(playlistsXml);

  while (match !== null) {
    const [, closing, rawTag, tagBody, selfClosing] = match;
    const tag = rawTag.toUpperCase();

    if (tag === 'NODE') {
      if (closing) {
        stack.pop();
      } else {
        const attributes = parseAttributes(tagBody);
        const isFolder = attributes.Type !== '1';
        const name = (attributes.Name || '').trim();

        // The outermost node is rekordbox's synthetic "ROOT" folder; it never
        // holds tracks and shouldn't appear in any playlist path.
        const isRoot = stack.length === 0;
        const parentPath = stack
          .map((entry) => entry.name)
          .filter(Boolean)
          .join('/');

        /** @type {RekordboxPlaylist|null} */
        let playlist = null;
        if (!isFolder) {
          playlist = {
            name,
            path: parentPath ? `${parentPath}/${name}` : name,
            trackIds: [],
          };
          playlists.push(playlist);
        }

        if (!selfClosing) {
          stack.push({ name: isRoot ? '' : name, isFolder, playlist });
        }
      }
    } else if (tag === 'TRACK' && !closing) {
      // Inside <PLAYLISTS>, a TRACK is a reference carrying only `Key`.
      const current = stack[stack.length - 1];
      if (current?.playlist) {
        const key = parseAttributes(tagBody).Key;
        if (key) current.playlist.trackIds.push(key);
      }
    }

    match = pattern.exec(playlistsXml);
  }

  return playlists;
}

/**
 * Detect whether a string plausibly is a rekordbox collection export.
 *
 * Used to give the user a clear error instead of an empty result when they drop
 * the wrong file (a playlist .txt export, or an unrelated XML).
 *
 * @param {string} xml
 * @returns {boolean}
 */
export function looksLikeRekordboxXml(xml) {
  if (typeof xml !== 'string') return false;
  return /<DJ_PLAYLISTS\b/i.test(xml) || /<COLLECTION\b[^>]*\bEntries=/i.test(xml);
}

/**
 * Parse a rekordbox collection XML export.
 *
 * @param {string} xml Raw file contents.
 * @returns {RekordboxLibrary}
 * @throws {Error} When the text is not a rekordbox collection export.
 */
export function parseRekordboxXml(xml) {
  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error('The file is empty.');
  }

  // Strip a UTF-8 BOM so the leading `<` test and regexes behave.
  const text = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;

  if (!looksLikeRekordboxXml(text)) {
    throw new Error(
      'This does not look like a rekordbox collection export. In rekordbox, use File → Export Collection in xml format.'
    );
  }

  const rootAttributes = parseAttributes(/<DJ_PLAYLISTS\b([^>]*)>/i.exec(text)?.[1] || '');
  const productAttributes = parseAttributes(/<PRODUCT\b([^>]*)>/i.exec(text)?.[1] || '');

  const collectionXml = extractSection(text, 'COLLECTION');
  const declaredEntries = toNumberOrNull(
    parseAttributes(/<COLLECTION\b([^>]*)>/i.exec(text)?.[1] || '').Entries
  );

  const tracks = parseCollection(collectionXml);
  const playlists = parsePlaylists(extractSection(text, 'PLAYLISTS'));

  return {
    tracks,
    playlists,
    meta: {
      declaredEntries,
      parsedEntries: tracks.length,
      product: productAttributes.Name || '',
      version: productAttributes.Version || rootAttributes.Version || '',
    },
  };
}
