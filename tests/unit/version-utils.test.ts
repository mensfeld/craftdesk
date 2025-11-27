import { describe, it, expect } from 'vitest';
import {
  parseSemver,
  compareSemver,
  isNewerVersion,
  sortTagsBySemver,
  getUpdateType,
  padRight,
  colorize
} from '../../src/utils/version-utils';

describe('version-utils', () => {
  describe('parseSemver', () => {
    it('should parse standard semver', () => {
      expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse semver with v prefix', () => {
      expect(parseSemver('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should parse semver with extra suffix', () => {
      expect(parseSemver('1.2.3-beta.1')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('should return null for invalid semver', () => {
      expect(parseSemver('not-a-version')).toBeNull();
      expect(parseSemver('1.2')).toBeNull();
      expect(parseSemver('')).toBeNull();
    });
  });

  describe('compareSemver', () => {
    it('should return positive when a > b', () => {
      expect(compareSemver('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareSemver('1.1.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0);
    });

    it('should return negative when a < b', () => {
      expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(compareSemver('1.0.0', '1.1.0')).toBeLessThan(0);
      expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0);
    });

    it('should return 0 when a == b', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
    });

    it('should fall back to string comparison for non-semver', () => {
      expect(compareSemver('abc', 'def')).toBeLessThan(0);
      expect(compareSemver('def', 'abc')).toBeGreaterThan(0);
    });
  });

  describe('isNewerVersion', () => {
    it('should return true when latest is newer', () => {
      expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true);
      expect(isNewerVersion('1.0.0', '1.1.0')).toBe(true);
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
      expect(isNewerVersion('v1.0.0', 'v2.0.0')).toBe(true);
    });

    it('should return false when current is newer or equal', () => {
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('sortTagsBySemver', () => {
    it('should sort tags by semver (newest first)', () => {
      const tags = ['v1.0.0', 'v2.0.0', 'v1.5.0', 'v1.0.1'];
      const sorted = sortTagsBySemver(tags);
      expect(sorted).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.1', 'v1.0.0']);
    });

    it('should handle tags without v prefix', () => {
      const tags = ['1.0.0', '2.0.0', '1.5.0'];
      const sorted = sortTagsBySemver(tags);
      expect(sorted).toEqual(['2.0.0', '1.5.0', '1.0.0']);
    });

    it('should handle mixed semver and non-semver tags', () => {
      const tags = ['v1.0.0', 'latest', 'v2.0.0', 'beta'];
      const sorted = sortTagsBySemver(tags);
      // Semver tags sorted first, then non-semver by string
      expect(sorted[0]).toBe('v2.0.0');
      expect(sorted[1]).toBe('v1.0.0');
    });

    it('should not mutate original array', () => {
      const tags = ['v1.0.0', 'v2.0.0'];
      const original = [...tags];
      sortTagsBySemver(tags);
      expect(tags).toEqual(original);
    });
  });

  describe('getUpdateType', () => {
    it('should detect major updates', () => {
      expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
      expect(getUpdateType('1.5.3', '2.0.0')).toBe('major');
    });

    it('should detect minor updates', () => {
      expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
      expect(getUpdateType('1.0.5', '1.2.0')).toBe('minor');
    });

    it('should detect patch updates', () => {
      expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
      expect(getUpdateType('1.0.0', '1.0.5')).toBe('patch');
    });

    it('should return undefined for same version', () => {
      expect(getUpdateType('1.0.0', '1.0.0')).toBeUndefined();
    });

    it('should return undefined for invalid versions', () => {
      expect(getUpdateType('not-semver', '1.0.0')).toBeUndefined();
      expect(getUpdateType('1.0.0', 'not-semver')).toBeUndefined();
    });
  });

  describe('padRight', () => {
    it('should pad string to specified length', () => {
      expect(padRight('test', 10)).toBe('test      ');
      expect(padRight('test', 10).length).toBe(10);
    });

    it('should not truncate longer strings', () => {
      expect(padRight('longer-string', 5)).toBe('longer-string');
    });

    it('should handle empty strings', () => {
      expect(padRight('', 5)).toBe('     ');
    });
  });

  describe('colorize', () => {
    it('should wrap text with ANSI color codes', () => {
      const result = colorize('test', 'red');
      expect(result).toContain('\x1b[31m');
      expect(result).toContain('\x1b[0m');
      expect(result).toContain('test');
    });

    it('should support all color options', () => {
      expect(colorize('test', 'red')).toContain('\x1b[31m');
      expect(colorize('test', 'yellow')).toContain('\x1b[33m');
      expect(colorize('test', 'green')).toContain('\x1b[32m');
    });
  });
});
