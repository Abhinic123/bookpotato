import { 
  users, societies, books, bookRentals, societyMembers, notifications,
  type User, type InsertUser, type Society, type InsertSociety, 
  type Book, type InsertBook, type BookRental, type InsertBookRental,
  type SocietyMember, type InsertSocietyMember, type Notification, type InsertNotification,
  type BookWithOwner, type RentalWithDetails, type SocietyWithStats
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Societies
  getSociety(id: number): Promise<Society | undefined>;
  getSocietyByCode(code: string): Promise<Society | undefined>;
  getSocietiesByUser(userId: number): Promise<SocietyWithStats[]>;
  getAvailableSocieties(userId: number): Promise<SocietyWithStats[]>;
  createSociety(society: InsertSociety): Promise<Society>;
  joinSociety(societyId: number, userId: number): Promise<SocietyMember>;
  isMemberOfSociety(societyId: number, userId: number): Promise<boolean>;
  
  // Books
  getBook(id: number): Promise<BookWithOwner | undefined>;
  getBooksBySociety(societyId: number): Promise<BookWithOwner[]>;
  getBooksByOwner(ownerId: number): Promise<Book[]>;
  searchBooks(societyId: number, query?: string, genre?: string): Promise<BookWithOwner[]>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, updates: Partial<Book>): Promise<Book | undefined>;
  
  // Rentals
  getRental(id: number): Promise<RentalWithDetails | undefined>;
  getRentalsByBorrower(borrowerId: number): Promise<RentalWithDetails[]>;
  getRentalsByLender(lenderId: number): Promise<RentalWithDetails[]>;
  getActiveRentals(userId: number): Promise<RentalWithDetails[]>;
  createRental(rental: InsertBookRental): Promise<BookRental>;
  updateRental(id: number, updates: Partial<BookRental>): Promise<BookRental | undefined>;
  
  // Notifications
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<boolean>;
  
  // Statistics
  getSocietyStats(societyId: number): Promise<{ memberCount: number; bookCount: number; activeRentals: number }>;
  getUserStats(userId: number): Promise<{ borrowedBooks: number; lentBooks: number; totalEarnings: number }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private societies: Map<number, Society> = new Map();
  private books: Map<number, Book> = new Map();
  private bookRentals: Map<number, BookRental> = new Map();
  private societyMembers: Map<number, SocietyMember> = new Map();
  private notifications: Map<number, Notification> = new Map();
  
  private currentUserId = 1;
  private currentSocietyId = 1;
  private currentBookId = 1;
  private currentRentalId = 1;
  private currentMemberId = 1;
  private currentNotificationId = 1;

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Seed a test user
    const testUser: User = {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      password: "password123",
      createdAt: new Date(),
    };
    this.users.set(1, testUser);
    this.currentUserId = 2;

    // Seed a test society
    const testSociety: Society = {
      id: 1,
      name: "Greenwood Apartments",
      description: "A community of book lovers",
      code: "GWA2024",
      createdBy: 1,
      memberCount: 1,
      bookCount: 0,
      createdAt: new Date(),
    };
    this.societies.set(1, testSociety);
    this.currentSocietyId = 2;

    // Add test user as member of test society
    const testMember: SocietyMember = {
      id: 1,
      societyId: 1,
      userId: 1,
      isActive: true,
      joinedAt: new Date(),
    };
    this.societyMembers.set(1, testMember);
    this.currentMemberId = 2;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Societies
  async getSociety(id: number): Promise<Society | undefined> {
    return this.societies.get(id);
  }

  async getSocietyByCode(code: string): Promise<Society | undefined> {
    return Array.from(this.societies.values()).find(society => society.code === code);
  }

  async getSocietiesByUser(userId: number): Promise<SocietyWithStats[]> {
    const userMemberships = Array.from(this.societyMembers.values())
      .filter(member => member.userId === userId && member.isActive);
    
    return Promise.all(userMemberships.map(async (membership) => {
      const society = this.societies.get(membership.societyId);
      if (!society) throw new Error("Society not found");
      return { ...society, isJoined: true };
    }));
  }

  async getAvailableSocieties(userId: number): Promise<SocietyWithStats[]> {
    const userSocietyIds = Array.from(this.societyMembers.values())
      .filter(member => member.userId === userId && member.isActive)
      .map(member => member.societyId);

    return Array.from(this.societies.values())
      .filter(society => !userSocietyIds.includes(society.id))
      .map(society => ({ ...society, isJoined: false }));
  }

  async createSociety(insertSociety: InsertSociety): Promise<Society> {
    const id = this.currentSocietyId++;
    const code = `${insertSociety.name.substring(0, 3).toUpperCase()}${Date.now().toString().slice(-4)}`;
    const society: Society = {
      ...insertSociety,
      id,
      code,
      memberCount: 1,
      bookCount: 0,
      createdAt: new Date(),
    };
    this.societies.set(id, society);

    // Add creator as member
    await this.joinSociety(id, insertSociety.createdBy);
    
    return society;
  }

  async joinSociety(societyId: number, userId: number): Promise<SocietyMember> {
    const id = this.currentMemberId++;
    const member: SocietyMember = {
      id,
      societyId,
      userId,
      isActive: true,
      joinedAt: new Date(),
    };
    this.societyMembers.set(id, member);

    // Update society member count
    const society = this.societies.get(societyId);
    if (society) {
      society.memberCount += 1;
      this.societies.set(societyId, society);
    }

    return member;
  }

  async isMemberOfSociety(societyId: number, userId: number): Promise<boolean> {
    return Array.from(this.societyMembers.values())
      .some(member => member.societyId === societyId && member.userId === userId && member.isActive);
  }

  // Books
  async getBook(id: number): Promise<BookWithOwner | undefined> {
    const book = this.books.get(id);
    if (!book) return undefined;

    const owner = this.users.get(book.ownerId);
    if (!owner) return undefined;

    return {
      ...book,
      owner: { id: owner.id, name: owner.name }
    };
  }

  async getBooksBySociety(societyId: number): Promise<BookWithOwner[]> {
    const societyBooks = Array.from(this.books.values())
      .filter(book => book.societyId === societyId);

    const booksWithOwners: BookWithOwner[] = [];
    for (const book of societyBooks) {
      const owner = this.users.get(book.ownerId);
      if (owner) {
        booksWithOwners.push({
          ...book,
          owner: { id: owner.id, name: owner.name }
        });
      }
    }

    return booksWithOwners;
  }

  async getBooksByOwner(ownerId: number): Promise<Book[]> {
    return Array.from(this.books.values())
      .filter(book => book.ownerId === ownerId);
  }

  async searchBooks(societyId: number, query?: string, genre?: string): Promise<BookWithOwner[]> {
    let books = Array.from(this.books.values())
      .filter(book => book.societyId === societyId);

    if (query) {
      const lowerQuery = query.toLowerCase();
      books = books.filter(book => 
        book.title.toLowerCase().includes(lowerQuery) ||
        book.author.toLowerCase().includes(lowerQuery)
      );
    }

    if (genre && genre !== 'All') {
      books = books.filter(book => book.genre === genre);
    }

    const booksWithOwners: BookWithOwner[] = [];
    for (const book of books) {
      const owner = this.users.get(book.ownerId);
      if (owner) {
        booksWithOwners.push({
          ...book,
          owner: { id: owner.id, name: owner.name }
        });
      }
    }

    return booksWithOwners;
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const id = this.currentBookId++;
    const book: Book = {
      ...insertBook,
      id,
      isAvailable: true,
      createdAt: new Date(),
    };
    this.books.set(id, book);

    // Update society book count
    const society = this.societies.get(insertBook.societyId);
    if (society) {
      society.bookCount += 1;
      this.societies.set(insertBook.societyId, society);
    }

    return book;
  }

  async updateBook(id: number, updates: Partial<Book>): Promise<Book | undefined> {
    const book = this.books.get(id);
    if (!book) return undefined;

    const updatedBook = { ...book, ...updates };
    this.books.set(id, updatedBook);
    return updatedBook;
  }

  // Rentals
  async getRental(id: number): Promise<RentalWithDetails | undefined> {
    const rental = this.bookRentals.get(id);
    if (!rental) return undefined;

    const book = this.books.get(rental.bookId);
    const borrower = this.users.get(rental.borrowerId);
    const lender = this.users.get(rental.lenderId);

    if (!book || !borrower || !lender) return undefined;

    return {
      ...rental,
      book,
      borrower: { id: borrower.id, name: borrower.name },
      lender: { id: lender.id, name: lender.name }
    };
  }

  async getRentalsByBorrower(borrowerId: number): Promise<RentalWithDetails[]> {
    const borrowerRentals = Array.from(this.bookRentals.values())
      .filter(rental => rental.borrowerId === borrowerId);

    const rentalsWithDetails: RentalWithDetails[] = [];
    for (const rental of borrowerRentals) {
      const book = this.books.get(rental.bookId);
      const borrower = this.users.get(rental.borrowerId);
      const lender = this.users.get(rental.lenderId);

      if (book && borrower && lender) {
        rentalsWithDetails.push({
          ...rental,
          book,
          borrower: { id: borrower.id, name: borrower.name },
          lender: { id: lender.id, name: lender.name }
        });
      }
    }

    return rentalsWithDetails;
  }

  async getRentalsByLender(lenderId: number): Promise<RentalWithDetails[]> {
    const lenderRentals = Array.from(this.bookRentals.values())
      .filter(rental => rental.lenderId === lenderId);

    const rentalsWithDetails: RentalWithDetails[] = [];
    for (const rental of lenderRentals) {
      const book = this.books.get(rental.bookId);
      const borrower = this.users.get(rental.borrowerId);
      const lender = this.users.get(rental.lenderId);

      if (book && borrower && lender) {
        rentalsWithDetails.push({
          ...rental,
          book,
          borrower: { id: borrower.id, name: borrower.name },
          lender: { id: lender.id, name: lender.name }
        });
      }
    }

    return rentalsWithDetails;
  }

  async getActiveRentals(userId: number): Promise<RentalWithDetails[]> {
    const activeRentals = Array.from(this.bookRentals.values())
      .filter(rental => 
        (rental.borrowerId === userId || rental.lenderId === userId) && 
        rental.status === 'active'
      );

    const rentalsWithDetails: RentalWithDetails[] = [];
    for (const rental of activeRentals) {
      const book = this.books.get(rental.bookId);
      const borrower = this.users.get(rental.borrowerId);
      const lender = this.users.get(rental.lenderId);

      if (book && borrower && lender) {
        rentalsWithDetails.push({
          ...rental,
          book,
          borrower: { id: borrower.id, name: borrower.name },
          lender: { id: lender.id, name: lender.name }
        });
      }
    }

    return rentalsWithDetails;
  }

  async createRental(insertRental: InsertBookRental): Promise<BookRental> {
    const id = this.currentRentalId++;
    const rental: BookRental = {
      ...insertRental,
      id,
      actualReturnDate: null,
      paymentId: null,
      createdAt: new Date(),
    };
    this.bookRentals.set(id, rental);

    // Mark book as unavailable
    const book = this.books.get(insertRental.bookId);
    if (book) {
      book.isAvailable = false;
      this.books.set(insertRental.bookId, book);
    }

    return rental;
  }

  async updateRental(id: number, updates: Partial<BookRental>): Promise<BookRental | undefined> {
    const rental = this.bookRentals.get(id);
    if (!rental) return undefined;

    const updatedRental = { ...rental, ...updates };
    this.bookRentals.set(id, updatedRental);

    // If returned, mark book as available
    if (updates.status === 'returned') {
      const book = this.books.get(rental.bookId);
      if (book) {
        book.isAvailable = true;
        this.books.set(rental.bookId, book);
      }
    }

    return updatedRental;
  }

  // Notifications
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.currentNotificationId++;
    const notification: Notification = {
      ...insertNotification,
      id,
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;

    notification.isRead = true;
    this.notifications.set(id, notification);
    return true;
  }

  // Statistics
  async getSocietyStats(societyId: number): Promise<{ memberCount: number; bookCount: number; activeRentals: number }> {
    const society = this.societies.get(societyId);
    const activeRentals = Array.from(this.bookRentals.values())
      .filter(rental => rental.societyId === societyId && rental.status === 'active').length;

    return {
      memberCount: society?.memberCount || 0,
      bookCount: society?.bookCount || 0,
      activeRentals
    };
  }

  async getUserStats(userId: number): Promise<{ borrowedBooks: number; lentBooks: number; totalEarnings: number }> {
    const borrowedBooks = Array.from(this.bookRentals.values())
      .filter(rental => rental.borrowerId === userId && rental.status === 'active').length;

    const lentBooks = Array.from(this.bookRentals.values())
      .filter(rental => rental.lenderId === userId && rental.status === 'active').length;

    const totalEarnings = Array.from(this.bookRentals.values())
      .filter(rental => rental.lenderId === userId && rental.status === 'returned')
      .reduce((sum, rental) => sum + parseFloat(rental.lenderAmount), 0);

    return { borrowedBooks, lentBooks, totalEarnings };
  }
}

export const storage = new MemStorage();
