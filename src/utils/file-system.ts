/**
 * File system utilities for reading and writing CraftDesk configuration files
 */

import fs from 'fs-extra';
import path from 'path';
import { CraftDeskJson } from '../types/craftdesk-json';
import { CraftDeskLock } from '../types/craftdesk-lock';

/**
 * Reads and parses a craftdesk.json file from the specified directory
 *
 * @param dir - Directory containing craftdesk.json (defaults to current working directory)
 * @returns Parsed CraftDeskJson object or null if file doesn't exist or is invalid
 */
export async function readCraftDeskJson(dir: string = process.cwd()): Promise<CraftDeskJson | null> {
  const filePath = path.join(dir, 'craftdesk.json');

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Writes a CraftDeskJson object to craftdesk.json with pretty formatting
 *
 * @param data - CraftDeskJson object to write
 * @param dir - Directory to write craftdesk.json to (defaults to current working directory)
 */
export async function writeCraftDeskJson(data: CraftDeskJson, dir: string = process.cwd()): Promise<void> {
  const filePath = path.join(dir, 'craftdesk.json');
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Reads and parses a craftdesk.lock file from the specified directory
 *
 * @param dir - Directory containing craftdesk.lock (defaults to current working directory)
 * @returns Parsed CraftDeskLock object or null if file doesn't exist or is invalid
 */
export async function readCraftDeskLock(dir: string = process.cwd()): Promise<CraftDeskLock | null> {
  const filePath = path.join(dir, 'craftdesk.lock');

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Writes a CraftDeskLock object to craftdesk.lock with pretty formatting
 *
 * @param data - CraftDeskLock object to write
 * @param dir - Directory to write craftdesk.lock to (defaults to current working directory)
 */
export async function writeCraftDeskLock(data: CraftDeskLock, dir: string = process.cwd()): Promise<void> {
  const filePath = path.join(dir, 'craftdesk.lock');
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Ensures a directory exists, creating it and any parent directories if needed
 *
 * @param dirPath - Path to the directory to ensure exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

/**
 * Recursively removes a directory and all its contents
 *
 * @param dirPath - Path to the directory to remove
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.remove(dirPath);
}

/**
 * Checks if a file or directory exists at the specified path
 *
 * @param filePath - Path to check for existence
 * @returns True if the path exists and is accessible, false otherwise
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}