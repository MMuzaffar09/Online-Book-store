import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  KeyRound,
  Library,
  LogOut,
  Menu,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, type AuthProfile } from '@/hooks/useAuth';
import { sampleBooks, sampleCategories } from '@/data';

import type { Book, Category } from '@/types';

type CatalogRow = Omit<Book, 'category'> & { categories?: { name?: string } | null };
type CategoryRow = Pick<Category, 'id' | 'name' | 'description'>;

type StoreView = 'home' | 'browse' | 'book' | 'cart' | 'checkout' | 'orders' | 'account' | 'login' | 'register';

type CartItem = { book: Book; quantity: number };

const HERO_IMAGE = 'https://images.pexels.com/photos/2932549/pexels-photo-2932549.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function Storefront() {
  const { session, profile, loading: authLoading, signOut, sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [view, setView] = useState<StoreView>(() => getStoreViewFromPath());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [categories, setCategories] = useState<Category[]>(sampleCategories);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/' || path === '') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

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
    async function loadCart() {
      if (!supabase || !session?.user) return;
      const { data: cartData } = await supabase.from('cart').select('id').eq('user_id', session.user.id).maybeSingle();
      if (!active || !cartData) return;
      const { data: items } = await supabase.from('cart_items').select('id,book_id,quantity').eq('cart_id', cartData.id);
      if (!active || !items) return;
      const cartItems: CartItem[] = [];
      for (const item of items) {
        const book = books.find((b) => b.id === item.book_id);
        if (book) cartItems.push({ book, quantity: item.quantity });
      }
      setCart(cartItems);
      setCartCount(cartItems.reduce((sum, item) => sum + item.quantity, 0));
    }
    void loadCart();
    return () => { active = false; };
  }, [session, books]);

  function navigate(next: StoreView) {
    setView(next);
    setMobileMenuOpen(false);
    const path = next === 'home' ? '/' : `/${next}`;
    window.history.replaceState({}, '', path);
  }

  function openBook(book: Book) {
    setSelectedBook(book);
    setView('book');
    window.history.replaceState({}, '', `/book`);
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  }

  async function addToCart(book: Book) {
    if (!session?.user) {
      flash('Please sign in to add items to your cart.');
      navigate('login');
      return;
    }
    const existing = cart.find((item) => item.book.id === book.id);
    if (existing) {
      setCart((current) => current.map((item) => item.book.id === book.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart((current) => [...current, { book, quantity: 1 }]);
    }
    setCartCount((c) => c + 1);
    flash(`"${book.title}" added to cart.`);
    if (supabase) {
      const { data: cartData } = await supabase.from('cart').select('id').eq('user_id', session.user.id).maybeSingle();
      if (cartData) {
        if (existing) {
          await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('cart_id', cartData.id).eq('book_id', book.id);
        } else {
          await supabase.from('cart_items').insert({ cart_id: cartData.id, book_id: book.id, quantity: 1 });
        }
      } else {
        const { data: newCart } = await supabase.from('cart').insert({ user_id: session.user.id }).select('id').single();
        if (newCart) await supabase.from('cart_items').insert({ cart_id: newCart.id, book_id: book.id, quantity: 1 });
      }
    }
  }

  async function updateCartQuantity(bookId: string, delta: number) {
    const item = cart.find((i) => i.book.id === bookId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart((current) => current.filter((i) => i.book.id !== bookId));
      setCartCount((c) => c - item.quantity);
    } else {
      setCart((current) => current.map((i) => i.book.id === bookId ? { ...i, quantity: newQty } : i));
      setCartCount((c) => c + delta);
    }
    if (supabase && session?.user) {
      const { data: cartData } = await supabase.from('cart').select('id').eq('user_id', session.user.id).maybeSingle();
      if (cartData) {
        if (newQty <= 0) {
          await supabase.from('cart_items').delete().eq('cart_id', cartData.id).eq('book_id', bookId);
        } else {
          await supabase.from('cart_items').update({ quantity: newQty }).eq('cart_id', cartData.id).eq('book_id', bookId);
        }
      }
    }
  }

  async function removeFromCart(bookId: string) {
    const item = cart.find((i) => i.book.id === bookId);
    if (!item) return;
    setCart((current) => current.filter((i) => i.book.id !== bookId));
    setCartCount((c) => c - item.quantity);
    if (supabase && session?.user) {
      const { data: cartData } = await supabase.from('cart').select('id').eq('user_id', session.user.id).maybeSingle();
      if (cartData) await supabase.from('cart_items').delete().eq('cart_id', cartData.id).eq('book_id', bookId);
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.book.price * item.quantity, 0);

  const filteredBooks = useMemo(() => {
    let result = books;
    if (activeCategory) result = result.filter((book) => book.category === activeCategory);
    if (searchQuery) result = result.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(searchQuery.toLowerCase()));
    return result;
  }, [books, activeCategory, searchQuery]);

  const featuredBooks = books.slice(0, 4);
  const bestsellers = [...books].sort((a, b) => b.review_count - a.review_count).slice(0, 8);

  if (authLoading && view === 'login') return <StoreLoading />;

  return (
    <div className="store-shell">
      <StoreHeader
        cartCount={cartCount}
        profile={profile}
        onNavigate={navigate}
        onSearch={(q) => { setSearchQuery(q); navigate('browse'); }}
        onSignOut={signOut}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <main className="store-main">
        {view === 'home' && (
          <HomeView
            books={featuredBooks}
            bestsellers={bestsellers}
            categories={categories}
            profile={profile}
            onNavigate={navigate}
            onOpenBook={openBook}
            onAddToCart={addToCart}
            onCategory={(cat) => { setActiveCategory(cat); navigate('browse'); }}
          />
        )}
        {view === 'browse' && (
          <BrowseView
            books={filteredBooks}
            categories={categories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onOpenBook={openBook}
            onAddToCart={addToCart}
          />
        )}
        {view === 'book' && selectedBook && (
          <BookDetailView book={selectedBook} books={books} onAddToCart={addToCart} onNavigate={navigate} onOpenBook={openBook} />
        )}
        {view === 'book' && !selectedBook && <EmptyBookView onNavigate={navigate} />}
        {view === 'cart' && (
          <CartView cart={cart} total={cartTotal} onUpdateQty={updateCartQuantity} onRemove={removeFromCart} onNavigate={navigate} onCheckout={() => navigate('checkout')} />
        )}
        {view === 'checkout' && (
          <CheckoutView cart={cart} total={cartTotal} profile={profile} session={session} onNavigate={navigate} onPlaceOrder={async (shipping) => {
            if (!supabase || !session?.user) return;
            const { data: order } = await supabase.from('orders').insert({
              user_id: session.user.id,
              total_amount: cartTotal,
              shipping_name: shipping.name,
              shipping_phone: shipping.phone,
              shipping_address: shipping.address,
              shipping_city: shipping.city,
              shipping_state: shipping.state,
              shipping_postal_code: shipping.postalCode,
              payment_method: 'Cash on Delivery',
              payment_status: 'Pending',
              order_status: 'Pending',
            }).select('id').single();
            if (order) {
              await supabase.from('order_items').insert(cart.map((item) => ({
                order_id: order.id,
                book_id: item.book.id,
                quantity: item.quantity,
                price: item.book.price,
              })));
              const { data: cartData } = await supabase.from('cart').select('id').eq('user_id', session.user.id).maybeSingle();
              if (cartData) await supabase.from('cart_items').delete().eq('cart_id', cartData.id);
            }
            setCart([]);
            setCartCount(0);
            flash('Order placed successfully!');
            navigate('orders');
          }} />
        )}
        {view === 'orders' && <OrdersView session={session} onNavigate={navigate} />}
        {view === 'account' && <AccountView profile={profile} session={session} onNavigate={navigate} onSignOut={signOut} />}
        {view === 'login' && (
          <AuthView
            error={authError}
            onNavigate={navigate}
            onSendOtp={async (name, phone) => {
              setAuthError('');
              try {
                await sendPhoneOtp(name, phone);
                return true;
              } catch (error) {
                setAuthError(error instanceof Error ? error.message : 'Unable to send OTP. Please try again.');
                return false;
              }
            }}
            onVerifyOtp={async (phone, code, name) => {
              setAuthError('');
              try {
                await verifyPhoneOtp(phone, code, name);
                flash(`Welcome, ${name}!`);
                navigate('home');
              } catch (error) {
                setAuthError(error instanceof Error ? error.message : 'Verification failed. Please try again.');
              }
            }}
          />
        )}
      </main>

      <StoreFooter onNavigate={navigate} />
      {notice && <div className="store-toast"><span className="toast-icon"><Check size={15} /></span>{notice}</div>}
    </div>
  );
}

function getStoreViewFromPath(): StoreView {
  const segment = window.location.pathname.split('/')[1];
  const valid: string[] = ['browse', 'book', 'cart', 'checkout', 'orders', 'account', 'login', 'register'];
  return valid.includes(segment) ? (segment as StoreView) : 'home';
}

function StoreHeader({ cartCount, profile, onNavigate, onSearch, onSignOut, mobileMenuOpen, setMobileMenuOpen }: {
  cartCount: number;
  profile: AuthProfile | null;
  onNavigate: (view: StoreView) => void;
  onSearch: (q: string) => void;
  onSignOut: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) {
  const [searchValue, setSearchValue] = useState('');
  return (
    <>
      <header className="store-header">
        <div className="store-header-inner">
          <button className="store-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu"><Menu size={20} /></button>
          <button className="store-logo" onClick={() => onNavigate('home')}>
            <div className="store-logo-mark"><Library size={20} /></div>
            <span>Khan Creations</span>
          </button>
          <nav className="store-nav">
            <button onClick={() => onNavigate('home')}>Home</button>
            <button onClick={() => onNavigate('browse')}>Browse</button>
            {profile && <button onClick={() => onNavigate('orders')}>My Orders</button>}
            {profile && <button onClick={() => onNavigate('account')}>Account</button>}
          </nav>
          <div className="store-header-actions">
            <form className="store-search" onSubmit={(e) => { e.preventDefault(); onSearch(searchValue); }}>
              <Search size={16} />
              <input placeholder="Search books..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
            </form>
            <button className="store-cart-btn" onClick={() => onNavigate('cart')}>
              <ShoppingCart size={19} />
              {cartCount > 0 && <span className="store-cart-badge">{cartCount}</span>}
            </button>
            {profile ? (
              <div className="store-user-menu">
                <button className="store-user-btn" onClick={() => onNavigate('account')}>
                  <div className="store-avatar">{getInitials(profile.full_name || profile.email)}</div>
                </button>
                <button className="store-signout-btn" onClick={onSignOut} aria-label="Sign out"><LogOut size={16} /></button>
              </div>
            ) : (
              <button className="store-signin-btn" onClick={() => onNavigate('login')}>
                <UserIcon size={16} /> Sign in
              </button>
            )}
          </div>
        </div>
      </header>
      {mobileMenuOpen && (
        <>
          <button className="store-mobile-overlay" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" />
          <div className="store-mobile-menu">
            <button onClick={() => onNavigate('home')}>Home</button>
            <button onClick={() => onNavigate('browse')}>Browse</button>
            {profile && <button onClick={() => onNavigate('orders')}>My Orders</button>}
            {profile && <button onClick={() => onNavigate('account')}>Account</button>}
            {!profile && <button onClick={() => onNavigate('login')}>Sign in</button>}
            {profile && <button onClick={onSignOut}>Sign out</button>}
          </div>
        </>
      )}
    </>
  );
}

function HomeView({ books, bestsellers, categories, profile, onNavigate, onOpenBook, onAddToCart, onCategory }: {
  books: Book[];
  bestsellers: Book[];
  categories: Category[];
  profile: AuthProfile | null;
  onNavigate: (view: StoreView) => void;
  onOpenBook: (book: Book) => void;
  onAddToCart: (book: Book) => void;
  onCategory: (cat: string) => void;
}) {
  const greeting = profile?.full_name ? `Welcome back, ${profile.full_name}` : 'Welcome to Khan Creations';
  return (
    <>
      <section className="store-hero">
        <div className="store-hero-bg" style={{ backgroundImage: `url(${HERO_IMAGE})` }} />
        <div className="store-hero-overlay" />
        <div className="store-hero-content">
          <div className="store-hero-eyebrow">{greeting}</div>
          <h1>Stories worth keeping,<br />delivered to your door.</h1>
          <p>Discover hand-picked books across every genre. From timeless classics to modern bestsellers, find your next favorite read.</p>
          <div className="store-hero-actions">
            <button className="store-btn-primary" onClick={() => onNavigate('browse')}>Browse catalog <ChevronRight size={17} /></button>
            <button className="store-btn-ghost" onClick={() => onCategory('Fiction')}>Explore fiction</button>
          </div>
        </div>
      </section>

      <section className="store-section">
        <div className="store-section-head">
          <div>
            <div className="store-eyebrow">Featured</div>
            <h2>New arrivals</h2>
          </div>
          <button className="store-link-btn" onClick={() => onNavigate('browse')}>View all <ChevronRight size={15} /></button>
        </div>
        <div className="store-book-grid">
          {books.map((book) => <BookCard key={book.id} book={book} onOpen={onOpenBook} onAddToCart={onAddToCart} />)}
        </div>
      </section>

      <section className="store-section">
        <div className="store-section-head">
          <div>
            <div className="store-eyebrow">Browse by</div>
            <h2>Categories</h2>
          </div>
        </div>
        <div className="store-cat-grid">
          {categories.slice(0, 8).map((cat, i) => (
            <button key={cat.id} className={`store-cat-card store-cat-${i % 5}`} onClick={() => onCategory(cat.name)}>
              <BookOpen size={24} />
              <h3>{cat.name}</h3>
              <p>{cat.bookCount} books</p>
            </button>
          ))}
        </div>
      </section>

      <section className="store-section">
        <div className="store-section-head">
          <div>
            <div className="store-eyebrow">Reader favorites</div>
            <h2>Bestsellers</h2>
          </div>
          <button className="store-link-btn" onClick={() => onNavigate('browse')}>View all <ChevronRight size={15} /></button>
        </div>
        <div className="store-book-grid">
          {bestsellers.map((book) => <BookCard key={book.id} book={book} onOpen={onOpenBook} onAddToCart={onAddToCart} />)}
        </div>
      </section>

      <section className="store-features">
        <div className="store-feature"><Truck size={28} /><h3>Free shipping</h3><p>On all orders over $50</p></div>
        <div className="store-feature"><Package size={28} /><h3>Easy returns</h3><p>30-day return policy</p></div>
        <div className="store-feature"><CreditCard size={28} /><h3>Secure checkout</h3><p>Cash on delivery available</p></div>
        <div className="store-feature"><BookOpen size={28} /><h3>Curated selection</h3><p>Hand-picked by readers</p></div>
      </section>
    </>
  );
}

function BrowseView({ books, categories, activeCategory, setActiveCategory, searchQuery, setSearchQuery, onOpenBook, onAddToCart }: {
  books: Book[];
  categories: Category[];
  activeCategory: string | null;
  setActiveCategory: (cat: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenBook: (book: Book) => void;
  onAddToCart: (book: Book) => void;
}) {
  return (
    <div className="store-browse">
      <div className="store-page-head">
        <div className="store-eyebrow">Catalog</div>
        <h1>Browse books</h1>
        <p>Explore our full collection of {books.length} titles</p>
      </div>
      <div className="store-browse-layout">
        <aside className="store-filters">
          <div className="store-filter-group">
            <h3>Categories</h3>
            <button className={`store-filter-chip ${!activeCategory ? 'active' : ''}`} onClick={() => setActiveCategory(null)}>All books</button>
            {categories.map((cat) => (
              <button key={cat.id} className={`store-filter-chip ${activeCategory === cat.name ? 'active' : ''}`} onClick={() => setActiveCategory(cat.name)}>
                {cat.name} <span>{cat.bookCount}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="store-browse-main">
          <div className="store-browse-toolbar">
            <div className="store-search-inline">
              <Search size={16} />
              <input placeholder="Search by title, author, or category..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <span className="store-result-count">{books.length} results</span>
          </div>
          {books.length > 0 ? (
            <div className="store-book-grid">
              {books.map((book) => <BookCard key={book.id} book={book} onOpen={onOpenBook} onAddToCart={onAddToCart} />)}
            </div>
          ) : (
            <div className="store-empty">
              <BookOpen size={32} />
              <h3>No books found</h3>
              <p>Try a different search or category filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookCard({ book, onOpen, onAddToCart }: { book: Book; onOpen: (book: Book) => void; onAddToCart: (book: Book) => void }) {
  return (
    <div className="store-book-card">
      <button className="store-book-cover" onClick={() => onOpen(book)}>
        {book.image_url ? <img src={book.image_url} alt={book.title} /> : <span>{book.title.slice(0, 1)}</span>}
        {book.stock === 0 && <div className="store-out-of-stock">Out of stock</div>}
      </button>
      <div className="store-book-info">
        <span className="store-book-cat">{book.category}</span>
        <button className="store-book-title" onClick={() => onOpen(book)}>{book.title}</button>
        <span className="store-book-author">{book.author}</span>
        <div className="store-book-rating"><Star size={13} /> {book.rating} <span>({book.review_count})</span></div>
        <div className="store-book-bottom">
          <span className="store-book-price">{money(book.price)}</span>
          <button className="store-add-btn" onClick={() => onAddToCart(book)} disabled={book.stock === 0}>
            <Plus size={15} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function BookDetailView({ book, books, onAddToCart, onNavigate, onOpenBook }: {
  book: Book;
  books: Book[];
  onAddToCart: (book: Book) => void;
  onNavigate: (view: StoreView) => void;
  onOpenBook: (book: Book) => void;
}) {
  const related = books.filter((b) => b.category === book.category && b.id !== book.id).slice(0, 4);
  return (
    <div className="store-book-detail">
      <button className="store-back-btn" onClick={() => onNavigate('browse')}><ChevronRight size={15} className="rotate-180" /> Back to browse</button>
      <div className="store-detail-grid">
        <div className="store-detail-cover">
          {book.image_url ? <img src={book.image_url} alt={book.title} /> : <div className="store-detail-cover-placeholder"><span>{book.title.slice(0, 1)}</span></div>}
        </div>
        <div className="store-detail-info">
          <span className="store-book-cat">{book.category}</span>
          <h1>{book.title}</h1>
          <p className="store-detail-author">by {book.author}</p>
          <div className="store-detail-rating"><Star size={16} /> <strong>{book.rating}</strong> <span>({book.review_count} reviews)</span></div>
          <div className="store-detail-price">{money(book.price)}</div>
          <p className="store-detail-desc">{book.description || 'A wonderful addition to any reader\'s collection.'}</p>
          <div className="store-detail-meta">
            {book.publisher && <div><span>Publisher</span><strong>{book.publisher}</strong></div>}
            {book.isbn && <div><span>ISBN</span><strong>{book.isbn}</strong></div>}
            <div><span>Availability</span><strong className={book.stock > 0 ? 'in-stock' : 'out-stock'}>{book.stock > 0 ? `${book.stock} in stock` : 'Out of stock'}</strong></div>
          </div>
          <button className="store-btn-primary store-detail-add" onClick={() => onAddToCart(book)} disabled={book.stock === 0}>
            <ShoppingCart size={18} /> {book.stock > 0 ? 'Add to cart' : 'Out of stock'}
          </button>
        </div>
      </div>
      {related.length > 0 && (
        <section className="store-section">
          <div className="store-section-head">
            <div><div className="store-eyebrow">More like this</div><h2>Related books</h2></div>
          </div>
          <div className="store-book-grid">
            {related.map((b) => <BookCard key={b.id} book={b} onOpen={onOpenBook} onAddToCart={onAddToCart} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyBookView({ onNavigate }: { onNavigate: (view: StoreView) => void }) {
  return (
    <div className="store-empty">
      <BookOpen size={32} />
      <h3>Book not found</h3>
      <p>Browse our catalog to find what you're looking for.</p>
      <button className="store-btn-primary" onClick={() => onNavigate('browse')}>Browse books</button>
    </div>
  );
}

function CartView({ cart, total, onUpdateQty, onRemove, onNavigate, onCheckout }: {
  cart: CartItem[];
  total: number;
  onUpdateQty: (bookId: string, delta: number) => void;
  onRemove: (bookId: string) => void;
  onNavigate: (view: StoreView) => void;
  onCheckout: () => void;
}) {
  if (cart.length === 0) {
    return (
      <div className="store-empty store-cart-empty">
        <ShoppingCart size={36} />
        <h3>Your cart is empty</h3>
        <p>Browse our catalog and add some books to your cart.</p>
        <button className="store-btn-primary" onClick={() => onNavigate('browse')}>Browse books</button>
      </div>
    );
  }
  return (
    <div className="store-cart">
      <div className="store-page-head">
        <div className="store-eyebrow">Shopping</div>
        <h1>Your cart</h1>
        <p>{cart.length} {cart.length === 1 ? 'item' : 'items'} in your cart</p>
      </div>
      <div className="store-cart-layout">
        <div className="store-cart-items">
          {cart.map((item) => (
            <div className="store-cart-row" key={item.book.id}>
              <div className="store-cart-cover">{item.book.image_url ? <img src={item.book.image_url} alt={item.book.title} /> : <span>{item.book.title.slice(0, 1)}</span>}</div>
              <div className="store-cart-info">
                <h3>{item.book.title}</h3>
                <span>{item.book.author}</span>
                <span className="store-cart-price">{money(item.book.price)}</span>
              </div>
              <div className="store-cart-qty">
                <button onClick={() => onUpdateQty(item.book.id, -1)}><Minus size={14} /></button>
                <span>{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.book.id, 1)}><Plus size={14} /></button>
              </div>
              <span className="store-cart-line-total">{money(item.book.price * item.quantity)}</span>
              <button className="store-cart-remove" onClick={() => onRemove(item.book.id)} aria-label="Remove"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <aside className="store-cart-summary">
          <h3>Order summary</h3>
          <div className="store-summary-row"><span>Subtotal</span><strong>{money(total)}</strong></div>
          <div className="store-summary-row"><span>Shipping</span><strong>{total >= 50 ? 'Free' : money(5)}</strong></div>
          <div className="store-summary-divider" />
          <div className="store-summary-row store-summary-total"><span>Total</span><strong>{money(total + (total >= 50 ? 0 : 5))}</strong></div>
          <button className="store-btn-primary store-checkout-btn" onClick={onCheckout}>Proceed to checkout <ChevronRight size={16} /></button>
          <button className="store-link-btn" onClick={() => onNavigate('browse')}>Continue shopping</button>
        </aside>
      </div>
    </div>
  );
}

function CheckoutView({ cart, total, profile, session, onNavigate, onPlaceOrder }: {
  cart: CartItem[];
  total: number;
  profile: AuthProfile | null;
  session: { user: { id: string } } | null;
  onNavigate: (view: StoreView) => void;
  onPlaceOrder: (shipping: { name: string; phone: string; address: string; city: string; state: string; postalCode: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: profile?.full_name || '', phone: '', address: '', city: '', state: '', postalCode: '' });
  const [submitting, setSubmitting] = useState(false);

  if (!session) {
    return (
      <div className="store-empty">
        <UserIcon size={32} />
        <h3>Please sign in to checkout</h3>
        <button className="store-btn-primary" onClick={() => onNavigate('login')}>Sign in</button>
      </div>
    );
  }
  if (cart.length === 0) {
    return (
      <div className="store-empty">
        <ShoppingCart size={36} />
        <h3>Your cart is empty</h3>
        <button className="store-btn-primary" onClick={() => onNavigate('browse')}>Browse books</button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onPlaceOrder(form);
    setSubmitting(false);
  }

  const shippingCost = total >= 50 ? 0 : 5;

  return (
    <div className="store-checkout">
      <div className="store-page-head">
        <div className="store-eyebrow">Almost there</div>
        <h1>Checkout</h1>
        <p>Enter your shipping details to complete your order</p>
      </div>
      <div className="store-checkout-layout">
        <form className="store-checkout-form" onSubmit={submit}>
          <h3>Shipping information</h3>
          <div className="store-form-grid">
            <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></label>
            <label>Phone<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></label>
          </div>
          <label>Address<input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" /></label>
          <div className="store-form-grid">
            <label>City<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" /></label>
            <label>State<input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" /></label>
            <label>Postal code<input required value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="ZIP code" /></label>
          </div>
          <div className="store-payment-method">
            <h3>Payment method</h3>
            <div className="store-payment-option">
              <input type="radio" id="cod" checked readOnly />
              <label htmlFor="cod"><Truck size={18} /> Cash on Delivery</label>
            </div>
          </div>
          <button className="store-btn-primary store-place-order-btn" type="submit" disabled={submitting}>
            {submitting ? <><span className="button-spinner" /> Placing order...</> : <>Place order — {money(total + shippingCost)}</>}
          </button>
        </form>
        <aside className="store-checkout-summary">
          <h3>Order summary</h3>
          {cart.map((item) => (
            <div className="store-checkout-item" key={item.book.id}>
              <span>{item.book.title} x{item.quantity}</span>
              <strong>{money(item.book.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="store-summary-divider" />
          <div className="store-summary-row"><span>Subtotal</span><strong>{money(total)}</strong></div>
          <div className="store-summary-row"><span>Shipping</span><strong>{shippingCost === 0 ? 'Free' : money(shippingCost)}</strong></div>
          <div className="store-summary-row store-summary-total"><span>Total</span><strong>{money(total + shippingCost)}</strong></div>
        </aside>
      </div>
    </div>
  );
}

function OrdersView({ session, onNavigate }: { session: { user: { id: string } } | null; onNavigate: (view: StoreView) => void }) {
  const [orders, setOrders] = useState<Array<{ id: string; created_at: string; total_amount: number; order_status: string; payment_status: string; shipping_name: string; shipping_city: string }>>([]);
  const [items, setItems] = useState<Record<string, Array<{ book_id: string; quantity: number; price: number }>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase || !session?.user) { setLoading(false); return; }
      const { data: orderRows } = await supabase.from('orders').select('id,created_at,total_amount,order_status,payment_status,shipping_name,shipping_city').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (!active || !orderRows) { setLoading(false); return; }
      setOrders(orderRows);
      const itemMap: Record<string, Array<{ book_id: string; quantity: number; price: number }>> = {};
      for (const order of orderRows) {
        const { data: orderItems } = await supabase.from('order_items').select('book_id,quantity,price').eq('order_id', order.id);
        if (orderItems) itemMap[order.id] = orderItems;
      }
      if (active) { setItems(itemMap); setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [session]);

  if (!session) {
    return (
      <div className="store-empty">
        <Package size={32} />
        <h3>Sign in to view orders</h3>
        <button className="store-btn-primary" onClick={() => onNavigate('login')}>Sign in</button>
      </div>
    );
  }
  if (loading) return <div className="store-loading-inline"><div className="loading-spinner" /></div>;
  if (orders.length === 0) {
    return (
      <div className="store-empty">
        <Package size={32} />
        <h3>No orders yet</h3>
        <p>When you place an order, it will appear here.</p>
        <button className="store-btn-primary" onClick={() => onNavigate('browse')}>Browse books</button>
      </div>
    );
  }
  return (
    <div className="store-orders">
      <div className="store-page-head">
        <div className="store-eyebrow">History</div>
        <h1>My orders</h1>
        <p>Track your purchases and delivery status</p>
      </div>
      <div className="store-orders-list">
        {orders.map((order) => (
          <div className="store-order-card" key={order.id}>
            <div className="store-order-header">
              <div>
                <span className="store-order-id">#{order.id.slice(0, 8).toUpperCase()}</span>
                <span className="store-order-date">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="store-order-statuses">
                <span className={`store-order-status store-status-${order.order_status.toLowerCase()}`}>{order.order_status}</span>
                <span className={`store-order-payment store-payment-${order.payment_status.toLowerCase()}`}>{order.payment_status}</span>
              </div>
            </div>
            <div className="store-order-items">
              {(items[order.id] || []).map((item, i) => (
                <div key={i} className="store-order-item-row">
                  <span>{item.quantity}x item</span>
                  <span>{money(item.price)}</span>
                </div>
              ))}
            </div>
            <div className="store-order-footer">
              <span>Shipping to: {order.shipping_name}, {order.shipping_city}</span>
              <strong>{money(order.total_amount)}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountView({ profile, session, onNavigate, onSignOut }: {
  profile: AuthProfile | null;
  session: { user: { email?: string } } | null;
  onNavigate: (view: StoreView) => void;
  onSignOut: () => void;
}) {
  if (!session || !profile) {
    return (
      <div className="store-empty">
        <UserIcon size={32} />
        <h3>Sign in to view your account</h3>
        <button className="store-btn-primary" onClick={() => onNavigate('login')}>Sign in</button>
      </div>
    );
  }
  return (
    <div className="store-account">
      <div className="store-page-head">
        <div className="store-eyebrow">Profile</div>
        <h1>Hello, {profile.full_name || 'Reader'}</h1>
      </div>
      <div className="store-account-grid">
        <div className="store-account-card">
          <div className="store-account-avatar">{getInitials(profile.full_name || profile.email)}</div>
          <h2>{profile.full_name || 'Reader'}</h2>
          <span className="store-account-email">{profile.email}</span>
          <span className="store-account-role">{profile.role}</span>
        </div>
        <div className="store-account-actions">
          <button className="store-account-btn" onClick={() => onNavigate('orders')}><Package size={20} /> <span>My orders</span> <ChevronRight size={16} /></button>
          <button className="store-account-btn" onClick={() => onNavigate('browse')}><BookOpen size={20} /> <span>Browse books</span> <ChevronRight size={16} /></button>
          <button className="store-account-btn store-signout-action" onClick={onSignOut}><LogOut size={20} /> <span>Sign out</span> </button>
        </div>
      </div>
    </div>
  );
}

function AuthView({ error, onNavigate, onSendOtp, onVerifyOtp }: {
  error: string;
  onNavigate: (view: StoreView) => void;
  onSendOtp: (name: string, phone: string) => Promise<boolean>;
  onVerifyOtp: (phone: string, code: string, name: string) => Promise<void>;
}) {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentPhone, setSentPhone] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);

  const fullPhone = `+91${phone.replace(/\D/g, '')}`;
  const phoneValid = /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));

  useEffect(() => {
    if (step !== 'otp' || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [step, secondsLeft]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const timer = window.setTimeout(() => setResendLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendLeft]);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phoneValid) return;
    setSubmitting(true);
    const success = await onSendOtp(name, fullPhone);
    setSubmitting(false);
    if (success) {
      setSentPhone(fullPhone);
      setStep('otp');
      setSecondsLeft(300);
      setResendLeft(60);
    }
  }

  async function resendOtp() {
    if (resendLeft > 0 || submitting) return;
    setSubmitting(true);
    const success = await onSendOtp(name, fullPhone);
    setSubmitting(false);
    if (success) {
      setSecondsLeft(300);
      setResendLeft(60);
      setCode('');
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setSubmitting(true);
    await onVerifyOtp(sentPhone, code, name);
    setSubmitting(false);
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="store-auth">
      <div className="store-auth-card">
        <div className="store-auth-logo"><Library size={24} /></div>
        {step === 'details' ? (
          <>
            <div className="store-eyebrow">Welcome</div>
            <h1>Sign in to Khan Creations</h1>
            <p>Enter your name and Indian mobile number. We'll send you a verification code via SMS.</p>
            <form className="store-auth-form" onSubmit={sendOtp}>
              <label><span>Full name</span><div className="store-input-icon"><UserIcon size={16} /><input required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} /></div></label>
              <label>
                <span>Mobile number</span>
                <div className="store-phone-row">
                  <div className="store-country-select store-country-fixed">
                    <span className="store-country-flag">IN</span>
                    <span className="store-country-dial">+91</span>
                  </div>
                  <div className="store-input-icon store-phone-input"><Phone size={16} /><input type="tel" required placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} inputMode="numeric" /></div>
                </div>
              </label>
              {phone && !phoneValid && <div className="store-auth-error">Please enter a valid Indian mobile number.</div>}
              {error && <div className="store-auth-error">{error}</div>}
              <button className="store-btn-primary store-auth-submit" type="submit" disabled={submitting || !phoneValid}>
                {submitting ? <><span className="button-spinner" /> Sending OTP...</> : 'Send OTP'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="store-eyebrow">Verify</div>
            <h1>Enter your code</h1>
            <p>We sent a verification code to {sentPhone} via SMS. Enter it below to complete sign in.</p>
            {secondsLeft > 0 && <div className="store-otp-timer">OTP expires in {formatTime(secondsLeft)}</div>}
            <form className="store-auth-form" onSubmit={verify}>
              <label><span>Verification code</span><div className="store-input-icon"><KeyRound size={16} /><input required inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} /></div></label>
              {error && <div className="store-auth-error">{error}</div>}
              <button className="store-btn-primary store-auth-submit" type="submit" disabled={submitting}>
                {submitting ? <><span className="button-spinner" /> Verifying...</> : 'Verify OTP'}
              </button>
            </form>
            <button className="store-link-btn" onClick={resendOtp} disabled={resendLeft > 0 || submitting}>
              {resendLeft > 0 ? `Resend OTP in ${resendLeft}s` : 'Resend OTP'}
            </button>
            <button className="store-link-btn" onClick={() => setStep('details')}><ChevronRight size={15} className="rotate-180" /> Change phone number</button>
          </>
        )}
        <button className="store-link-btn store-auth-back" onClick={() => onNavigate('home')}>Back to store</button>
      </div>
    </div>
  );
}

function StoreFooter({ onNavigate }: { onNavigate: (view: StoreView) => void }) {
  return (
    <footer className="store-footer">
      <div className="store-footer-inner">
        <div className="store-footer-brand">
          <div className="store-logo-mark"><Library size={18} /></div>
          <strong>Khan Creations</strong>
          <p>Your reading, beautifully managed.</p>
        </div>
        <div className="store-footer-links">
          <div>
            <h4>Shop</h4>
            <button onClick={() => onNavigate('browse')}>Browse all</button>
            <button onClick={() => onNavigate('home')}>Home</button>
          </div>
          <div>
            <h4>Account</h4>
            <button onClick={() => onNavigate('login')}>Sign in</button>
            <button onClick={() => onNavigate('orders')}>My orders</button>
          </div>
        </div>
      </div>
      <div className="store-footer-bottom">© 2026 Khan Creations. All rights reserved.</div>
    </footer>
  );
}

function StoreLoading() {
  return (
    <div className="store-loading">
      <div className="store-logo-mark"><Library size={24} /></div>
      <div className="loading-spinner" />
      <p>Loading Khan Creations...</p>
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
