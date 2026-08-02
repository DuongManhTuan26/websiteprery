import crypto from 'node:crypto';

// Deterministic-looking but collision-avoiding: lowercase/hyphenate the
// name, then append a short random suffix so two workspaces named "Acme"
// don't fight over the same slug.
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'workspace'}-${suffix}`;
}
