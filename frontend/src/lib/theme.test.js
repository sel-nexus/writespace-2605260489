/** Verify exact raw preferences and defensive browser storage boundaries. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTheme, writeTheme } from './theme.js';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('readTheme', () => {
  it.each(['light', 'dark'])('reads the exact raw %s preference without writing', (theme) => {
    localStorage.setItem('writespace_theme', theme);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(readTheme()).toBe(theme);
    expect(writes).not.toHaveBeenCalled();
  });

  it.each([null, '', 'Dark', 'LIGHT', ' dark ', '"dark"', '{}', 'null', 'system'])(
    'defaults invalid or missing %s to light without repairing it', (value) => {
      if (value !== null) localStorage.setItem('writespace_theme', value);
      expect(readTheme()).toBe('light');
      expect(localStorage.getItem('writespace_theme')).toBe(value);
    },
  );

  it('defaults to light when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked read'); });
    expect(readTheme()).toBe('light');
  });

  it('defaults to light when the localStorage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Blocked storage'); });
    expect(readTheme()).toBe('light');
  });
});

describe('writeTheme', () => {
  it.each(['light', 'dark'])('persists raw %s without touching product keys', (theme) => {
    localStorage.setItem('writespace_posts', '[{"id":"p1"}]');
    localStorage.setItem('writespace_users', '[{"id":"u1"}]');
    localStorage.setItem('writespace_session', '{"userId":"u1"}');
    writeTheme(theme);
    expect(localStorage.getItem('writespace_theme')).toBe(theme);
    expect(localStorage.getItem('writespace_posts')).toBe('[{"id":"p1"}]');
    expect(localStorage.getItem('writespace_users')).toBe('[{"id":"u1"}]');
    expect(localStorage.getItem('writespace_session')).toBe('{"userId":"u1"}');
    expect(localStorage.length).toBe(4);
  });

  it.each([undefined, null, '', 'system', 'Dark', '"dark"', {}, 1])(
    'does not persist invalid input %s', (value) => {
      localStorage.setItem('writespace_theme', 'dark');
      writeTheme(value);
      expect(localStorage.getItem('writespace_theme')).toBe('dark');
      expect(localStorage.length).toBe(1);
    },
  );

  it('never throws on a failed setItem and leaves the saved preference intact', () => {
    localStorage.setItem('writespace_theme', 'light');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(() => writeTheme('dark')).not.toThrow();
    expect(localStorage.getItem('writespace_theme')).toBe('light');
  });

  it('never throws when the localStorage getter fails during writing', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Blocked storage'); });
    expect(() => writeTheme('dark')).not.toThrow();
  });
});
