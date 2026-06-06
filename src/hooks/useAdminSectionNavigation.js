import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ADMIN_ROUTE_NAME_BY_SECTION,
  ADMIN_SECTION_BY_ROUTE_NAME,
  getAdminNavItems
} from '@/utils/adminDisplay'
import { getAdminSectionScrollCandidate } from './adminSectionNavigationCore.js'

export { getAdminSectionScrollCandidate }

export const useAdminSectionNavigation = ({
  canReadAudit,
  canReadIssues = { value: false },
  canReadUsers,
  dashboardSectionsRef,
  loadAll,
  route,
  router,
  showServiceSection,
  windowTarget = typeof window === 'undefined' ? null : window
}) => {
  const activeSection = ref('overview')
  const navItems = computed(() => getAdminNavItems({
    canReadUsers: canReadUsers.value,
    showServiceSection: showServiceSection.value,
    canReadAudit: canReadAudit.value,
    canReadIssues: canReadIssues.value
  }))

  const getSectionEl = (key) => dashboardSectionsRef.value?.getSectionEl(key) || null

  const scrollToSection = (key, { updateRoute = true } = {}) => {
    activeSection.value = key
    if (updateRoute) {
      const name = ADMIN_ROUTE_NAME_BY_SECTION[key]
      if (name && route.name !== name) {
        router.replace({ name })
      }
    }
    const el = getSectionEl(key)
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onMainScroll = () => {
    activeSection.value = getAdminSectionScrollCandidate(navItems.value, getSectionEl)
  }

  watch(navItems, (items) => {
    if (!items.some((item) => item.key === activeSection.value)) {
      activeSection.value = items[0]?.key || 'overview'
    }
  }, { immediate: true })

  onMounted(async () => {
    await loadAll()
    await nextTick()
    const preferredSection = ADMIN_SECTION_BY_ROUTE_NAME[route.name] || 'overview'
    if (navItems.value.some((item) => item.key === preferredSection)) {
      scrollToSection(preferredSection, { updateRoute: false })
    } else {
      onMainScroll()
      if (route.name !== 'AdminDashboard') {
        router.replace({ name: 'AdminDashboard' })
      }
    }
    windowTarget?.addEventListener?.('scroll', onMainScroll, { passive: true })
  })

  watch(() => route.name, async (name) => {
    const preferredSection = ADMIN_SECTION_BY_ROUTE_NAME[name] || 'overview'
    await nextTick()
    if (navItems.value.some((item) => item.key === preferredSection)) {
      scrollToSection(preferredSection, { updateRoute: false })
    } else if (route.name !== 'AdminDashboard') {
      router.replace({ name: 'AdminDashboard' })
    }
  })

  onBeforeUnmount(() => {
    windowTarget?.removeEventListener?.('scroll', onMainScroll)
  })

  return {
    activeSection,
    navItems,
    onMainScroll,
    scrollToSection
  }
}
