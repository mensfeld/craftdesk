import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateFileChecksum, verifyFileChecksum, formatChecksum } from '../../src/utils/crypto';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Crypto Utils', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crypto-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('calculateFileChecksum', () => {
    it('should calculate SHA-256 of file', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const checksum = await calculateFileChecksum(testFile);

      // Known SHA-256 of "Hello, World!"
      expect(checksum).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });

    it('should handle empty files', async () => {
      const testFile = path.join(tempDir, 'empty.txt');
      await fs.writeFile(testFile, '');

      const checksum = await calculateFileChecksum(testFile);

      // Known SHA-256 of empty string
      expect(checksum).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should handle large files (streaming)', async () => {
      const testFile = path.join(tempDir, 'large.txt');
      // Create a 1MB file
      const content = 'A'.repeat(1024 * 1024);
      await fs.writeFile(testFile, content);

      const checksum = await calculateFileChecksum(testFile);

      expect(checksum).toBeTruthy();
      expect(checksum).toHaveLength(64); // SHA-256 is 64 hex characters
    });

    it('should produce consistent checksums for same content', async () => {
      const content = 'Test content for checksum';

      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');

      await fs.writeFile(file1, content);
      await fs.writeFile(file2, content);

      const checksum1 = await calculateFileChecksum(file1);
      const checksum2 = await calculateFileChecksum(file2);

      expect(checksum1).toBe(checksum2);
    });

    it('should produce different checksums for different content', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');

      await fs.writeFile(file1, 'Content A');
      await fs.writeFile(file2, 'Content B');

      const checksum1 = await calculateFileChecksum(file1);
      const checksum2 = await calculateFileChecksum(file2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should reject on file read error', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      await expect(
        calculateFileChecksum(nonExistentFile)
      ).rejects.toThrow();
    });

    it('should handle binary files', async () => {
      const testFile = path.join(tempDir, 'binary.dat');
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      await fs.writeFile(testFile, buffer);

      const checksum = await calculateFileChecksum(testFile);

      expect(checksum).toBeTruthy();
      expect(checksum).toHaveLength(64);
    });
  });

  describe('verifyFileChecksum', () => {
    it('should return true for matching checksum', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const expectedChecksum = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f';

      const result = await verifyFileChecksum(testFile, expectedChecksum);

      expect(result).toBe(true);
    });

    it('should return false for mismatched checksum', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const wrongChecksum = '0000000000000000000000000000000000000000000000000000000000000000';

      const result = await verifyFileChecksum(testFile, wrongChecksum);

      expect(result).toBe(false);
    });

    it('should be case-insensitive', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');

      const checksumLower = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f';
      const checksumUpper = 'DFFD6021BB2BD5B0AF676290809EC3A53191DD81C7F70A4B28688A362182986F';
      const checksumMixed = 'DfFd6021Bb2bD5b0Af676290809eC3a53191Dd81C7f70A4b28688A362182986F';

      expect(await verifyFileChecksum(testFile, checksumLower)).toBe(true);
      expect(await verifyFileChecksum(testFile, checksumUpper)).toBe(true);
      expect(await verifyFileChecksum(testFile, checksumMixed)).toBe(true);
    });

    it('should handle file read errors', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      await expect(
        verifyFileChecksum(nonExistentFile, 'abc123')
      ).rejects.toThrow();
    });

    it('should detect file tampering', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Original content');

      const originalChecksum = await calculateFileChecksum(testFile);

      // Tamper with file
      await fs.writeFile(testFile, 'Modified content');

      const isValid = await verifyFileChecksum(testFile, originalChecksum);

      expect(isValid).toBe(false);
    });
  });

  describe('formatChecksum', () => {
    it('should return first 12 characters', () => {
      const checksum = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f';
      const formatted = formatChecksum(checksum);

      expect(formatted).toBe('dffd6021bb2b');
      expect(formatted).toHaveLength(12);
    });

    it('should handle short checksums', () => {
      const shortChecksum = 'abc123';
      const formatted = formatChecksum(shortChecksum);

      expect(formatted).toBe('abc123');
    });

    it('should handle exactly 12 character checksums', () => {
      const checksum = '123456789012';
      const formatted = formatChecksum(checksum);

      expect(formatted).toBe('123456789012');
    });

    it('should handle empty string', () => {
      const formatted = formatChecksum('');

      expect(formatted).toBe('');
    });
  });

  describe('integration scenarios', () => {
    it('should verify archive integrity workflow', async () => {
      // Simulate downloading a craft archive
      const archivePath = path.join(tempDir, 'craft.zip');
      const archiveContent = 'Fake ZIP content for testing';
      await fs.writeFile(archivePath, archiveContent);

      // Calculate checksum (simulating server-side calculation)
      const expectedChecksum = await calculateFileChecksum(archivePath);

      // Verify after download (simulating client-side verification)
      const isValid = await verifyFileChecksum(archivePath, expectedChecksum);

      expect(isValid).toBe(true);
    });

    it('should detect MITM attack scenario', async () => {
      const archivePath = path.join(tempDir, 'craft.zip');
      const originalContent = 'Original legitimate content';
      await fs.writeFile(archivePath, originalContent);

      // Store checksum from trusted source (lockfile)
      const trustedChecksum = await calculateFileChecksum(archivePath);

      // Simulate MITM attack - file replaced during download
      const maliciousContent = 'Malicious injected content';
      await fs.writeFile(archivePath, maliciousContent);

      // Verification should fail
      const isValid = await verifyFileChecksum(archivePath, trustedChecksum);

      expect(isValid).toBe(false);
    });
  });
});
