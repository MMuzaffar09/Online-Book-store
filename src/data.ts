import type { Book, Category, Order, User } from './types';

export const sampleBooks: Book[] = [
  { id: '1', title: 'Clean Code', author: 'Robert C. Martin', category: 'Technology', price: 32, stock: 18, rating: 4.8, review_count: 1240, publisher: 'Prentice Hall', isbn: '9780132350884' },
  { id: '2', title: 'The Pragmatic Programmer', author: 'David Thomas', category: 'Technology', price: 35, stock: 12, rating: 4.9, review_count: 987, publisher: 'Addison-Wesley', isbn: '9780135957059' },
  { id: '3', title: 'Atomic Habits', author: 'James Clear', category: 'Self Development', price: 24, stock: 26, rating: 4.7, review_count: 2100, publisher: 'Avery', isbn: '9780735211292' },
  { id: '4', title: 'Deep Work', author: 'Cal Newport', category: 'Self Development', price: 22, stock: 9, rating: 4.6, review_count: 764, publisher: 'Grand Central', isbn: '9781455586691' },
  { id: '5', title: 'The Psychology of Money', author: 'Morgan Housel', category: 'Business', price: 21, stock: 31, rating: 4.8, review_count: 1450, publisher: 'Harriman House', isbn: '9780857197689' },
  { id: '6', title: 'Rich Dad Poor Dad', author: 'Robert T. Kiyosaki', category: 'Business', price: 18, stock: 7, rating: 4.5, review_count: 890, publisher: 'Plata Publishing', isbn: '9781612680194' },
  { id: '7', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', category: 'Education', price: 58, stock: 4, rating: 4.7, review_count: 420, publisher: 'MIT Press', isbn: '9780262046305' },
  { id: '8', title: 'Python Crash Course', author: 'Eric Matthes', category: 'Technology', price: 29, stock: 16, rating: 4.8, review_count: 680, publisher: 'No Starch Press', isbn: '9781593279288' },
  { id: '9', title: 'Artificial Intelligence', author: 'Melanie Mitchell', category: 'Science', price: 27, stock: 11, rating: 4.4, review_count: 310, publisher: 'Farrar Straus Giroux', isbn: '9780374257835' },
  { id: '10', title: 'The Alchemist', author: 'Paulo Coelho', category: 'Fiction', price: 16, stock: 23, rating: 4.6, review_count: 1780, publisher: 'HarperOne', isbn: '9780062315007' },
];

export const sampleCategories: Category[] = [
  { id: '1', name: 'Fiction', description: 'Stories that transport you to unforgettable worlds.', bookCount: 8 },
  { id: '2', name: 'Technology', description: 'Practical thinking for the digital age.', bookCount: 24 },
  { id: '3', name: 'Business', description: 'Ideas for building better companies and careers.', bookCount: 16 },
  { id: '4', name: 'Self Development', description: 'Small shifts that create meaningful progress.', bookCount: 12 },
  { id: '5', name: 'Science', description: 'Clear explanations for a curious mind.', bookCount: 9 },
  { id: '6', name: 'Biography', description: 'Remarkable lives and the lessons they leave behind.', bookCount: 7 },
  { id: '7', name: 'History', description: 'The people and moments that shaped our world.', bookCount: 11 },
  { id: '8', name: 'Education', description: 'Tools for learning with confidence and depth.', bookCount: 14 },
];

export const sampleOrders: Order[] = [
  { id: 'BK-10042', customer: 'Maya Rodriguez', date: 'Aug 24, 2026', items: 3, amount: 81, payment: 'Paid', status: 'Processing' },
  { id: 'BK-10041', customer: 'Oliver Chen', date: 'Aug 23, 2026', items: 1, amount: 24, payment: 'Paid', status: 'Shipped' },
  { id: 'BK-10040', customer: 'Sophia Williams', date: 'Aug 22, 2026', items: 2, amount: 57, payment: 'Pending', status: 'Pending' },
  { id: 'BK-10039', customer: 'Ethan Brooks', date: 'Aug 21, 2026', items: 4, amount: 118, payment: 'Paid', status: 'Delivered' },
  { id: 'BK-10038', customer: 'Ava Patel', date: 'Aug 20, 2026', items: 2, amount: 48, payment: 'Paid', status: 'Confirmed' },
  { id: 'BK-10037', customer: 'Liam Wilson', date: 'Aug 19, 2026', items: 1, amount: 35, payment: 'Failed', status: 'Cancelled' },
];

export const sampleUsers: User[] = [
  { id: '1', name: 'Muzaffar Khan', email: 'admin@muzaffar.com', role: 'Admin', joined: 'Jan 12, 2026', status: 'Active' },
  { id: '2', name: 'Maya Rodriguez', email: 'maya.rodriguez@example.com', role: 'Customer', joined: 'Aug 04, 2026', status: 'Active' },
  { id: '3', name: 'Oliver Chen', email: 'oliver.chen@example.com', role: 'Customer', joined: 'Jul 28, 2026', status: 'Active' },
  { id: '4', name: 'Sophia Williams', email: 'sophia.williams@example.com', role: 'Customer', joined: 'Jul 16, 2026', status: 'Active' },
  { id: '5', name: 'Ethan Brooks', email: 'ethan.brooks@example.com', role: 'Customer', joined: 'Jun 22, 2026', status: 'Active' },
];
