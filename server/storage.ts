import { 
  users, societies, books, bookRentals, societyMembers, notifications,
  type User, type InsertUser, type Society, type InsertSociety, 
  type Book, type InsertBook, type BookRental, type InsertBookRental,
  type SocietyMember, type InsertSocietyMember, type Notification, type InsertNotification,
  type BookWithOwner, type RentalWithDetails, type SocietyWithStats
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, not, inArray, ilike, desc, count, sum, sql } from "drizzle-orm";

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
  leaveSociety(societyId: number, userId: number): Promise<boolean>;
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

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.error("Error in getUserByEmail:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Auto-assign user number
    const userCount = await db.select({ count: count() }).from(users);
    const userNumber = (userCount[0]?.count || 0) + 1;
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        userNumber,
        isAdmin: insertUser.email === 'abhay.maheshwari0812@gmail.com'
      })
      .returning();
    return user;
  }

  async getSociety(id: number): Promise<Society | undefined> {
    const [society] = await db.select().from(societies).where(eq(societies.id, id));
    return society || undefined;
  }

  async getSocietyByCode(code: string): Promise<Society | undefined> {
    const [society] = await db.select().from(societies).where(eq(societies.code, code));
    return society || undefined;
  }

  async getSocietiesByUser(userId: number): Promise<SocietyWithStats[]> {
    const userSocieties = await db
      .select({
        id: societies.id,
        name: societies.name,
        code: societies.code,
        description: societies.description,
        city: societies.city,
        apartmentCount: societies.apartmentCount,
        location: societies.location,
        createdBy: societies.createdBy,
        status: societies.status,
        createdAt: societies.createdAt,
      })
      .from(societies)
      .innerJoin(societyMembers, eq(societies.id, societyMembers.societyId))
      .where(and(eq(societyMembers.userId, userId), eq(societyMembers.isActive, true)));
    
    // Calculate dynamic stats for each society
    const societiesWithStats = await Promise.all(
      userSocieties.map(async (society) => {
        const [memberCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(societyMembers)
          .where(and(eq(societyMembers.societyId, society.id), eq(societyMembers.isActive, true)));

        const [bookCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(books)
          .where(eq(books.societyId, society.id));

        return {
          ...society,
          memberCount: memberCount?.count || 0,
          bookCount: bookCount?.count || 0,
          isJoined: true
        };
      })
    );
    
    return societiesWithStats;
  }

  async getAvailableSocieties(userId: number): Promise<SocietyWithStats[]> {
    // Get all societies
    const allSocieties = await db.select().from(societies);
    
    // Get societies user is actively part of
    const joinedSocieties = await db
      .select({ societyId: societyMembers.societyId })
      .from(societyMembers)
      .where(and(eq(societyMembers.userId, userId), eq(societyMembers.isActive, true)));
    
    const joinedIds = joinedSocieties.map(s => s.societyId);
    
    // Filter out joined societies
    const available = allSocieties.filter(society => !joinedIds.includes(society.id));
    
    return available.map(society => ({
      ...society,
      memberCount: society.memberCount,
      bookCount: society.bookCount,
      isJoined: false
    }));
  }

  async createSociety(societyData: any): Promise<Society> {
    const [society] = await db
      .insert(societies)
      .values(societyData)
      .returning();
    return society;
  }

  async joinSociety(societyId: number, userId: number): Promise<SocietyMember> {
    const [member] = await db
      .insert(societyMembers)
      .values({ societyId, userId })
      .returning();
    return member;
  }

  async leaveSociety(societyId: number, userId: number): Promise<boolean> {
    console.log("🔄 Leaving society:", { societyId, userId });
    
    const result = await db
      .update(societyMembers)
      .set({ isActive: false })
      .where(and(
        eq(societyMembers.societyId, societyId),
        eq(societyMembers.userId, userId)
      ));
    
    console.log("✅ Leave result:", result);
    return true;
  }

  async isMemberOfSociety(societyId: number, userId: number): Promise<boolean> {
    const [member] = await db
      .select()
      .from(societyMembers)
      .where(and(
        eq(societyMembers.societyId, societyId), 
        eq(societyMembers.userId, userId),
        eq(societyMembers.isActive, true)
      ));
    return !!member;
  }

  async getBook(id: number): Promise<BookWithOwner | undefined> {
    const [result] = await db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        genre: books.genre,
        condition: books.condition,
        dailyFee: books.dailyFee,
        description: books.description,
        imageUrl: books.imageUrl,
        isAvailable: books.isAvailable,
        ownerId: books.ownerId,
        societyId: books.societyId,
        createdAt: books.createdAt,
        owner: {
          id: users.id,
          name: users.name
        }
      })
      .from(books)
      .innerJoin(users, eq(books.ownerId, users.id))
      .where(eq(books.id, id));
    
    return result || undefined;
  }

  async getBooksBySociety(societyId: number): Promise<BookWithOwner[]> {
    const results = await db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        genre: books.genre,
        imageUrl: books.imageUrl,
        condition: books.condition,
        dailyFee: books.dailyFee,
        description: books.description,
        isAvailable: books.isAvailable,
        ownerId: books.ownerId,
        societyId: books.societyId,
        createdAt: books.createdAt,
        owner: {
          id: users.id,
          name: users.name
        }
      })
      .from(books)
      .innerJoin(users, eq(books.ownerId, users.id))
      .where(eq(books.societyId, societyId));
    
    return results;
  }

  async getBooksByOwner(ownerId: number): Promise<Book[]> {
    return await db.select().from(books).where(eq(books.ownerId, ownerId));
  }

  async searchBooks(societyId: number, query?: string, genre?: string): Promise<BookWithOwner[]> {
    let whereConditions = [eq(books.societyId, societyId)];
    
    if (query) {
      whereConditions.push(
        or(
          ilike(books.title, `%${query}%`),
          ilike(books.author, `%${query}%`)
        )!
      );
    }
    
    if (genre) {
      whereConditions.push(eq(books.genre, genre));
    }
    
    const results = await db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        genre: books.genre,
        imageUrl: books.imageUrl,
        condition: books.condition,
        dailyFee: books.dailyFee,
        description: books.description,
        isAvailable: books.isAvailable,
        ownerId: books.ownerId,
        societyId: books.societyId,
        createdAt: books.createdAt,
        owner: {
          id: users.id,
          name: users.name
        }
      })
      .from(books)
      .innerJoin(users, eq(books.ownerId, users.id))
      .where(and(...whereConditions));
    
    return results;
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const [book] = await db
      .insert(books)
      .values(insertBook)
      .returning();
    return book;
  }

  async updateBook(id: number, updates: Partial<Book>): Promise<Book | undefined> {
    const [book] = await db
      .update(books)
      .set(updates)
      .where(eq(books.id, id))
      .returning();
    return book || undefined;
  }

  async getRental(id: number): Promise<RentalWithDetails | undefined> {
    // For now, return undefined as rental queries need complex joins
    // This will be implemented when rental functionality is fully needed
    return undefined;
  }

  async getRentalsByBorrower(borrowerId: number): Promise<RentalWithDetails[]> {
    try {
      console.log('🔍 DatabaseStorage: Fetching borrowed books for user:', borrowerId);
      
      // First, let's check if there are any rentals at all
      const allRentals = await db.select().from(bookRentals);
      console.log('📊 Total rentals in database:', allRentals.length);
      
      const userRentals = allRentals.filter(r => r.borrowerId === borrowerId);
      console.log('📊 User rentals found:', userRentals.length);
      
      if (userRentals.length === 0) {
        console.log('❌ No rentals found for user', borrowerId);
        return [];
      }
      
      const results = await db
        .select({
          // Rental details with explicit column names
          rentalId: bookRentals.id,
          bookId: bookRentals.bookId,
          borrowerId: bookRentals.borrowerId,
          lenderId: bookRentals.lenderId,
          startDate: bookRentals.startDate,
          endDate: bookRentals.endDate,
          actualReturnDate: bookRentals.actualReturnDate,
          status: bookRentals.status,
          paymentStatus: bookRentals.paymentStatus,
          totalAmount: bookRentals.totalAmount,
          lenderAmount: bookRentals.lenderAmount,
          platformFee: bookRentals.platformFee,
          securityDeposit: bookRentals.securityDeposit,
          rentalCreatedAt: bookRentals.createdAt,
          // Book details
          bookTitle: books.title,
          bookAuthor: books.author,
          bookGenre: books.genre,
          bookCondition: books.condition,
          bookDailyFee: books.dailyFee,
          bookDescription: books.description,
          bookIsAvailable: books.isAvailable,
          bookOwnerId: books.ownerId,
          bookSocietyId: books.societyId,
          bookImageUrl: books.imageUrl,
          bookIsbn: books.isbn,
          bookCreatedAt: books.createdAt,
          // Lender details
          lenderName: users.name
        })
        .from(bookRentals)
        .innerJoin(books, eq(bookRentals.bookId, books.id))
        .innerJoin(users, eq(bookRentals.lenderId, users.id))
        .where(eq(bookRentals.borrowerId, borrowerId))
        .orderBy(desc(bookRentals.createdAt));
      
      console.log('📚 DatabaseStorage: Found borrowed books after join:', results.length);
      if (results.length > 0) {
        console.log('📖 DatabaseStorage: Sample book:', results[0].bookTitle);
      }
      
      // Transform the flat result into the expected structure
      return results.map(row => ({
        id: row.rentalId,
        bookId: row.bookId,
        borrowerId: row.borrowerId,
        lenderId: row.lenderId,
        societyId: row.bookSocietyId,
        startDate: row.startDate,
        endDate: row.endDate,
        actualReturnDate: row.actualReturnDate,
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalAmount: row.totalAmount,
        lenderAmount: row.lenderAmount,
        platformFee: row.platformFee,
        securityDeposit: row.securityDeposit,
        paymentId: null,
        createdAt: row.rentalCreatedAt,
        book: {
          id: row.bookId,
          title: row.bookTitle,
          author: row.bookAuthor,
          isbn: row.bookIsbn,
          genre: row.bookGenre,
          imageUrl: row.bookImageUrl,
          condition: row.bookCondition,
          dailyFee: row.bookDailyFee,
          description: row.bookDescription,
          isAvailable: row.bookIsAvailable,
          ownerId: row.bookOwnerId,
          societyId: row.bookSocietyId,
          createdAt: row.bookCreatedAt
        },
        borrower: { id: borrowerId, name: 'You' },
        lender: { id: row.lenderId, name: row.lenderName }
      })) as RentalWithDetails[];
    } catch (error) {
      console.error('❌ DatabaseStorage: Error fetching borrowed books:', error);
      throw error;
    }
  }

  async getRentalsByLender(lenderId: number): Promise<RentalWithDetails[]> {
    try {
      console.log('🔍 Fetching lent books for user:', lenderId);
      
      const results = await db
        .select({
          // Rental details with explicit column names
          rentalId: bookRentals.id,
          bookId: bookRentals.bookId,
          borrowerId: bookRentals.borrowerId,
          lenderId: bookRentals.lenderId,
          startDate: bookRentals.startDate,
          endDate: bookRentals.endDate,
          actualReturnDate: bookRentals.actualReturnDate,
          status: bookRentals.status,
          paymentStatus: bookRentals.paymentStatus,
          totalAmount: bookRentals.totalAmount,
          lenderAmount: bookRentals.lenderAmount,
          platformFee: bookRentals.platformFee,
          securityDeposit: bookRentals.securityDeposit,
          rentalCreatedAt: bookRentals.createdAt,
          // Book details
          bookTitle: books.title,
          bookAuthor: books.author,
          bookGenre: books.genre,
          bookCondition: books.condition,
          bookDailyFee: books.dailyFee,
          bookDescription: books.description,
          bookIsAvailable: books.isAvailable,
          bookOwnerId: books.ownerId,
          bookSocietyId: books.societyId,
          bookImageUrl: books.imageUrl,
          bookIsbn: books.isbn,
          bookCreatedAt: books.createdAt,
          // Borrower details
          borrowerName: users.name
        })
        .from(bookRentals)
        .innerJoin(books, eq(bookRentals.bookId, books.id))
        .innerJoin(users, eq(bookRentals.borrowerId, users.id))
        .where(eq(bookRentals.lenderId, lenderId))
        .orderBy(desc(bookRentals.createdAt));
      
      console.log('📚 Found lent books:', results.length);
      if (results.length > 0) {
        console.log('📖 Sample book:', results[0].bookTitle);
      }
      
      // Transform the flat result into the expected structure
      return results.map(row => ({
        id: row.rentalId,
        bookId: row.bookId,
        borrowerId: row.borrowerId,
        lenderId: row.lenderId,
        societyId: row.bookSocietyId,
        startDate: row.startDate,
        endDate: row.endDate,
        actualReturnDate: row.actualReturnDate,
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalAmount: row.totalAmount,
        lenderAmount: row.lenderAmount,
        platformFee: row.platformFee,
        securityDeposit: row.securityDeposit,
        paymentId: null,
        createdAt: row.rentalCreatedAt,
        book: {
          id: row.bookId,
          title: row.bookTitle,
          author: row.bookAuthor,
          isbn: row.bookIsbn,
          genre: row.bookGenre,
          imageUrl: row.bookImageUrl,
          condition: row.bookCondition,
          dailyFee: row.bookDailyFee,
          description: row.bookDescription,
          isAvailable: row.bookIsAvailable,
          ownerId: row.bookOwnerId,
          societyId: row.bookSocietyId,
          createdAt: row.bookCreatedAt
        },
        borrower: { id: row.borrowerId, name: row.borrowerName },
        lender: { id: lenderId, name: 'You' }
      })) as RentalWithDetails[];
    } catch (error) {
      console.error('❌ Error fetching lent books:', error);
      return [];
    }
  }

  async getActiveRentals(userId: number): Promise<RentalWithDetails[]> {
    // For now, return empty array as rental queries need complex joins
    // This will be implemented when rental functionality is fully needed
    return [];
  }

  async createRental(insertRental: InsertBookRental): Promise<BookRental> {
    const [rental] = await db
      .insert(bookRentals)
      .values(insertRental)
      .returning();
    return rental;
  }

  async updateRental(id: number, updates: Partial<BookRental>): Promise<BookRental | undefined> {
    const [rental] = await db
      .update(bookRentals)
      .set(updates)
      .where(eq(bookRentals.id, id))
      .returning();
    return rental || undefined;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<boolean> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return !!notification;
  }

  async getSocietyStats(societyId: number): Promise<{ memberCount: number; bookCount: number; activeRentals: number }> {
    const [memberCount] = await db
      .select({ count: count() })
      .from(societyMembers)
      .where(eq(societyMembers.societyId, societyId));
    
    const [bookCount] = await db
      .select({ count: count() })
      .from(books)
      .where(eq(books.societyId, societyId));
    
    const [activeRentals] = await db
      .select({ count: count() })
      .from(bookRentals)
      .innerJoin(books, eq(bookRentals.bookId, books.id))
      .where(
        and(
          eq(books.societyId, societyId),
          eq(bookRentals.status, 'active')
        )
      );
    
    return {
      memberCount: memberCount.count,
      bookCount: bookCount.count,
      activeRentals: activeRentals.count
    };
  }

  async getUserStats(userId: number): Promise<{ borrowedBooks: number; lentBooks: number; totalEarnings: number }> {
    const [borrowedBooks] = await db
      .select({ count: count() })
      .from(bookRentals)
      .where(eq(bookRentals.borrowerId, userId));
    
    const [lentBooks] = await db
      .select({ count: count() })
      .from(bookRentals)
      .where(eq(bookRentals.lenderId, userId));
    
    // For now, return 0 for earnings as rental fee field needs to be added to schema
    return {
      borrowedBooks: borrowedBooks.count,
      lentBooks: lentBooks.count,
      totalEarnings: 0
    };
  }
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
      id,
      name: insertSociety.name,
      description: insertSociety.description || null,
      code,
      createdBy: insertSociety.createdBy,
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
      id,
      title: insertBook.title,
      author: insertBook.author,
      isbn: insertBook.isbn || null,
      genre: insertBook.genre,
      description: insertBook.description || null,
      imageUrl: insertBook.imageUrl || null,
      condition: insertBook.condition,
      dailyFee: insertBook.dailyFee,
      ownerId: insertBook.ownerId,
      societyId: insertBook.societyId,
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
      id,
      bookId: insertRental.bookId,
      borrowerId: insertRental.borrowerId,
      lenderId: insertRental.lenderId,
      societyId: insertRental.societyId,
      startDate: new Date(),
      endDate: insertRental.endDate,
      actualReturnDate: null,
      totalAmount: insertRental.totalAmount,
      platformFee: insertRental.platformFee,
      lenderAmount: insertRental.lenderAmount,
      securityDeposit: insertRental.securityDeposit,
      status: insertRental.status,
      paymentStatus: insertRental.paymentStatus,
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

export const storage = new DatabaseStorage();
console.log('🗄️ Using DatabaseStorage for data operations');
// Expose db for direct queries when needed
(storage as any).db = db;
