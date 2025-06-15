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
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        res.json({ 
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            phone: user.phone,
            isAdmin: user.isAdmin 
          }
        });
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
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        isAdmin: user.isAdmin || false
      }
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



  // Get all books from user's societies
  app.get("/api/books/all", requireAuth, async (req, res) => {
    try {
      // Get all societies the user is a member of
      const userSocieties = await storage.getSocietiesByUser(req.session.userId!);
      console.log("📚 API /books/all - User societies:", userSocieties.length);
      
      let allBooks: any[] = [];
      for (const society of userSocieties) {
        const societyBooks = await storage.getBooksBySociety(society.id);
        console.log(`📚 Society ${society.name} has ${societyBooks.length} books`);
        allBooks.push(...societyBooks);
      }
      
      console.log("📚 Total books found:", allBooks.length);
      console.log("📚 Sample book:", allBooks[0]);
      console.log("📚 Sending response:", JSON.stringify(allBooks).substring(0, 200) + "...");
      
      res.status(200).json(allBooks);
    } catch (error) {
      console.error("❌ Get all books error:", error);
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  app.get("/api/books/society/:societyId", requireAuth, async (req, res) => {
    try {
      const societyId = parseInt(req.params.societyId);
      const { search, genre } = req.query;
      
      let books;
      if (societyId === 0) {
        // Get ALL books from user's societies for "All" option
        const userSocieties = await storage.getSocietiesByUser(req.session.userId!);
        books = [];
        for (const society of userSocieties) {
          const societyBooks = await storage.getBooksBySociety(society.id);
          books.push(...societyBooks);
        }
      } else {
        // Get books for specific society
        books = await storage.getBooksBySociety(societyId);
      }

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
      console.log("🔍 API: Fetching borrowed books for user:", req.session.userId!);
      console.log("📊 DEBUG: Session data:", { 
        userId: req.session.userId
      });
      
      const rentals = await storage.getRentalsByBorrower(req.session.userId!);
      console.log("📚 API: Borrowed books result:", rentals.length, "books");
      if (rentals.length > 0) {
        console.log("📖 First book:", rentals[0].book?.title);
      }
      
      // Force no cache for debugging
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(rentals);
    } catch (error) {
      console.error("❌ API: Get borrowed books error:", error);
      res.status(500).json({ message: "Failed to fetch borrowed books" });
    }
  });

  app.get("/api/rentals/lent", requireAuth, async (req, res) => {
    try {
      console.log("🔍 API: Fetching lent books for user:", req.session.userId!);
      const rentals = await storage.getRentalsByLender(req.session.userId!);
      console.log("📚 API: Lent books result:", rentals.length, "books");
      if (rentals.length > 0) {
        console.log("📖 First book:", rentals[0].book?.title);
      }
      
      // Force no cache for debugging
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache'); 
      res.setHeader('Expires', '0');
      
      res.json(rentals);
    } catch (error) {
      console.error("❌ API: Get lent books error:", error);
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

  // Book return request
  app.post("/api/rentals/:id/request-return", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental || rental.borrowerId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Create notification for lender
      await storage.createNotification({
        userId: rental.lenderId,
        title: "Book Return Request",
        message: `${rental.borrower.name} wants to return "${rental.book.title}". Please confirm if received.`,
        type: "return_request",
        data: { rentalId: rentalId }
      });

      res.json({ message: "Return request sent to book owner" });
    } catch (error) {
      console.error("Request return error:", error);
      res.status(500).json({ message: "Failed to request return" });
    }
  });

  // Request book return (by borrower)
  app.post("/api/rentals/:id/request-return", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental || rental.borrowerId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { notes } = req.body;

      // Update rental status to indicate return request
      await storage.updateRental(rentalId, {
        status: 'return_requested'
      });

      // Notify lender
      await storage.createNotification({
        userId: rental.lenderId,
        title: "Return Request",
        message: `${rental.borrower.name} has requested to return "${rental.book.title}"${notes ? `. Message: ${notes}` : ''}`,
        type: "return_request"
      });

      res.json({ message: "Return request sent successfully" });
    } catch (error) {
      console.error("Request return error:", error);
      res.status(500).json({ message: "Failed to request return" });
    }
  });

  // Confirm book return (by lender)
  app.post("/api/rentals/:id/confirm-return", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental || rental.lenderId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { notes } = req.body;

      // Check if overdue and calculate late fees
      const endDate = new Date(rental.endDate);
      const currentDate = new Date();
      const isOverdue = currentDate > endDate;
      let lateFee = 0;

      if (isOverdue) {
        const daysLate = Math.ceil((currentDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        const dailyLateFee = (rental.book?.dailyFee || 10) * 0.5; // 50% of daily fee
        lateFee = daysLate * dailyLateFee;
      }

      // Update rental status and mark book as available
      await storage.updateRental(rentalId, {
        status: 'returned',
        actualReturnDate: new Date(),
        lateFee: lateFee
      });

      // Mark book as available
      await storage.updateBook(rental.bookId, { isAvailable: true });

      // Notify borrower
      await storage.createNotification({
        userId: rental.borrowerId,
        title: "Book Return Confirmed",
        message: `Return of "${rental.book.title}" has been confirmed${lateFee > 0 ? `. Late fee: ₹${lateFee.toFixed(2)}` : ''}. Thank you!`,
        type: "return_confirmed"
      });

      res.json({ 
        message: "Book return confirmed successfully",
        lateFee: lateFee 
      });
    } catch (error) {
      console.error("Confirm return error:", error);
      res.status(500).json({ message: "Failed to confirm return" });
    }
  });

  // Pay late fees
  app.post("/api/rentals/:id/pay-late-fees", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental || rental.borrowerId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { lateFeeAmount } = req.body;

      // Update rental with late fee payment
      await storage.updateRental(rentalId, {
        lateFeePaid: true,
        lateFeeAmount: lateFeeAmount
      });

      // Create notification for lender
      await storage.createNotification({
        userId: rental.lenderId,
        title: "Late Fee Paid",
        message: `${rental.borrower.name} has paid ₹${lateFeeAmount.toFixed(2)} in late fees for "${rental.book.title}"`,
        type: "late_fee_paid"
      });

      res.json({ message: "Late fees paid successfully" });
    } catch (error) {
      console.error("Pay late fees error:", error);
      res.status(500).json({ message: "Failed to process late fee payment" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin && user?.email !== 'abhinic@gmail.com') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get platform statistics
      const totalUsers = await storage.getTotalUsers();
      const totalBooks = await storage.getTotalBooks();  
      const totalSocieties = await storage.getTotalSocieties();
      const activeRentals = await storage.getActiveRentalsCount();

      res.json({
        totalUsers,
        totalBooks,
        totalSocieties,
        activeRentals
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to fetch admin statistics" });
    }
  });

  app.get("/api/admin/society-requests", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin && user?.email !== 'abhinic@gmail.com') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const requests = await storage.getSocietyRequests();
      res.json(requests);
    } catch (error) {
      console.error("Society requests error:", error);
      res.status(500).json({ message: "Failed to fetch society requests" });
    }
  });

  app.post("/api/admin/society-requests/review", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin && user?.email !== 'abhinic@gmail.com') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { requestId, approved, reason } = req.body;
      await storage.reviewSocietyRequest(requestId, approved, reason);
      
      res.json({ message: "Society request reviewed successfully" });
    } catch (error) {
      console.error("Review society request error:", error);
      res.status(500).json({ message: "Failed to review society request" });
    }
  });

  app.post("/api/admin/referral-rewards", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin && user?.email !== 'abhinic@gmail.com') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const reward = await storage.createReferralReward(req.body);
      res.json(reward);
    } catch (error) {
      console.error("Create referral reward error:", error);
      res.status(500).json({ message: "Failed to create referral reward" });
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
      
      // Mark book as unavailable
      await storage.updateBook(bookId, { isAvailable: false });
      
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

  // Messaging endpoints
  app.get("/api/messages/conversations", requireAuth, async (req, res) => {
    try {
      const conversations = await storage.getConversations(req.session.userId!);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/messages/:userId", requireAuth, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.userId);
      const messages = await storage.getMessages(req.session.userId!, otherUserId);
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const { recipientId, content } = req.body;
      const message = await storage.createMessage({
        senderId: req.session.userId!,
        recipientId,
        content,
        read: false
      });
      res.json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post("/api/messages/mark-read/:userId", requireAuth, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.userId);
      await storage.markMessagesAsRead(req.session.userId!, otherUserId);
      res.json({ message: "Messages marked as read" });
    } catch (error) {
      console.error("Mark messages read error:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
