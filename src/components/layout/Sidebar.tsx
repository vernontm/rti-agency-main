import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard,
  Users,
  FileText,
  Video,
  Bell,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PenTool,
  Film,
  Sliders,
  GraduationCap,
  Inbox,
  Briefcase,
  Calendar,
  FolderOpen,
  Archive,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface NotificationCounts {
  pendingUsers: number
  pendingForms: number
  unreadAnnouncements: number
  inboxItems: number
  newAdvisories: number
  pendingJobApps: number
  newContacts: number
}

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  tooltip: string
  roles: string[]
}

interface NavCategory {
  name: string
  icon: LucideIcon
  roles: string[]
  items: NavItem[]
}

const Tooltip = ({ text, collapsed }: { text: string; collapsed: boolean }) => (
  <div
    className={`absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity duration-150 z-50 border border-gray-700 ${
      !collapsed ? 'hidden group-hover/item:block' : ''
    }`}
  >
    {text}
    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
  </div>
)

const Sidebar = () => {
  const { profile, signOut, viewAsRole, setViewAsRole, getEffectiveRole } = useAuthStore()
  const effectiveRole = getEffectiveRole()
  const isActualAdmin = profile?.role === 'admin'
  const [collapsed, setCollapsed] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Main', 'Educator Area', 'Management', 'Content Tools', 'Settings'])
  const [counts, setCounts] = useState<NotificationCounts>({
    pendingUsers: 0,
    pendingForms: 0,
    unreadAnnouncements: 0,
    inboxItems: 0,
    newAdvisories: 0,
    pendingJobApps: 0,
    newContacts: 0,
  })

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchCounts()
      const interval = setInterval(fetchCounts, 30000)
      return () => clearInterval(interval)
    }
  }, [profile])

  const fetchCounts = async () => {
    try {
      const { count: pendingUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: pendingForms, error: formsError } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: pendingJobApps, error: jobsError } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: newContacts, error: contactsError } = await supabase
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')

      const { count: newAdvisories, error: advisoriesError } = await supabase
        .from('advisories')
        .select('*', { count: 'exact', head: true })
        .eq('is_visible', true)

      if (usersError) console.error('Users count error:', usersError)
      if (formsError) console.error('Forms count error:', formsError)
      if (jobsError) console.error('Jobs count error:', jobsError)
      if (contactsError) console.error('Contacts count error:', contactsError)
      if (advisoriesError) console.error('Advisories count error:', advisoriesError)

      const inboxItems = (pendingUsers || 0) + (pendingForms || 0) + (pendingJobApps || 0) + (newContacts || 0)

      setCounts({
        pendingUsers: pendingUsers || 0,
        pendingForms: pendingForms || 0,
        unreadAnnouncements: 0,
        inboxItems,
        newAdvisories: newAdvisories || 0,
        pendingJobApps: pendingJobApps || 0,
        newContacts: newContacts || 0,
      })
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

  const getCountForRoute = (route: string): number => {
    switch (route) {
      case '/admin/pending-users':
        return counts.pendingUsers
      case '/forms':
      case '/educator-area':
        return profile?.role === 'admin' ? counts.pendingForms : 0
      case '/admin/inbox':
        return counts.inboxItems
      case '/advisories':
        return counts.newAdvisories
      case '/admin/job-applications':
        return counts.pendingJobApps
      default:
        return 0
    }
  }

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    )
  }

  const navCategories: NavCategory[] = [
    {
      name: 'Main',
      icon: LayoutDashboard,
      roles: ['admin', 'employee', 'client'],
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', tooltip: 'Overview & quick stats', roles: ['admin', 'employee', 'client'] },
        { to: '/announcements', icon: Bell, label: 'Announcements', tooltip: 'Company announcements', roles: ['admin', 'employee', 'client'] },
      ]
    },
    {
      name: 'Educator Area',
      icon: GraduationCap,
      roles: ['admin', 'employee', 'client'],
      items: [
        { to: '/training', icon: Video, label: 'Training', tooltip: 'Training videos & courses', roles: ['admin', 'employee', 'client'] },
        { to: '/educator-area', icon: ClipboardList, label: 'Forms', tooltip: 'Submit & view forms', roles: ['admin', 'employee'] },
        { to: '/documents', icon: FolderOpen, label: 'Documents', tooltip: 'Advisories & downloads', roles: ['admin', 'employee'] },
        { to: '/calendar', icon: Calendar, label: 'Calendar', tooltip: 'Schedule & events', roles: ['admin', 'employee'] },
      ]
    },
    {
      name: 'Management',
      icon: Users,
      roles: ['admin'],
      items: [
        { to: '/admin/inbox', icon: Inbox, label: 'Inbox', tooltip: 'Pending items & submissions', roles: ['admin'] },
        { to: '/users', icon: Users, label: 'Users', tooltip: 'Manage user accounts', roles: ['admin'] },
        { to: '/admin/job-positions', icon: Briefcase, label: 'Job Positions', tooltip: 'Manage job listings', roles: ['admin'] },
        { to: '/admin/file-manager', icon: FileText, label: 'File Manager', tooltip: 'Upload & manage files', roles: ['admin'] },
        { to: '/admin/archives', icon: Archive, label: 'Archives', tooltip: 'Archived records', roles: ['admin'] },
      ]
    },
    {
      name: 'Content Tools',
      icon: PenTool,
      roles: ['admin'],
      items: [
        { to: '/admin/forms', icon: PenTool, label: 'Form Builder', tooltip: 'Create & edit forms', roles: ['admin'] },
        { to: '/admin/videos', icon: Film, label: 'Video Manager', tooltip: 'Manage training videos', roles: ['admin'] },
        { to: '/admin/video-settings', icon: Sliders, label: 'Video Settings', tooltip: 'Video categories & config', roles: ['admin'] },
      ]
    },
    {
      name: 'Settings',
      icon: Settings,
      roles: ['admin'],
      items: [
        { to: '/settings', icon: Settings, label: 'Settings', tooltip: 'App configuration', roles: ['admin'] },
      ]
    },
  ]

  const filteredCategories = navCategories
    .filter(cat => effectiveRole && cat.roles.includes(effectiveRole))
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item => effectiveRole && item.roles.includes(effectiveRole))
    }))
    .filter(cat => cat.items.length > 0)

  return (
    <aside
      className={`bg-gray-900 text-white h-screen flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-xl font-bold text-orange-400">RTI Agency</h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
        {filteredCategories.map((category) => {
          const isExpanded = expandedCategories.includes(category.name)
          const CategoryIcon = category.icon

          return (
            <div key={category.name} className="mb-1">
              {/* Category Header */}
              {!collapsed ? (
                <button
                  onClick={() => toggleCategory(category.name)}
                  aria-expanded={isExpanded}
                  aria-controls={`sidebar-panel-${category.name.replace(/\s+/g, '-').toLowerCase()}`}
                  className="w-full flex items-center justify-between px-3 py-2 mt-2 first:mt-0 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors rounded-md"
                >
                  <span className="flex items-center gap-2">
                    <CategoryIcon size={14} />
                    {category.name}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              ) : (
                <div className="my-2 mx-2 border-t border-gray-800" />
              )}

              {/* Category Items */}
              <div id={`sidebar-panel-${category.name.replace(/\s+/g, '-').toLowerCase()}`} className={`space-y-0.5 ${!collapsed && !isExpanded ? 'hidden' : ''}`}>
                {category.items.map((item) => (
                  <div key={item.to} className="relative group/item">
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        } ${collapsed ? 'justify-center' : 'ml-1'}`
                      }
                    >
                      <div className="relative flex-shrink-0">
                        <item.icon size={20} />
                        {collapsed && getCountForRoute(item.to) > 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {getCountForRoute(item.to) > 99 ? '99+' : getCountForRoute(item.to)}
                          </span>
                        )}
                      </div>
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between text-sm">
                          {item.label}
                          {getCountForRoute(item.to) > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5">
                              {getCountForRoute(item.to) > 99 ? '99+' : getCountForRoute(item.to)}
                            </span>
                          )}
                        </span>
                      )}
                    </NavLink>
                    <Tooltip text={collapsed ? item.label : item.tooltip} collapsed={collapsed} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        {/* View As Role Switcher - Admin Only */}
        {!collapsed && isActualAdmin && (
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">View as</label>
            <select
              value={viewAsRole || ''}
              onChange={(e) => setViewAsRole(e.target.value as 'admin' | 'employee' | 'client' | null || null)}
              className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-orange-500 focus:outline-none"
            >
              <option value="">Admin (Default)</option>
              <option value="employee">Employee</option>
              <option value="client">Client</option>
            </select>
            {viewAsRole && (
              <p className="text-xs text-orange-400 mt-1">Viewing as {viewAsRole}</p>
            )}
          </div>
        )}
        {!collapsed && profile && (
          <div className="mb-4">
            <p className="text-sm font-medium truncate">{profile.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
          </div>
        )}
        <div className="relative group/item">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 w-full text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {!collapsed && <span className="text-sm">Sign Out</span>}
          </button>
          {collapsed && <Tooltip text="Sign Out" collapsed={collapsed} />}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
