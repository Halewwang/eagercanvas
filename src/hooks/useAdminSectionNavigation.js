import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ADMIN_ROUTE_NAME_BY_SECTION,
  ADMIN_SECTION_BY_ROUTE_NAME,
  getAdminNavItems
} from '@/utils/adminDisplay'
import {
  getAdminSectionScrollCandidate,
  resolveAdminScrollTarget,
  shouldAutoScrollAdminSection,
  shouldRouteOwnAdminActiveSection
} from './adminSectionNavigationCore.js'

export {
  getAdminSectionScrollCandidate,
  resolveAdminScrollTarget,
  shouldAutoScrollAdminSection,
  shouldRouteOwnAdminActiveSection
}

export const useAdminSectionNavigation = ({
  canReadAudit,
  canReadIssues = { value: false },
  canReadUsers,
  dashboardSectionsRef,
  loadAll,
  route,
  router,
  scrollTarget = null,
  showServiceSection,
  windowTarget = typeof window === 'undefined' ? null : window
}) => {
  const activeSection = ref('overview')
  let activeScrollTarget = null
  const navItems = computed(() => getAdminNavItems({
    canReadUsers: canReadUsers.value,
    showServiceSection: showServiceSection.value,
    canReadAudit: canReadAudit.value,
    canReadIssues: canReadIssues.value
  }))

  const getSectionEl = (key) => dashboardSectionsRef.value?.getSectionEl(key) || null
  const getPreferredRouteSection = (routeName = route.name) => {
    const preferredSection = ADMIN_SECTION_BY_ROUTE_NAME[routeName] || 'overview'
    return navItems.value.some((item) => item.key === preferredSection) ? preferredSection : ''
  }

  const scrollToSection = (key, { updateRoute = true, loadData = true } = {}) => {
    activeSection.value = key
    const routeName = ADMIN_ROUTE_NAME_BY_SECTION[key]
    const shouldDeferToRouteWatcher = updateRoute && routeName && route.name !== routeName
    if (loadData && !shouldDeferToRouteWatcher) void loadAll({ sectionKey: key })
    if (updateRoute) {
      if (routeName && route.name !== routeName) {
        router.replace({ name: routeName })
      }
    }
    const el = getSectionEl(key)
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onMainScroll = () => {
    const preferredSection = getPreferredRouteSection()
    if (shouldRouteOwnAdminActiveSection({ routeName: route.name, sectionKey: preferredSection })) {
      activeSection.value = preferredSection
      return
    }
    activeSection.value = getAdminSectionScrollCandidate(navItems.value, getSectionEl)
  }

  watch(navItems, (items) => {
    if (!items.some((item) => item.key === activeSection.value)) {
      activeSection.value = items[0]?.key || 'overview'
    }
  }, { immediate: true })

  onMounted(async () => {
    const preferredSection = getPreferredRouteSection() || 'overview'
    await loadAll({ sectionKey: preferredSection || 'overview' })
    await nextTick()
    activeScrollTarget = resolveAdminScrollTarget({ scrollTarget, windowTarget }) || windowTarget
    if (navItems.value.some((item) => item.key === preferredSection)) {
      if (shouldAutoScrollAdminSection({ routeName: route.name, sectionKey: preferredSection })) {
        scrollToSection(preferredSection, { updateRoute: false, loadData: false })
      } else {
        activeSection.value = preferredSection
        onMainScroll()
      }
    } else {
      onMainScroll()
      if (route.name !== 'AdminDashboard') {
        router.replace({ name: 'AdminDashboard' })
      }
    }
    activeScrollTarget?.addEventListener?.('scroll', onMainScroll, { passive: true })
  })

  watch(() => route.name, async (name) => {
    const preferredSection = ADMIN_SECTION_BY_ROUTE_NAME[name] || 'overview'
    if (navItems.value.some((item) => item.key === preferredSection)) {
      await loadAll({ sectionKey: preferredSection })
    }
    await nextTick()
    if (navItems.value.some((item) => item.key === preferredSection)) {
      if (shouldAutoScrollAdminSection({ routeName: name, sectionKey: preferredSection })) {
        scrollToSection(preferredSection, { updateRoute: false, loadData: false })
      } else {
        activeSection.value = preferredSection
      }
    } else if (route.name !== 'AdminDashboard') {
      router.replace({ name: 'AdminDashboard' })
    }
  })

  onBeforeUnmount(() => {
    activeScrollTarget?.removeEventListener?.('scroll', onMainScroll)
  })

  return {
    activeSection,
    navItems,
    onMainScroll,
    scrollToSection
  }
}
