import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

const MainLayout = () => {
  const location = useLocation()
  
  return (
    <div className="flex h-screen bg-gray-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-orange-700 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-700"
      >
        Skip to content
      </a>
      <Sidebar />
      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        <div className="p-6">
          <Outlet key={location.pathname} />
        </div>
      </main>
    </div>
  )
}

export default MainLayout
