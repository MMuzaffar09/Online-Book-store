import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  FileText,
  LayoutDashboard,
  Library,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { sampleBooks, sampleCategories, sampleOrders, sampleUsers } from '../data';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { AdminView, Book, Category, Order, User } from '../types';

type CatalogRow = Omit<Book, 'category'> & { categories?: { name?: string } | null };
type CategoryRow = Pick<Category, 'id' | 'name' | 'description'>;

const navItems: { id: AdminView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'users', label: 'Customers', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'sales', label: 'Sales analytics', icon: BarChart3 },
];

const statusStyles: Record<string, string> = {
  Pending: 'status status-pending',
  Confirmed: 'status status-confirmed',
  Processing: 'status status-processing',
  Shipped: 'status status-shipped',
  Delivered: 'status status-delivered',
  Cancelled: 'status status-cancelled',
  Paid: 'status status-delivered',
  Failed: 'status status-cancelled',
  Active: 'status status-delivered',
};

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function getViewFromPath(): AdminView {
  const segment = window.location.pathname.split('/')[2] as AdminView | undefined;
  return navItems.some((item) => item.id === segment) ? segment as AdminView : 'dashboard';
}

export function AdminPortal() {
  const { session, profile, loading: authLoading, signIn, signOut } = useAuth();
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState<AdminView>(() => getViewFromPath());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [categories, setCategories] = useState<Category[]>(sampleCategories);
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [users] = useState<User[]>(sampleUsers);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [bookModal, setBookModal] = useState<Book | 'new' | null>(null);
  const [categoryModal, setCategoryModal] = useState<Category | 'new' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    window.history.replaceState({}, '', `/admin${view === 'dashboard' ? '' : `/${view}`}`);
  }, [view]);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      if (!supabase) return;
      const [{ data: bookRows }, { data: categoryRows }] = await Promise.all([
        supabase.from('books').select('id,title,author,price,stock,rating,review_count,image_url,publisher,isbn,description,published_date,categories(name)').order('created_at', { ascending: false }),
        supabase.from('categories').select('id,name,description').order('name'),
      ]);
      if (!active) return;
      const loadedBooks = (bookRows as CatalogRow[] | null)?.map((book) => ({ ...book, category: book.categories?.name ?? 'Uncategorized' })) ?? [];
      if (loadedBooks.length) setBooks(loadedBooks);
      if (categoryRows?.length) {
        const loadedCategories = categoryRows as CategoryRow[];
        setCategories(loadedCategories.map((category) => ({ ...category, bookCount: loadedBooks.filter((book) => book.category === category.name).length })));
      }
    }
    void loadCatalog();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      if (!supabase || !session?.user) return;
      setOrdersLoading(true);
      const { data: orderRows } = await supabase
        .from('orders')
        .select('id,user_id,total_amount,shipping_name,shipping_phone,shipping_city,payment_method,payment_status,order_status,created_at')
        .order('created_at', { ascending: false });
      if (!active || !orderRows) { setOrdersLoading(false); return; }
      const db = supabase;
      if (!db) { setOrdersLoading(false); return; }
      const formatted: Order[] = await Promise.all(orderRows.map(async (row: { id: string; user_id: string; total_amount: number; shipping_name: string; shipping_phone: string; shipping_city: string; payment_method: string; payment_status: string; order_status: string; created_at: string }) => {
        const { data: items } = await db.from('order_items').select('quantity').eq('order_id', row.id);
        const itemCount = items?.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0) ?? 0;
        const { data: profileRow } = await db.from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
        return {
          id: row.id.replace('BK-', ''),
          customer: profileRow?.full_name || row.shipping_name || 'Unknown',
          date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          items: itemCount,
          amount: Number(row.total_amount),
          payment: row.payment_status,
          status: row.order_status,
        };
      }));
      if (active) {
        setOrders(formatted);
        setOrdersLoading(false);
      }
    }
    void loadOrders();
    return () => { active = false; };
  }, [session]);

  function navigate(nextView: AdminView) {
    setView(nextView);
    setMobileNavOpen(false);
    setQuery('');
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  }

  async function saveBook(book: Book) {
    setBooks((current) => current.some((item) => item.id === book.id) ? current.map((item) => item.id === book.id ? book : item) : [book, ...current]);
    setBookModal(null);
    flash(bookModal === 'new' ? 'Book added to the catalog.' : 'Book details updated.');
    if (supabase) {
      const category = categories.find((item) => item.name === book.category);
      const { error } = await supabase.from('books').upsert({ id: book.id.length > 10 ? book.id : undefined, title: book.title, author: book.author, price: book.price, stock: book.stock, rating: book.rating, review_count: book.review_count, category_id: category?.id, publisher: book.publisher, isbn: book.isbn, description: book.description ?? '' });
      if (error) flash('Saved in this preview; sign in as an admin to sync changes.');
    }
  }

  async function deleteBook(id: string) {
    const book = books.find((item) => item.id === id);
    if (!book || !window.confirm(`Delete "${book.title}" from the catalog?`)) return;
    setBooks((current) => current.filter((item) => item.id !== id));
    flash('Book removed from the catalog.');
    if (supabase && id.length > 10) await supabase.from('books').delete().eq('id', id);
  }

  function saveCategory(category: Category) {
    setCategories((current) => current.some((item) => item.id === category.id) ? current.map((item) => item.id === category.id ? category : item) : [...current, category]);
    setCategoryModal(null);
    flash(categoryModal === 'new' ? 'Category created.' : 'Category updated.');
  }

  async function updateOrderStatus(id: string, status: string) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
    flash(`Order ${id} marked ${status.toLowerCase()}.`);
    if (supabase) await supabase.from('orders').update({ order_status: status }).eq('id', id);
  }

  async function handleSignOut() {
    await signOut();
    setView('dashboard');
    setMobileNavOpen(false);
    setAuthError('');
  }

  const filteredBooks = useMemo(() => books.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase())), [books, query]);

  if (authLoading || (session && !profile)) return <AuthLoading />;
  if (!session || profile?.role !== 'admin') {
    return <LoginPage error={authError} onSignIn={async (email, password) => {
      setAuthError('');
      try {
        await signIn(email, password);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Unable to sign in. Check your email and password.');
      }
    }} />;
  }

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark"><Library size={20} strokeWidth={1.8} /></div>
          <div><strong>Khan Creations</strong><span>Admin workspace</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="workspace-label">Workspace</div>
        <nav className="side-nav" aria-label="Admin navigation">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === 'orders' && <em>6</em>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings size={18} strokeWidth={1.8} /><span>Settings</span></button>
          <button className="nav-item logout-item" onClick={() => void handleSignOut()}><LogOut size={18} strokeWidth={1.8} /><span>Sign out</span></button>
          <div className="admin-account"><div className="avatar avatar-sand">{getInitials(profile.full_name)}</div><div><strong>{profile.full_name}</strong><span>Administrator</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-overlay" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="crumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions"><div className="topbar-search"><Search size={16} /><input placeholder="Search anything" aria-label="Search" value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button><div className="avatar avatar-ink">{getInitials(profile.full_name)}</div></div>
        </header>
        <div className="content-area">
          {view === 'dashboard' && <Dashboard books={books} orders={orders} users={users} onNavigate={navigate} />}
          {view === 'books' && <BooksView books={filteredBooks} query={query} onQuery={setQuery} onAdd={() => setBookModal('new')} onEdit={setBookModal} onDelete={deleteBook} />}
          {view === 'categories' && <CategoriesView categories={categories} onAdd={() => setCategoryModal('new')} onEdit={setCategoryModal} />}
          {view === 'orders' && <OrdersView orders={orders} loading={ordersLoading} onUpdate={updateOrderStatus} />}
          {view === 'users' && <UsersView users={users} />}
          {view === 'inventory' && <InventoryView books={books} />}
          {view === 'sales' && <SalesView />}
        </div>
      </main>
      {bookModal && <BookModal book={bookModal} categories={categories} onClose={() => setBookModal(null)} onSave={saveBook} />}
      {categoryModal && <CategoryModal category={categoryModal} onClose={() => setCategoryModal(null)} onSave={saveCategory} />}
      {settingsOpen && <SettingsModal profile={profile} onClose={() => setSettingsOpen(false)} onSignOut={handleSignOut} />}
      {notice && <div className="toast"><span className="toast-icon"><Check size={15} /></span>{notice}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ books, orders, users, onNavigate }: { books: Book[]; orders: Order[]; users: User[]; onNavigate: (view: AdminView) => void }) {
  const revenue = orders.reduce((sum, order) => sum + order.amount, 0) * 22;
  return <>
    <PageHeading eyebrow="Monday, August 24, 2026" title="Good morning, Muzaffar" description="Here's what's happening across your bookstore today." action={<button className="button button-primary" onClick={() => onNavigate('books')}><Plus size={17} /> Add a book</button>} />
    <div className="metric-grid">
      <MetricCard label="Total revenue" value={money(revenue)} change="18.4%" trend="up" icon={<CircleDollarSign size={19} />} tone="green" />
      <MetricCard label="Active orders" value="248" change="12.6%" trend="up" icon={<ShoppingBag size={19} />} tone="blue" />
      <MetricCard label="Total customers" value={users.length.toLocaleString()} change="8.2%" trend="up" icon={<Users size={19} />} tone="gold" />
      <MetricCard label="Books in catalog" value={books.length.toString()} change="2.1%" trend="down" icon={<BookOpen size={19} />} tone="rose" />
    </div>
    <div className="dashboard-grid">
      <section className="panel sales-panel"><div className="panel-heading"><div><h2>Sales overview</h2><p>Revenue performance over the last 30 days</p></div><button className="select-button">Last 30 days <ChevronDown size={15} /></button></div><div className="chart-label"><strong>$12,842</strong><span><ArrowUpRight size={14} /> 18.4% vs last month</span></div><MiniLineChart /></section>
      <section className="panel fulfillment-panel"><div className="panel-heading"><div><h2>Fulfillment</h2><p>Orders by current status</p></div><button className="more-button"><MoreHorizontal size={19} /></button></div><div className="donut-wrap"><div className="donut"><div><strong>248</strong><span>Total orders</span></div></div><div className="legend"><LegendDot color="blue" label="Processing" value="88" /><LegendDot color="gold" label="Pending" value="42" /><LegendDot color="green" label="Delivered" value="106" /><LegendDot color="gray" label="Other" value="12" /></div></div></section>
    </div>
    <div className="dashboard-grid lower-grid"><section className="panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>The latest activity from your customers</p></div><button className="text-button" onClick={() => onNavigate('orders')}>View all <ChevronRight size={15} /></button></div><OrdersTable orders={orders.slice(0, 4)} compact /></section><section className="panel"><div className="panel-heading"><div><h2>Inventory watch</h2><p>Books that need your attention</p></div><button className="text-button" onClick={() => onNavigate('inventory')}>View inventory <ChevronRight size={15} /></button></div><div className="stock-list">{books.filter((book) => book.stock < 10).slice(0, 4).map((book) => <div className="stock-row" key={book.id}><div className="book-cover mini-cover">{book.title.slice(0, 1)}</div><div className="stock-book"><strong>{book.title}</strong><span>{book.author}</span></div><span className={`stock-count ${book.stock < 5 ? 'critical' : ''}`}>{book.stock} left</span></div>)}</div></section></div>
  </>;
}

