export type AdminView = 'dashboard' | 'books' | 'categories' | 'orders' | 'users' | 'inventory' | 'sales';

export type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  category_id?: string;
  price: number;
  stock: number;
  rating: number;
  review_count: number;
  image_url?: string | null;
  publisher?: string;
  isbn?: string;
  description?: string;
  published_date?: string;
};

export type Category = { id: string; name: string; description: string; bookCount: number };
export type Order = { id: string; customer: string; date: string; items: number; amount: number; payment: string; status: string };
export type User = { id: string; name: string; email: string; role: string; joined: string; status: string };
