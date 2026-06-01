const SCROLL_HEADER_OFFSET = 120

export const getAdminSectionScrollCandidate = (
  navItems = [],
  getSectionEl = () => null,
  headerOffset = SCROLL_HEADER_OFFSET
) => {
  const sections = navItems
    .map((item) => ({ key: item.key, el: getSectionEl(item.key) }))
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
