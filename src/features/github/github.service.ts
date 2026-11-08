import { GITHUB_TOKEN } from 'astro:env/server';
import { cached } from '../../lib/server/cache';
import { fetchJson, orNull } from '../../lib/server/http';

const API = 'https://api.github.com';
const TTL_SECONDS = 60 * 60;
const MAX_TAGS = 2;

export interface RepoData {
  name: string;
  /** `null` cuando el repo no tiene descripción: la vista usa la del i18n. */
  description: string | null;
  tags: string[];
  url: string;
}

export interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  html_url: string;
}

export interface GithubTopics {
  names: string[];
}

/** Mapea la respuesta de la API: tags = lenguaje + topics, sin duplicados, máximo 2. */
export function mapRepo(repo: GithubRepo, topics: string[]): RepoData {
  const candidates = [repo.language, ...topics].filter((tag): tag is string => Boolean(tag?.trim()));
  const tags: string[] = [];
  for (const tag of candidates) {
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return {
    name: repo.name,
    description: repo.description?.trim() || null,
    tags,
    url: repo.html_url,
  };
}

export async function fetchFeaturedRepo(owner: string, repo: string, token?: string): Promise<RepoData> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'bento-tree',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const [data, topics] = await Promise.all([
    fetchJson<GithubRepo>(base, { headers }),
    fetchJson<GithubTopics>(`${base}/topics`, { headers }),
  ]);
  return mapRepo(data, topics.names ?? []);
}

export function getFeaturedRepo(owner: string, repo: string): Promise<RepoData | null> {
  return cached(`github:repo:${owner}/${repo}`, TTL_SECONDS, () =>
    orNull('github', () => fetchFeaturedRepo(owner, repo, GITHUB_TOKEN || undefined)),
  );
}
