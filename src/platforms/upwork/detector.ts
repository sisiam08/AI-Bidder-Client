export function isUpworkJobPage(): boolean {
  return /^https:\/\/(www\.)?upwork\.com\/jobs\/~/.test(location.href)
}

export function isUpworkProposalPage(): boolean {
  return /^https:\/\/(www\.)?upwork\.com\/proposals\/~/.test(location.href)
}

export function hasUpworkCards(): boolean {
  return (
    document.querySelectorAll<HTMLElement>(
      'section.air3-card-section a[href^="/jobs/"]',
    ).length > 0
  )
}
