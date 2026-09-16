/*
# Create bookstore admin foundation

1. New Tables
- `profiles`: signed-in user records with names, contact fields, and an immutable authorization role.
- `categories`: public book categories managed by administrators.
- `books`: public catalog records with pricing, stock, ratings, and publishing metadata.
- `orders`: customer purchases with shipping, payment, and fulfillment status.
- `order_items`: immutable purchase line items with the price captured at checkout.
- `cart`: one active cart per customer.
- `cart_items`: books and quantities in a customer's active cart.

2. Security
- Row Level Security is enabled on every table.
- Catalog reads are public for the customer storefront.
- Catalog writes, inventory changes, category management, order management, and user listing are restricted to administrators.
- Customer records, carts, and orders are scoped to the signed-in customer.
- `is_admin()` is a security-definer helper with a fixed search path and is not exposed to browser roles.

3. Important Notes
- No passwords are stored in application tables; authentication remains in Supabase Auth.
- Role values are constrained to `customer` and `admin`.
- Order and payment statuses use constrained values so admin updates remain predictable.
- Starter catalog rows are inserted only when they do not already exist.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  image_url text,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  rating numeric(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  isbn text,
  publisher text,
  published_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount >= 0),
  shipping_name text NOT NULL,
  shipping_phone text NOT NULL,
  shipping_address text NOT NULL,
  shipping_city text NOT NULL,
  shipping_state text NOT NULL,
  shipping_postal_code text NOT NULL,
  payment_method text NOT NULL DEFAULT 'Cash on Delivery',
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
  order_status text NOT NULL DEFAULT 'Pending' CHECK (order_status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.cart(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, book_id)
);

CREATE INDEX IF NOT EXISTS books_category_id_idx ON public.books(category_id);
CREATE INDEX IF NOT EXISTS books_created_at_idx ON public.books(created_at DESC);
CREATE INDEX IF NOT EXISTS books_stock_idx ON public.books(stock);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can create categories" ON public.categories;
CREATE POLICY "Admins can create categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view books" ON public.books;
CREATE POLICY "Public can view books" ON public.books FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can create books" ON public.books;
CREATE POLICY "Admins can create books" ON public.books FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can update books" ON public.books;
CREATE POLICY "Admins can update books" ON public.books FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete books" ON public.books;
CREATE POLICY "Admins can delete books" ON public.books FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin()) WITH CHECK ((auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())) OR public.is_admin());
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin() AND id <> auth.uid());

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
CREATE POLICY "Users can create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS "Users can create own order items" ON public.order_items;
CREATE POLICY "Users can create own order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Admins can delete order items" ON public.order_items FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own cart" ON public.cart;
CREATE POLICY "Users can view own cart" ON public.cart FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own cart" ON public.cart;
CREATE POLICY "Users can create own cart" ON public.cart FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own cart" ON public.cart;
CREATE POLICY "Users can update own cart" ON public.cart FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own cart" ON public.cart;
CREATE POLICY "Users can delete own cart" ON public.cart FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_items;
CREATE POLICY "Users can view own cart items" ON public.cart_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create own cart items" ON public.cart_items;
CREATE POLICY "Users can create own cart items" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own cart items" ON public.cart_items;
CREATE POLICY "Users can update own cart items" ON public.cart_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own cart items" ON public.cart_items;
CREATE POLICY "Users can delete own cart items" ON public.cart_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.cart WHERE cart.id = cart_items.cart_id AND cart.user_id = auth.uid()));

INSERT INTO public.categories (name, description) VALUES
  ('Fiction', 'Stories that transport you to unforgettable worlds.'),
  ('Technology', 'Practical thinking for the digital age.'),
  ('Business', 'Ideas for building better companies and careers.'),
  ('Self Development', 'Small shifts that create meaningful progress.'),
  ('Science', 'Clear explanations for a curious mind.'),
  ('Biography', 'Remarkable lives and the lessons they leave behind.'),
  ('History', 'The people and moments that shaped our world.'),
  ('Education', 'Tools for learning with confidence and depth.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.books (title, author, description, price, category_id, stock, rating, review_count, isbn, publisher, published_date)
SELECT seed.title, seed.author, seed.description, seed.price, categories.id, seed.stock, seed.rating, seed.review_count, seed.isbn, seed.publisher, seed.published_date::date
FROM (VALUES
  ('Clean Code', 'Robert C. Martin', 'A practical guide to writing software that stays clear, adaptable, and enjoyable to maintain.', 32.00, 'Technology', 18, 4.8, 1240, '9780132350884', 'Prentice Hall', '2008-08-01'),
  ('The Pragmatic Programmer', 'David Thomas', 'Timeless habits for becoming a more thoughtful and effective software developer.', 35.00, 'Technology', 12, 4.9, 987, '9780135957059', 'Addison-Wesley', '2019-09-13'),
  ('Atomic Habits', 'James Clear', 'A practical framework for improving every day through small, consistent changes.', 24.00, 'Self Development', 26, 4.7, 2100, '9780735211292', 'Avery', '2018-10-16'),
  ('Deep Work', 'Cal Newport', 'Rules for focused success in a distracted world.', 22.00, 'Self Development', 9, 4.6, 764, '9781455586691', 'Grand Central', '2016-01-05'),
  ('The Psychology of Money', 'Morgan Housel', 'Timeless lessons on wealth, behavior, and making better financial decisions.', 21.00, 'Business', 31, 4.8, 1450, '9780857197689', 'Harriman House', '2020-09-08'),
  ('Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'A perspective-shifting introduction to money, work, and long-term thinking.', 18.00, 'Business', 7, 4.5, 890, '9781612680194', 'Plata Publishing', '1997-04-01'),
  ('Introduction to Algorithms', 'Thomas H. Cormen', 'A comprehensive reference for understanding the algorithms behind modern computing.', 58.00, 'Education', 4, 4.7, 420, '9780262046305', 'MIT Press', '2022-07-15'),
  ('Python Crash Course', 'Eric Matthes', 'A hands-on introduction to programming with projects that build real confidence.', 29.00, 'Technology', 16, 4.8, 680, '9781593279288', 'No Starch Press', '2019-05-03'),
  ('Artificial Intelligence', 'Melanie Mitchell', 'A thoughtful guide to what intelligent machines can do and where their limits remain.', 27.00, 'Science', 11, 4.4, 310, '9780374257835', 'Farrar Straus Giroux', '2019-03-05'),
  ('The Alchemist', 'Paulo Coelho', 'A luminous story about purpose, courage, and listening to the journey.', 16.00, 'Fiction', 23, 4.6, 1780, '9780062315007', 'HarperOne', '2014-04-15'),
  ('Sapiens', 'Yuval Noah Harari', 'A sweeping exploration of how shared stories shaped the human world.', 26.00, 'History', 14, 4.7, 1320, '9780062316097', 'Harper', '2015-02-10'),
  ('Educated', 'Tara Westover', 'A memoir about learning, identity, and the freedom of a wider world.', 19.00, 'Biography', 8, 4.8, 1160, '9780399590504', 'Random House', '2018-02-20')
) AS seed(title, author, description, price, category_name, stock, rating, review_count, isbn, publisher, published_date)
JOIN public.categories ON categories.name = seed.category_name
WHERE NOT EXISTS (SELECT 1 FROM public.books WHERE books.isbn = seed.isbn);
