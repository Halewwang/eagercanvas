const SCROLL_HEADER_OFFSET = 120

export const shouldAutoScrollAdminSection = ({ routeName = '', sectionKey = '' } = {}) => {
  return !(routeName === 'AdminDashboard' && sectionKey === 'overview')
}

export const shouldRouteOwnAdminActiveSection = ({ routeName = '', sectionKey = '' } = {}) => {
  return Boolean(routeName && sectionKey && routeName !== 'AdminDashboard')
}

export const resolveAdminScrollTarget = ({ scrollTarget = null, windowTarget = null } = {}) => {
  if (scrollTarget) return scrollTarget
  return windowTarget?.document?.getElementById?.('app') || null
}

const resolveSectionElement = (section) => {
  if (!section) return null
  if (typeof section.getBoundingClientRect === 'function') return section

  const exposedEl = section.getSectionEl?.() || section.getSurfaceEl?.() || section.$el
  if (typeof exposedEl?.getBoundingClientRect === 'function') return exposedEl
  return null
}

export const getAdminSectionScrollCandidate = (
  navItems = [],
  getSectionEl = () => null,
  headerOffset = SCROLL_HEADER_OFFSET
) => {
  const sections = navItems
    .map((item) => ({ key: item.key, el: resolveSectionElement(getSectionEl(item.key)) }))
    .filter((item) => !!item.el)

  let candidate = navItems[0]?.key || 'overview'
  let min = Number.POSITIVE_INFINITY

  for (const item of sections) {
    const top = Math.abs(item.el.getBoundingClientRect().top - headerOffset)
    if (top < min) {
      min = top
      candidate = item.key
    }
  }

  return candidate
}
