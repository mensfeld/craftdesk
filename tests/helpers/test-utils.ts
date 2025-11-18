import fs from 'fs-extra';
import path from 'path';

/**
 * Creates a temporary test directory
 */
export async function createTempDir(prefix: string = 'test-'): Promise<string> {
  const tmpDir = path.join(process.cwd(), '.test-tmp', `${prefix}${Date.now()}`);
  await fs.ensureDir(tmpDir);
  return tmpDir;
}

/**
 * Cleans up a temporary directory
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  if (dirPath.includes('.test-tmp')) {
    await fs.remove(dirPath);
  }
}

/**
 * Copies a fixture file to a target directory
 */
export async function copyFixture(fixtureName: string, targetDir: string): Promise<void> {
  const fixturePath = path.join(__dirname, '..', 'fixtures', fixtureName);
  const targetPath = path.join(targetDir, path.basename(fixtureName));
  await fs.copy(fixturePath, targetPath);
}

/**
 * Reads a JSON file and returns parsed content
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Writes a JSON object to a file
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Mock registry response for testing
 */
export function createMockCraftInfo(name: string, version: string = '1.0.0') {
  return {
    name,
    version,
    type: 'skill',
    author: 'test-author',
    description: 'Test craft',
    download_url: `https://craftdesk.ai/api/v1/crafts/test-author/${name}/versions/${version}/download`,
    integrity: 'sha256-test123',
    dependencies: {}
  };
}
