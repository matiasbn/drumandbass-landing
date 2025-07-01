import type { Dj } from "./types";

/**
 * Generates a URL-friendly ID from a DJ's name by removing spaces and converting to lowercase.
 * @param dj The DJ object.
 * @returns The URL-friendly ID string.
 */
export const getDjId = (dj: Dj) => dj.name.replace(/\s+/g, "").toLowerCase();
