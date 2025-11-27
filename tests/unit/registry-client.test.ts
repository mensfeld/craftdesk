import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RegistryClient } from '../../src/services/registry-client';
import axios from 'axios';

// Mock axios
vi.mock('axios');

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    createWriteStream: vi.fn(),
    promises: {
      ...actual.promises,
      mkdir: vi.fn()
    }
  };
});

// Mock config-manager
vi.mock('../../src/services/config-manager', () => ({
  configManager: {
    getAuthToken: vi.fn().mockResolvedValue(null),
    getCraftDeskJson: vi.fn().mockResolvedValue({
      registries: {
        default: { url: 'https://test-registry.com' }
      }
    }),
    getRegistryForCraft: vi.fn().mockResolvedValue('https://test-registry.com')
  }
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

describe('RegistryClient', () => {
  let registryClient: RegistryClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn()
    };

    // Mock axios.create to return our mock instance
    (axios.create as any).mockReturnValue(mockAxiosInstance);

    registryClient = new RegistryClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCraftInfo', () => {
    it('should fetch craft info from registry', async () => {
      const mockCraftInfo = {
        name: 'test-craft',
        author: 'test-author',
        version: '1.0.0',
        type: 'skill' as const,
        description: 'Test craft',
        download_url: 'https://test-registry.com/download/test.zip',
        integrity: 'sha256-abc123'
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCraftInfo
      });

      const result = await registryClient.getCraftInfo('test-author/test-craft');

      expect(result).toEqual(mockCraftInfo);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/crafts/test-author/test-craft'
      );
    });

    it('should fetch specific version when provided', async () => {
      const mockCraftInfo = {
        name: 'test-craft',
        author: 'test-author',
        version: '2.0.0',
        type: 'skill' as const
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCraftInfo
      });

      await registryClient.getCraftInfo('test-author/test-craft', '2.0.0');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/crafts/test-author/test-craft/versions/2.0.0'
      );
    });

    it('should handle 404 errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404 }
      });

      const result = await registryClient.getCraftInfo('nonexistent/craft');

      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await registryClient.getCraftInfo('test-author/craft');

      expect(result).toBeNull();
    });

    it('should parse author/name format correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { name: 'craft', author: 'author', version: '1.0.0', type: 'skill' }
      });

      await registryClient.getCraftInfo('author/craft');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/crafts/author/craft'
      );
    });

    it('should parse @scoped/name format correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { name: 'craft', author: 'scope', version: '1.0.0', type: 'skill' }
      });

      await registryClient.getCraftInfo('@scope/craft');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/crafts/scope/craft'
      );
    });

    it('should reject invalid craft names', async () => {
      await expect(
        registryClient.getCraftInfo('invalid-name')
      ).rejects.toThrow('Invalid craft name format');
    });

    it('should reject craft names with empty segments', async () => {
      await expect(
        registryClient.getCraftInfo('author/')
      ).rejects.toThrow('Invalid craft name format');

      await expect(
        registryClient.getCraftInfo('/craft')
      ).rejects.toThrow('Invalid craft name format');

      await expect(
        registryClient.getCraftInfo('author//craft')
      ).rejects.toThrow('Invalid craft name format');
    });

    it('should reject craft names with too many slashes', async () => {
      await expect(
        registryClient.getCraftInfo('author/sub/craft')
      ).rejects.toThrow('Invalid craft name format');
    });
  });

  describe('listVersions', () => {
    it('should list available versions', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          versions: ['1.0.0', '1.1.0', '2.0.0']
        }
      });

      const versions = await registryClient.listVersions('author/craft');

      expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/crafts/author/craft/versions'
      );
    });

    it('should return empty array on error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const versions = await registryClient.listVersions('author/craft');

      expect(versions).toEqual([]);
    });
  });

  describe('searchCrafts', () => {
    it('should search crafts with query', async () => {
      const { configManager } = await import('../../src/services/config-manager');
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          crafts: [
            { name: 'craft1', author: 'author1', version: '1.0.0', type: 'skill' },
            { name: 'craft2', author: 'author2', version: '2.0.0', type: 'agent' }
          ]
        }
      });

      const results = await registryClient.searchCrafts('test');

      expect(results).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/crafts',
        { params: { q: 'test' } }
      );
    });

    it('should filter by type', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { crafts: [] }
      });

      await registryClient.searchCrafts('test', 'skill');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/crafts',
        { params: { q: 'test', type: 'skill' } }
      );
    });

    it('should throw when registry not configured', async () => {
      const { configManager } = await import('../../src/services/config-manager');
      configManager.getCraftDeskJson.mockResolvedValueOnce({});

      await expect(
        registryClient.searchCrafts('test')
      ).rejects.toThrow('No registry configured');
    });

    it('should return empty array on error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const results = await registryClient.searchCrafts('test');

      expect(results).toEqual([]);
    });
  });

  describe('resolveDependencies', () => {
    it('should resolve dependencies via API', async () => {
      const { configManager } = await import('../../src/services/config-manager');
      const mockResolved = {
        resolved: {
          'author/craft': '1.0.0'
        },
        lockfile: {}
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockResolved
      });

      const result = await registryClient.resolveDependencies({
        'author/craft': '^1.0.0'
      });

      expect(result).toEqual(mockResolved);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/resolve',
        { dependencies: { 'author/craft': '^1.0.0' } }
      );
    });

    it('should throw when registry not configured', async () => {
      const { configManager } = await import('../../src/services/config-manager');
      configManager.getCraftDeskJson.mockResolvedValueOnce({});

      await expect(
        registryClient.resolveDependencies({ 'author/craft': '1.0.0' })
      ).rejects.toThrow('No registry configured');
    });

    it('should return null on API error', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      const result = await registryClient.resolveDependencies({});

      expect(result).toBeNull();
    });
  });

  describe.skip('downloadCraft', () => {
    it('should download craft to file', async () => {
      const fs = await import('fs');

      const mockStream = {
        pipe: vi.fn().mockReturnThis(),
        on: vi.fn((event, handler) => {
          if (event === 'finish') {
            setTimeout(() => handler(), 0);
          }
          return mockStream;
        })
      };

      const mockWriter = {
        on: vi.fn((event, handler) => {
          if (event === 'finish') {
            setTimeout(() => handler(), 0);
          }
          return mockWriter;
        })
      };

      (axios.get as any).mockResolvedValue({
        data: mockStream
      });

      (fs.createWriteStream as any).mockReturnValue(mockWriter);
      (fs.promises.mkdir as any).mockResolvedValue(undefined);

      await registryClient.downloadCraft(
        'https://test-registry.com/download/craft.zip',
        '/tmp/craft.zip'
      );

      expect(axios.get).toHaveBeenCalledWith(
        'https://test-registry.com/download/craft.zip',
        { responseType: 'stream', maxRedirects: 5 }
      );
    });

    it('should handle download errors', async () => {
      (axios.get as any).mockRejectedValue(new Error('Download failed'));

      await expect(
        registryClient.downloadCraft('https://test.com/craft.zip', '/tmp/craft.zip')
      ).rejects.toThrow('Failed to download craft: Download failed');
    });

    it('should handle stream errors', async () => {
      const fs = await import('fs');

      const mockStream = {
        pipe: vi.fn(),
        on: vi.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Stream error')), 0);
          }
          return mockStream;
        })
      };

      const mockWriter = {
        on: vi.fn((event, handler) => {
          return mockWriter;
        })
      };

      (axios.get as any).mockResolvedValue({
        data: mockStream
      });

      (fs.createWriteStream as any).mockReturnValue(mockWriter);
      (fs.promises.mkdir as any).mockResolvedValue(undefined);

      await expect(
        registryClient.downloadCraft('https://test.com/craft.zip', '/tmp/craft.zip')
      ).rejects.toThrow('Stream error');
    });
  });
});
