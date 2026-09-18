import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { authSceneUrl, dashboardMountainsUrl } from './brandAssets'
import './styles.css'

document.documentElement.style.setProperty('--auth-scene', `url("${authSceneUrl}")`)
document.documentElement.style.setProperty('--dashboard-mountains', `url("${dashboardMountainsUrl}")`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
