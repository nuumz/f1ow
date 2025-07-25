import { RouterProvider } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { router } from './router'

function App() {
  return (
    <>
      <RouterProvider router={router} />
      {/* Show devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <TanStackRouterDevtools router={router} />
      )}
    </>
  )
}

export default App
