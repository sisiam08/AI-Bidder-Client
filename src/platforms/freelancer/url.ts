export function parseFreelancerSlug(pathOrId: string): string {
  const clean = (pathOrId || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '')
  const match = clean.match(/^\/projects\/(.+)$/)
  const rest = (match ? match[1] : clean).replace(/^\/+/, '')
  return rest.replace(/\/(details|bid)$/i, '')
}

export function freelancerProjectUrl(slugOrId: string): string {
  const slug = parseFreelancerSlug(slugOrId)
  return `https://www.freelancer.com/projects/${slug}/details`
}