/**
 * @jest-environment node
 */

import { decodeXmlEntities, looksLikeRekordboxXml, parseRekordboxXml } from '../server/lib/rekordbox-xml.js';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.7.7" Company="AlphaTheta"/>
  <COLLECTION Entries="3">
    <TRACK TrackID="101" Name="Les Nuits" Artist="Nightmares On Wax" Album="Carboot Soul"
           Genre="Downtempo" TotalTime="380" AverageBpm="92.00" Tonality="Am" Rating="204"
           PlayCount="12" DateAdded="2024-03-01"
           Location="file://localhost/Users/dj/Music/les-nuits.mp3"/>
    <TRACK TrackID="102" Name="Glue" Artist="Bicep" TotalTime="331" AverageBpm="128.00"
           Tonality="Fm" DateAdded="2024-05-11" Location="file://localhost/Users/dj/Music/glue.aiff"/>
    <TRACK TrackID="103" Name="Sun &amp; Moon" Artist="Above &amp; Beyond" TotalTime="240"
           Location="file://localhost/Users/dj/Music/sun.mp3"/>
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="2">
      <NODE Name="Warmup" Type="1" KeyType="0" Entries="2">
        <TRACK Key="101"/>
        <TRACK Key="103"/>
      </NODE>
      <NODE Type="0" Name="House" Count="1">
        <NODE Name="Peak Time" Type="1" KeyType="0" Entries="1">
          <TRACK Key="102"/>
        </NODE>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

describe('decodeXmlEntities', () => {
  test('expands named entities', () => {
    expect(decodeXmlEntities('Above &amp; Beyond')).toBe('Above & Beyond');
    expect(decodeXmlEntities('&lt;tag&gt;')).toBe('<tag>');
    expect(decodeXmlEntities('it&apos;s')).toBe("it's");
  });

  test('expands numeric and hex escapes', () => {
    expect(decodeXmlEntities('caf&#233;')).toBe('café');
    expect(decodeXmlEntities('caf&#xe9;')).toBe('café');
  });

  test('leaves unknown entities untouched', () => {
    expect(decodeXmlEntities('a &nope; b')).toBe('a &nope; b');
  });
});

describe('looksLikeRekordboxXml', () => {
  test('accepts a rekordbox export', () => {
    expect(looksLikeRekordboxXml(SAMPLE)).toBe(true);
  });

  test('rejects unrelated content', () => {
    expect(looksLikeRekordboxXml('<html><body>hi</body></html>')).toBe(false);
    expect(looksLikeRekordboxXml('Track Title\tArtist\tBPM')).toBe(false);
    expect(looksLikeRekordboxXml(null)).toBe(false);
  });
});

describe('parseRekordboxXml', () => {
  const library = parseRekordboxXml(SAMPLE);

  test('reads every collection track', () => {
    expect(library.tracks).toHaveLength(3);
    expect(library.meta.declaredEntries).toBe(3);
    expect(library.meta.parsedEntries).toBe(3);
    expect(library.meta.product).toBe('rekordbox');
  });

  test('maps track fields, converting seconds to milliseconds', () => {
    const [first] = library.tracks;
    expect(first).toMatchObject({
      rbId: '101',
      title: 'Les Nuits',
      artist: 'Nightmares On Wax',
      album: 'Carboot Soul',
      genre: 'Downtempo',
      bpm: 92,
      key: 'Am',
      durationMs: 380000,
      rating: 204,
      playCount: 12,
      dateAdded: '2024-03-01',
    });
  });

  test('decodes entities inside attributes', () => {
    const track = library.tracks.find((item) => item.rbId === '103');
    expect(track.title).toBe('Sun & Moon');
    expect(track.artist).toBe('Above & Beyond');
  });

  test('leaves absent numeric fields null rather than zero', () => {
    const track = library.tracks.find((item) => item.rbId === '103');
    expect(track.bpm).toBeNull();
    expect(track.rating).toBeNull();
    expect(track.playCount).toBeNull();
  });

  test('flattens the playlist tree and keeps folder paths', () => {
    expect(library.playlists).toHaveLength(2);

    const warmup = library.playlists.find((item) => item.name === 'Warmup');
    expect(warmup.path).toBe('Warmup');
    expect(warmup.trackIds).toEqual(['101', '103']);

    const peak = library.playlists.find((item) => item.name === 'Peak Time');
    expect(peak.path).toBe('House/Peak Time');
    expect(peak.trackIds).toEqual(['102']);
  });

  test('excludes the synthetic ROOT folder from paths', () => {
    for (const playlist of library.playlists) {
      expect(playlist.path.startsWith('ROOT')).toBe(false);
    }
  });

  test('does not treat playlist track references as collection tracks', () => {
    // <TRACK Key="101"/> inside <PLAYLISTS> has no TrackID and must not
    // inflate the collection.
    expect(library.tracks.every((track) => track.rbId !== '')).toBe(true);
    expect(library.tracks).toHaveLength(3);
  });

  test('handles a UTF-8 BOM', () => {
    expect(parseRekordboxXml(`﻿${SAMPLE}`).tracks).toHaveLength(3);
  });

  test('handles an empty playlist tree', () => {
    const xml = SAMPLE.replace(/<PLAYLISTS>[\s\S]*<\/PLAYLISTS>/, '<PLAYLISTS/>');
    const parsed = parseRekordboxXml(xml);
    expect(parsed.playlists).toEqual([]);
    expect(parsed.tracks).toHaveLength(3);
  });

  test('handles self-closing playlist nodes', () => {
    const xml = SAMPLE.replace(
      '<NODE Name="Warmup" Type="1" KeyType="0" Entries="2">\n        <TRACK Key="101"/>\n        <TRACK Key="103"/>\n      </NODE>',
      '<NODE Name="Empty Crate" Type="1" KeyType="0" Entries="0"/>'
    );
    const parsed = parseRekordboxXml(xml);
    const empty = parsed.playlists.find((item) => item.name === 'Empty Crate');
    expect(empty).toBeDefined();
    expect(empty.trackIds).toEqual([]);
    // The sibling folder must still resolve correctly after a self-closing node.
    expect(parsed.playlists.find((item) => item.name === 'Peak Time').path).toBe('House/Peak Time');
  });

  test('rejects files that are not rekordbox exports', () => {
    expect(() => parseRekordboxXml('<html></html>')).toThrow(/rekordbox collection export/i);
    expect(() => parseRekordboxXml('')).toThrow(/empty/i);
  });
});
