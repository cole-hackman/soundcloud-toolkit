import { jest } from '@jest/globals';
import {
  extractOrderedTrackIds,
  duplicateTrackBetweenPlaylists,
  moveTrackBetweenPlaylists,
} from '../server/lib/playlist-transfer.js';

describe('playlist-transfer', () => {
  const accessToken = 'a';
  const refreshToken = 'r';

  test('extractOrderedTrackIds preserves order and parses ids', () => {
    expect(
      extractOrderedTrackIds({
        tracks: [{ id: 3 }, { id: '5' }, { id: 3 }],
      })
    ).toEqual([3, 5, 3]);
  });

  test('duplicate noop when track already in target', async () => {
    const client = {
      getPlaylistWithTracks: jest.fn().mockResolvedValue({
        id: 10,
        title: 'T',
        tracks: [{ id: 1 }, { id: 2 }],
      }),
      addTracksToPlaylist: jest.fn(),
    };

    const result = await duplicateTrackBetweenPlaylists({
      accessToken,
      refreshToken,
      client,
      trackId: 2,
      targetPlaylistId: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.noop).toBe(true);
    expect(client.addTracksToPlaylist).not.toHaveBeenCalled();
  });

  test('duplicate appends track to target', async () => {
    const client = {
      getPlaylistWithTracks: jest.fn().mockResolvedValue({
        id: 10,
        title: 'Dest',
        tracks: [{ id: 1 }],
      }),
      addTracksToPlaylist: jest.fn().mockResolvedValue({}),
    };

    const result = await duplicateTrackBetweenPlaylists({
      accessToken,
      refreshToken,
      client,
      trackId: 99,
      targetPlaylistId: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.noop).toBe(false);
    expect(client.addTracksToPlaylist).toHaveBeenCalledWith(
      accessToken,
      refreshToken,
      10,
      [1, 99]
    );
  });

  test('move rejects same source and target', async () => {
    const client = {
      getPlaylistWithTracks: jest.fn(),
      addTracksToPlaylist: jest.fn(),
    };

    const result = await moveTrackBetweenPlaylists({
      accessToken,
      refreshToken,
      client,
      trackId: 1,
      sourcePlaylistId: 5,
      targetPlaylistId: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/different/);
    expect(client.getPlaylistWithTracks).not.toHaveBeenCalled();
  });

  test('move updates target then removes from source', async () => {
    const client = {
      getPlaylistWithTracks: jest
        .fn()
        .mockResolvedValueOnce({
          id: 1,
          title: 'Source',
          tracks: [{ id: 10 }, { id: 20 }],
        })
        .mockResolvedValueOnce({
          id: 2,
          title: 'Dest',
          tracks: [{ id: 30 }],
        }),
      addTracksToPlaylist: jest.fn().mockResolvedValue({}),
    };

    const result = await moveTrackBetweenPlaylists({
      accessToken,
      refreshToken,
      client,
      trackId: 10,
      sourcePlaylistId: 1,
      targetPlaylistId: 2,
    });

    expect(result.ok).toBe(true);
    expect(client.addTracksToPlaylist).toHaveBeenNthCalledWith(
      1,
      accessToken,
      refreshToken,
      2,
      [30, 10]
    );
    expect(client.addTracksToPlaylist).toHaveBeenNthCalledWith(
      2,
      accessToken,
      refreshToken,
      1,
      [20]
    );
  });

  test('move partial when source update fails after target succeeds', async () => {
    const client = {
      getPlaylistWithTracks: jest.fn().mockResolvedValueOnce({
        id: 1,
        title: 'Source',
        tracks: [{ id: 10 }],
      }).mockResolvedValueOnce({
        id: 2,
        title: 'Dest',
        tracks: [{ id: 30 }],
      }),
      addTracksToPlaylist: jest
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('SC said no')),
    };

    const result = await moveTrackBetweenPlaylists({
      accessToken,
      refreshToken,
      client,
      trackId: 10,
      sourcePlaylistId: 1,
      targetPlaylistId: 2,
    });

    expect(result.ok).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.stage).toBe('source_update');
    expect(result.targetUpdated).toBe(true);
    expect(result.message).toBeTruthy();
  });

  test('move when target already has track only updates source', async () => {
    const client = {
      getPlaylistWithTracks: jest
        .fn()
        .mockResolvedValueOnce({
          id: 1,
          title: 'Source',
          tracks: [{ id: 10 }, { id: 20 }],
        })
        .mockResolvedValueOnce({
          id: 2,
          title: 'Dest',
          tracks: [{ id: 10 }, { id: 99 }],
        }),
      addTracksToPlaylist: jest.fn().mockResolvedValue({}),
    };

    const result = await moveTrackBetweenPlaylists({
      accessToken,
      refreshToken,
      client,
      trackId: 10,
      sourcePlaylistId: 1,
      targetPlaylistId: 2,
    });

    expect(result.ok).toBe(true);
    expect(client.addTracksToPlaylist).toHaveBeenNthCalledWith(
      1,
      accessToken,
      refreshToken,
      2,
      [10, 99]
    );
    expect(client.addTracksToPlaylist).toHaveBeenNthCalledWith(
      2,
      accessToken,
      refreshToken,
      1,
      [20]
    );
  });
});
