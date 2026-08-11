const FREELANCER_HOST = /^https:\/\/(www\.)?freelancer\.com(\.[a-z]{2})?\//;

export function isFreelancerJobPage(): boolean {
  return FREELANCER_HOST.test(location.href) && /\/projects\//.test(location.pathname)
}

export function isFreelancerBidPage(): boolean {
  return FREELANCER_HOST.test(location.href) && /\/projects\/.*\/bid/.test(location.pathname)
}

export function hasFreelancerCards(): boolean {
  return (
    document.querySelectorAll(
      'fl-project-contest-card, .fl-project-contest-card, .JobSearchCard-item',
    ).length > 0
  )
}
