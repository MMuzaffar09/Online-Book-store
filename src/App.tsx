import { Storefront } from './components/Storefront';
import { AdminPortal } from './components/AdminPortal';

function App() {
  const isAdminPath = window.location.pathname.startsWith('/admin');

  if (isAdminPath) return <AdminPortal />;
  return <Storefront />;
}

export default App;