function MetricCard({ label, value, change, trend, icon, tone }: { label: string; value: string; change: string; trend: 'up' | 'down'; icon: ReactNode; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-content"><span>{label}</span><strong>{value}</strong><small className={trend === 'up' ? 'positive' : 'negative'}>{trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{change} <em>vs last month</em></small></div></div>;
}

function MiniLineChart() { return <div className="line-chart"><div className="chart-grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 760 190" preserveAspectRatio="none" aria-label="Sales trend chart"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#57877c" stopOpacity=".22" /><stop offset="1" stopColor="#57877c" stopOpacity="0" /></linearGradient></defs><path d="M0 150 C45 142 55 137 90 143 S140 110 180 125 S230 118 260 120 S305 80 345 94 S390 111 430 89 S470 91 510 71 S555 80 590 54 S640 62 675 38 S720 52 760 20 V190 H0Z" fill="url(#area)" /><path d="M0 150 C45 142 55 137 90 143 S140 110 180 125 S230 118 260 120 S305 80 345 94 S390 111 430 89 S470 91 510 71 S555 80 590 54 S640 62 675 38 S720 52 760 20" fill="none" stroke="#57877c" strokeWidth="3" strokeLinecap="round" /></svg><div className="x-axis"><span>Jul 26</span><span>Aug 02</span><span>Aug 09</span><span>Aug 16</span><span>Aug 24</span></div></div>; }
function LegendDot({ color, label, value }: { color: string; label: string; value: string }) { return <div className="legend-row"><span><i className={`dot ${color}`} />{label}</span><strong>{value}</strong></div>; }

function BooksView({ books, query, onQuery, onAdd, onEdit, onDelete }: { books: Book[]; query: string; onQuery: (query: string) => void; onAdd: () => void; onEdit: (book: Book) => void; onDelete: (id: string) => void }) {
  return <><PageHeading eyebrow="Catalog management" title="Books" description="Manage titles, pricing, and availability across your catalog." action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add new book</button>} /><section className="panel table-panel"><div className="toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search by title, author, or category" /></div><div className="toolbar-actions"><button className="filter-button">Category <ChevronDown size={15} /></button><button className="filter-button">Status <ChevronDown size={15} /></button></div></div><div className="table-scroll"><table><thead><tr><th>Book</th><th>Category</th><th>Price</th><th>Stock</th><th>Rating</th><th>Last updated</th><th /></tr></thead><tbody>{books.map((book) => <tr key={book.id}><td><div className="book-cell"><div className="book-cover">{book.title.slice(0, 1)}</div><div><strong>{book.title}</strong><span>{book.author}</span></div></div></td><td><span className="category-pill">{book.category}</span></td><td className="strong-cell">{money(book.price)}</td><td><span className={book.stock < 5 ? 'stock-badge low' : 'stock-badge'}>{book.stock} in stock</span></td><td><span className="rating"><span>★</span> {book.rating}</span><small className="review-count">({book.review_count})</small></td><td className="muted-cell">Today</td><td><div className="row-actions"><button onClick={() => onEdit(book)} aria-label={`Edit ${book.title}`}><Edit3 size={16} /></button><button onClick={() => onDelete(book.id)} aria-label={`Delete ${book.title}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{!books.length && <EmptyState title="No books found" description="Try a different search or add a new title to your catalog." action={<button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add book</button>} />}</div><div className="table-footer"><span>Showing <strong>{books.length}</strong> of 20 books</span><div className="pagination"><button disabled><ChevronLeft size={16} /></button><button className="current-page">1</button><button>2</button><button>3</button><button><ChevronRight size={16} /></button></div></div></section></>;
}

function CategoriesView({ categories, onAdd, onEdit }: { categories: Category[]; onAdd: () => void; onEdit: (category: Category) => void }) { return <><PageHeading eyebrow="Catalog structure" title="Categories" description="Organize your catalog so readers can find their next favorite book." action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add category</button>} /><div className="category-grid">{categories.map((category, index) => <div className="category-card" key={category.id}><div className={`category-art art-${index % 5}`}><Tags size={26} /><span>{String(index + 1).padStart(2, '0')}</span></div><div className="category-card-body"><div><h3>{category.name}</h3><p>{category.description}</p></div><div className="category-card-footer"><span><BookOpen size={14} /> {category.bookCount} books</span><button onClick={() => onEdit(category)}><Edit3 size={15} /> Edit</button></div></div></div>)}</div></>; }

function OrdersView({ orders, loading, onUpdate }: { orders: Order[]; loading: boolean; onUpdate: (id: string, status: string) => void }) { return <><PageHeading eyebrow="Customer activity" title="Orders" description="Track fulfillment and keep every customer's order moving." action={<button className="filter-button"><FileText size={16} /> Export report</button>} /><section className="panel table-panel"><div className="toolbar"><div className="tabs"><button className="tab active">All orders <span>{orders.length}</span></button><button className="tab">Pending <span>{orders.filter((o) => o.status === 'Pending').length}</span></button><button className="tab">Delivered <span>{orders.filter((o) => o.status === 'Delivered').length}</span></button></div><button className="filter-button">Newest first <ChevronDown size={15} /></button></div>{loading ? <div className="store-loading-inline"><div className="loading-spinner" /></div> : <OrdersTable orders={orders} onUpdate={onUpdate} />}<div className="table-footer"><span>Showing <strong>{orders.length}</strong> of {orders.length} orders</span></div></section></>; }

function OrdersTable({ orders, compact = false, onUpdate }: { orders: Order[]; compact?: boolean; onUpdate?: (id: string, status: string) => void }) { return <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Amount</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong className="order-id">#{order.id.replace('BK-', '')}</strong></td><td><div className="customer-cell"><div className="avatar avatar-small">{order.customer.split(' ').map((word) => word[0]).join('')}</div><strong>{order.customer}</strong></div></td><td className="muted-cell">{order.date}</td><td>{order.items}</td><td className="strong-cell">{money(order.amount)}</td><td><span className={statusStyles[order.payment] ?? 'status'}>{order.payment}</span></td><td>{onUpdate && !compact ? <select className="status-select" value={order.status} onChange={(event) => onUpdate(order.id, event.target.value)}>{['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select> : <span className={statusStyles[order.status] ?? 'status'}>{order.status}</span>}</td><td><button className="row-more"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>; }

function UsersView({ users }: { users: User[] }) { return <><PageHeading eyebrow="People & access" title="Customers" description="View the people who make Khan Creations possible." action={<button className="filter-button"><Users size={16} /> Invite customer</button>} /><section className="panel table-panel"><div className="toolbar"><div className="table-search"><Search size={16} /><input placeholder="Search customers" /></div><button className="filter-button">All roles <ChevronDown size={15} /></button></div><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Role</th><th>Joined</th><th>Status</th><th>Orders</th><th>Total spent</th><th /></tr></thead><tbody>{users.map((user, index) => <tr key={user.id}><td><div className="customer-cell"><div className={`avatar avatar-small avatar-color-${index % 4}`}>{user.name.split(' ').map((word) => word[0]).join('')}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div></td><td><span className={user.role === 'Admin' ? 'role-pill admin' : 'role-pill'}>{user.role}</span></td><td className="muted-cell">{user.joined}</td><td><span className="status status-delivered">{user.status}</span></td><td>{index * 3 + 4}</td><td className="strong-cell">{money((index + 2) * 126)}</td><td><button className="row-more"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div></section></>; }

function InventoryView({ books }: { books: Book[] }) { return <><PageHeading eyebrow="Stock control" title="Inventory" description="Stay ahead of low stock and keep bestsellers ready to ship." action={<button className="button button-primary"><Plus size={17} /> Stock adjustment</button>} /><div className="inventory-summary"><div><span>Healthy stock</span><strong>{books.filter((book) => book.stock >= 10).length}</strong><small>Titles with 10+ copies</small></div><div className="warning-summary"><span>Low stock</span><strong>{books.filter((book) => book.stock > 0 && book.stock < 10).length}</strong><small>Below your threshold of 10</small></div><div className="danger-summary"><span>Out of stock</span><strong>{books.filter((book) => book.stock === 0).length}</strong><small>Needs immediate attention</small></div></div><section className="panel table-panel"><div className="toolbar"><div><h2 className="section-title">Stock levels</h2><p className="section-subtitle">Updated just now</p></div><button className="filter-button">Sort: Lowest stock <ChevronDown size={15} /></button></div><div className="inventory-list">{[...books].sort((a, b) => a.stock - b.stock).map((book) => <div className="inventory-row" key={book.id}><div className="book-cell"><div className="book-cover">{book.title.slice(0, 1)}</div><div><strong>{book.title}</strong><span>{book.author} · {book.category}</span></div></div><div className="inventory-progress"><div><span>{book.stock} units</span><strong>{book.stock === 0 ? 'Out of stock' : book.stock < 10 ? 'Low stock' : 'In stock'}</strong></div><div className="progress-track"><i className={book.stock < 5 ? 'critical' : book.stock < 10 ? 'warning' : ''} style={{ width: `${Math.min(book.stock * 3, 100)}%` }} /></div></div><button className="filter-button">Adjust</button></div>)}</div></section></>; }

function SalesView() { const bars = [62, 78, 54, 83, 70, 92, 66, 88, 76, 97, 81, 90]; return <><PageHeading eyebrow="Performance" title="Sales analytics" description="Understand what readers are buying and where your growth is coming from." action={<button className="select-button">Aug 01 – Aug 24 <ChevronDown size={15} /></button>} /><div className="metric-grid analytics-metrics"><MetricCard label="Gross sales" value="$12,842" change="18.4%" trend="up" icon={<CircleDollarSign size={19} />} tone="green" /><MetricCard label="Average order value" value="$51.78" change="4.8%" trend="up" icon={<TrendingUp size={19} />} tone="blue" /><MetricCard label="Conversion rate" value="4.62%" change="1.2%" trend="up" icon={<Sparkles size={19} />} tone="gold" /><MetricCard label="Refunds" value="$284" change="2.1%" trend="down" icon={<ArrowDownRight size={19} />} tone="rose" /></div><div className="dashboard-grid"><section className="panel sales-panel"><div className="panel-heading"><div><h2>Revenue by day</h2><p>Daily gross sales across all channels</p></div></div><div className="bar-chart">{bars.map((height, index) => <div className="bar-column" key={index}><div className="bar" style={{ height: `${height}%` }} /><span>{index + 1}</span></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h2>Top categories</h2><p>Share of total sales</p></div></div><div className="category-sales">{['Technology', 'Self Development', 'Business', 'Fiction', 'Education'].map((category, index) => <div className="category-sale" key={category}><div><span>{category}</span><strong>{[38, 26, 18, 11, 7][index]}%</strong></div><div className="progress-track"><i style={{ width: `${[38, 26, 18, 11, 7][index] * 2.2}%` }} /></div></div>)}</div></section></div></>; }

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon"><Archive size={22} /></div><h3>{title}</h3><p>{description}</p>{action}</div>; }

function BookModal({ book, categories, onClose, onSave }: { book: Book | 'new'; categories: Category[]; onClose: () => void; onSave: (book: Book) => void }) {
  const initial = book === 'new' ? { id: crypto.randomUUID(), title: '', author: '', category: categories[0]?.name ?? 'Fiction', price: 20, stock: 10, rating: 4.5, review_count: 0, publisher: '', isbn: '', description: '' } : book;
  const [form, setForm] = useState<Book>(initial);
  function submit(event: FormEvent) { event.preventDefault(); if (!form.title || !form.author) return; onSave(form); }
  return <Modal title={book === 'new' ? 'Add a new book' : 'Edit book'} onClose={onClose}><form onSubmit={submit}><div className="form-grid"><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. The Creative Act" /></label><label>Author<input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="Author name" /></label><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category.id}>{category.name}</option>)}</select></label><label>Price<input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label><label>Stock<input type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} /></label><label>Rating<input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })} /></label><label>ISBN<input value={form.isbn} onChange={(event) => setForm({ ...form, isbn: event.target.value })} placeholder="978..." /></label><label>Publisher<input value={form.publisher} onChange={(event) => setForm({ ...form, publisher: event.target.value })} placeholder="Publisher" /></label></div><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A short original description" /></label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} /> Save book</button></div></form></Modal>;
}

function CategoryModal({ category, onClose, onSave }: { category: Category | 'new'; onClose: () => void; onSave: (category: Category) => void }) { const [form, setForm] = useState<Category>(category === 'new' ? { id: crypto.randomUUID(), name: '', description: '', bookCount: 0 } : category); return <Modal title={category === 'new' ? 'Add category' : 'Edit category'} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (form.name) onSave(form); }}><label>Category name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Travel" /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What readers will find here" /></label><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} /> Save category</button></div></form></Modal>; }

function SettingsModal({ profile, onClose, onSignOut }: { profile: { full_name: string; email: string }; onClose: () => void; onSignOut: () => Promise<void> }) {
  return <Modal title="Settings" onClose={onClose}>
    <div className="settings-section">
      <div className="settings-profile">
        <div className="avatar avatar-sand" style={{ width: '48px', height: '48px', fontSize: '18px' }}>{getInitials(profile.full_name)}</div>
        <div><strong>{profile.full_name}</strong><span>{profile.email}</span></div>
      </div>
    </div>
    <div className="settings-section">
      <h3>Workspace</h3>
      <p>You are signed in as an administrator.</p>
    </div>
    <div className="modal-actions">
      <button type="button" className="button button-quiet" onClick={onClose}>Close</button>
      <button type="button" className="button button-primary" onClick={() => void onSignOut()}><LogOut size={16} /> Sign out</button>
    </div>
  </Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><div className="eyebrow">Catalog workspace</div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}</div></div>; }

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function AuthLoading() {
  return <div className="auth-loading"><div className="auth-logo"><Library size={23} /></div><div className="loading-spinner" /><p>Checking your workspace access…</p></div>;
}

function LoginPage({ error, onSignIn }: { error: string; onSignIn: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    await onSignIn(email.trim(), password);
    setSubmitting(false);
  }

  return <div className="auth-shell"><div className="auth-visual"><div className="auth-visual-top"><div className="auth-logo"><Library size={22} /></div><span>Khan Creations</span></div><div className="auth-quote"><div className="quote-mark">"</div><blockquote>Books are a uniquely portable magic.</blockquote><span>— Stephen King</span></div><div className="auth-visual-footer"><span>Admin workspace</span><span>Secure access</span></div></div><main className="auth-card-wrap"><div className="auth-card"><div className="auth-card-heading"><div className="auth-mobile-logo"><Library size={20} /></div><div className="eyebrow">Admin workspace</div><h1>Welcome back</h1><p>Sign in to manage your bookstore and keep every story moving.</p></div><form className="auth-form" onSubmit={submit}><label><span>Email address</span><div className="input-with-icon"><Mail size={17} /><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label><label><span>Password</span><div className="input-with-icon"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>{error && <div className="auth-error">{error.includes('Invalid login') ? 'The email or password is incorrect. Please try again.' : error}</div>}<button className="auth-submit" disabled={submitting}>{submitting ? <><span className="button-spinner" /> Signing in…</> : 'Sign in to dashboard'}</button></form><p className="auth-help">Need access? Contact the store owner to get an administrator account.</p></div><div className="auth-footer">© 2026 Khan Creations <span>·</span> Your reading, beautifully managed.</div></main></div>;
}
