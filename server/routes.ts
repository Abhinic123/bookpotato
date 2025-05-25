import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSocietySchema, insertBookSchema, insertBookRentalSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Session interface
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session: import("express-session").Session & Partial<import("express-session").SessionData> & {
        userId?: number;
      };
    }
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const borrowBookSchema = z.object({
  bookId: z.number(),
  duration: z.number().min(1),
  paymentMethod: z.string(),
});

const joinSocietySchema = z.object({
  societyId: z.number().optional(),
  code: z.string().optional(),
}).refine(data => data.societyId || data.code, {
  message: "Either societyId or code must be provided"
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const user = await storage.createUser(userData);
      req.session.userId = user.id;
      
      res.json({ 
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Simple password comparison (in production, use proper hashing)
      if (user.password !== password) {
        console.log(`Password mismatch for ${email}. Stored: ${user.password}, Provided: ${password}`);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;
      res.json({ 
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ 
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
    });
  });

  // Middleware to check authentication
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Society routes
  app.get("/api/societies/my", requireAuth, async (req, res) => {
    try {
      const societies = await storage.getSocietiesByUser(req.session.userId!);
      res.json(societies);
    } catch (error) {
      console.error("Get my societies error:", error);
      res.status(500).json({ message: "Failed to fetch societies" });
    }
  });

  app.get("/api/societies/available", requireAuth, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT s.id, s.name, s.description, s.code, s.city, s.apartment_count, 
               s.location, s.created_by, s.status, s.created_at, s.member_count, s.book_count
        FROM societies s
        LEFT JOIN society_members sm ON s.id = sm.society_id AND sm.user_id = ${req.session.userId!} AND sm.is_active = true
        WHERE sm.society_id IS NULL
      `);
      
      const societies = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        code: row.code,
        city: row.city,
        apartmentCount: row.apartment_count,
        location: row.location,
        createdBy: row.created_by,
        status: row.status,
        createdAt: row.created_at,
        memberCount: row.member_count,
        bookCount: row.book_count,
        isJoined: false
      }));
      
      res.json(societies);
    } catch (error) {
      console.error("Get available societies error:", error);
      res.status(500).json({ message: "Failed to fetch available societies" });
    }
  });

  app.post("/api/societies", requireAuth, async (req, res) => {
    try {
      console.log('Raw request body:', req.body);
      
      // Auto-generate a simple code from the society name
      const generateCode = (name: string) => {
        return name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() + Math.floor(Math.random() * 1000);
      };

      // First validate the basic data
      const validatedData = insertSocietySchema.parse(req.body);
      console.log('Validated data:', validatedData);
      
      // Generate the code
      const generatedCode = generateCode(req.body.name || 'SOC');
      console.log('Generated code:', generatedCode, 'from name:', req.body.name);
      
      // Then add the auto-generated fields
      const societyData = {
        ...validatedData,
        code: generatedCode,
        status: 'active',
        createdBy: req.session.userId!
      };
      
      console.log('Final society data:', societyData);
      
      const society = await storage.createSociety(societyData);
      
      // Auto-join the creator to the society
      await storage.joinSociety(society.id, req.session.userId!);
      
      res.json(society);
    } catch (error) {
      console.error("Create society error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Please fill all required fields", errors: error.errors });
      }
      res.status(400).json({ message: "Failed to create society" });
    }
  });

  app.post("/api/societies/join", requireAuth, async (req, res) => {
    try {
      const { societyId, code } = joinSocietySchema.parse(req.body);
      
      let targetSocietyId = societyId;
      
      if (code && !societyId) {
        const society = await storage.getSocietyByCode(code);
        if (!society) {
          return res.status(404).json({ message: "Society not found with this code" });
        }
        targetSocietyId = society.id;
      }

      if (!targetSocietyId) {
        return res.status(400).json({ message: "Society ID or code required" });
      }

      // Check if already a member
      const isMember = await storage.isMemberOfSociety(targetSocietyId, req.session.userId!);
      if (isMember) {
        return res.status(400).json({ message: "Already a member of this society" });
      }

      const member = await storage.joinSociety(targetSocietyId, req.session.userId!);
      res.json(member);
    } catch (error) {
      console.error("Join society error:", error);
      res.status(400).json({ message: "Failed to join society" });
    }
  });

  app.post("/api/societies/:id/join", requireAuth, async (req, res) => {
    console.log("🚀 JOIN ROUTE HIT - societyId:", req.params.id, "userId:", req.session.userId);
    
    try {
      const societyId = parseInt(req.params.id);
      
      if (!societyId || isNaN(societyId)) {
        console.log("❌ Invalid society ID");
        return res.status(400).json({ message: "Valid society ID required" });
      }

      // Check if society exists
      const society = await storage.getSociety(societyId);
      if (!society) {
        console.log("❌ Society not found");
        return res.status(404).json({ message: "Society not found" });
      }

      // Check if already a member
      const isMember = await storage.isMemberOfSociety(societyId, req.session.userId!);
      if (isMember) {
        console.log("❌ Already a member");
        return res.status(400).json({ message: "Already a member of this society" });
      }

      const member = await storage.joinSociety(societyId, req.session.userId!);
      console.log("✅ Successfully joined society:", member);
      
      return res.json({ 
        success: true, 
        member: member,
        message: "Successfully joined society"
      });
    } catch (error: any) {
      console.error("❌ Join society error:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to join society: " + error.message 
      });
    }
  });

  // Leave society
  app.post("/api/societies/:id/leave", requireAuth, async (req, res) => {
    try {
      const societyId = parseInt(req.params.id);
      
      if (!societyId || isNaN(societyId)) {
        return res.status(400).json({ message: "Valid society ID required" });
      }

      // Check if user is a member
      const isMember = await storage.isMemberOfSociety(societyId, req.session.userId!);
      if (!isMember) {
        return res.status(400).json({ message: "Not a member of this society" });
      }

      // Remove membership by setting isActive to false
      await storage.leaveSociety(societyId, req.session.userId!);
      
      res.json({ success: true, message: "Successfully left society" });
    } catch (error: any) {
      console.error("Leave society error:", error);
      res.status(500).json({ message: "Failed to leave society" });
    }
  });

  app.get("/api/societies/:id/stats", requireAuth, async (req, res) => {
    try {
      const societyId = parseInt(req.params.id);
      const stats = await storage.getSocietyStats(societyId);
      res.json(stats);
    } catch (error) {
      console.error("Get society stats error:", error);
      res.status(500).json({ message: "Failed to fetch society stats" });
    }
  });

  // Book routes
  app.get("/api/books/society", requireAuth, async (req, res) => {
    try {
      const mySocieties = await storage.getSocietiesByUser(req.session.userId!);
      if (!mySocieties || mySocieties.length === 0) {
        return res.json([]);
      }
      
      const societyId = mySocieties[0].id;
      const books = await storage.getBooksBySociety(societyId);
      res.json(books);
    } catch (error) {
      console.error("Get society books error:", error);
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  app.get("/api/books/society/:societyId", requireAuth, async (req, res) => {
    try {
      const societyId = parseInt(req.params.societyId);
      const { search, genre } = req.query;

      const result = await db.execute(sql`
        SELECT b.*, u.name as owner_name, u.email as owner_email 
        FROM books b
        JOIN users u ON b.owner_id = u.id
        WHERE b.society_id = ${societyId}
        AND (${!search} OR LOWER(b.title) LIKE LOWER(${'%' + (search as string) + '%'})
            OR LOWER(b.author) LIKE LOWER(${'%' + (search as string) + '%'}))
        AND (${!genre || genre === 'All'} OR b.genre = ${genre})
        ORDER BY b.created_at DESC
      `);

      const books = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        genre: row.genre,
        description: row.description,
        dailyFee: row.daily_fee,
        isAvailable: row.is_available,
        societyId: row.society_id,
        ownerId: row.owner_id,
        owner: {
          name: row.owner_name,
          email: row.owner_email
        }
      }));
      
      res.json(books);
    } catch (error) {
      console.error("Get society books error:", error);
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  app.get("/api/books/my", requireAuth, async (req, res) => {
    try {
      const books = await storage.getBooksByOwner(req.session.userId!);
      res.json(books);
    } catch (error) {
      console.error("Get my books error:", error);
      res.status(500).json({ message: "Failed to fetch your books" });
    }
  });

  app.post("/api/books", requireAuth, async (req, res) => {
    try {
      const bookData = insertBookSchema.parse({
        ...req.body,
        ownerId: req.session.userId!
      });
      
      // Verify user is member of the society
      const isMember = await storage.isMemberOfSociety(bookData.societyId, req.session.userId!);
      if (!isMember) {
        return res.status(403).json({ message: "You must be a member of this society to add books" });
      }

      const book = await storage.createBook(bookData);
      res.json(book);
    } catch (error) {
      console.error("Create book error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Please fill all required fields", errors: error.errors });
      }
      res.status(400).json({ message: "Failed to create book" });
    }
  });

  app.patch("/api/books/:id", requireAuth, async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      const book = await storage.getBook(bookId);
      
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }

      if (book.ownerId !== req.session.userId!) {
        return res.status(403).json({ message: "You can only edit your own books" });
      }

      const updatedBook = await storage.updateBook(bookId, req.body);
      res.json(updatedBook);
    } catch (error) {
      console.error("Update book error:", error);
      res.status(400).json({ message: "Failed to update book" });
    }
  });

  // Rental routes
  app.get("/api/rentals/borrowed", requireAuth, async (req, res) => {
    try {
      const rentals = await storage.getRentalsByBorrower(req.session.userId!);
      res.json(rentals);
    } catch (error) {
      console.error("Get borrowed books error:", error);
      res.status(500).json({ message: "Failed to fetch borrowed books" });
    }
  });

  app.get("/api/rentals/lent", requireAuth, async (req, res) => {
    try {
      const rentals = await storage.getRentalsByLender(req.session.userId!);
      res.json(rentals);
    } catch (error) {
      console.error("Get lent books error:", error);
      res.status(500).json({ message: "Failed to fetch lent books" });
    }
  });

  app.get("/api/rentals/active", requireAuth, async (req, res) => {
    try {
      const rentals = await storage.getActiveRentals(req.session.userId!);
      res.json(rentals);
    } catch (error) {
      console.error("Get active rentals error:", error);
      res.status(500).json({ message: "Failed to fetch active rentals" });
    }
  });

  app.post("/api/rentals/borrow", requireAuth, async (req, res) => {
    try {
      const { bookId, duration, paymentMethod } = borrowBookSchema.parse(req.body);
      
      const book = await storage.getBook(bookId);
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }

      if (!book.isAvailable) {
        return res.status(400).json({ message: "Book is not available for borrowing" });
      }

      if (book.ownerId === req.session.userId!) {
        return res.status(400).json({ message: "You cannot borrow your own book" });
      }

      // Calculate costs
      const dailyFee = parseFloat(book.dailyFee);
      const totalRentalFee = dailyFee * duration;
      const platformFeeRate = 0.05; // 5%
      const platformFee = totalRentalFee * platformFeeRate;
      const lenderAmount = totalRentalFee - platformFee;
      const securityDeposit = 100; // Fixed security deposit
      const totalAmount = totalRentalFee + securityDeposit;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);

      const rentalData = {
        bookId,
        borrowerId: req.session.userId!,
        lenderId: book.ownerId,
        societyId: book.societyId,
        endDate,
        totalAmount: totalAmount.toString(),
        platformFee: platformFee.toString(),
        lenderAmount: lenderAmount.toString(),
        securityDeposit: securityDeposit.toString(),
        status: 'active',
        paymentStatus: 'completed', // Simulated payment success
      };

      const rental = await storage.createRental(rentalData);
      
      // Create notification for lender
      await storage.createNotification({
        userId: book.ownerId,
        title: "Book Borrowed",
        message: `Your book "${book.title}" has been borrowed`,
        type: "rental"
      });

      res.json(rental);
    } catch (error) {
      console.error("Borrow book error:", error);
      res.status(400).json({ message: "Failed to borrow book" });
    }
  });

  app.patch("/api/rentals/:id/return", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }

      if (rental.borrowerId !== req.session.userId! && rental.lenderId !== req.session.userId!) {
        return res.status(403).json({ message: "You can only return rentals you're involved in" });
      }

      const updatedRental = await storage.updateRental(rentalId, {
        status: 'returned',
        actualReturnDate: new Date(),
      });

      // Create notification for the other party
      const notificationUserId = rental.borrowerId === req.session.userId! 
        ? rental.lenderId 
        : rental.borrowerId;
      
      await storage.createNotification({
        userId: notificationUserId,
        title: "Book Returned",
        message: `The book "${rental.book.title}" has been returned`,
        type: "return"
      });

      res.json(updatedRental);
    } catch (error) {
      console.error("Return book error:", error);
      res.status(400).json({ message: "Failed to return book" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const success = await storage.markNotificationAsRead(notificationId);
      
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(400).json({ message: "Failed to mark notification as read" });
    }
  });

  // User stats
  app.get("/api/user/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
