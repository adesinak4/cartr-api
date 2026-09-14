/** Pure — lowercases, strips non-alphanumerics to hyphens, trims edge hyphens. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'store'
  );
}
