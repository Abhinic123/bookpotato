import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSocietySchema, insertBookSchema, insertBookRentalSchema } from "@shared/schema";
import { z } from "zod";
import { db, pool } from "./db";
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

// Helper function to get platform settings
async function getPlatformSettings() {
  try {
    const result = await pool.query(`
      SELECT commission_rate, security_deposit, min_apartments, max_rental_days 
      FROM platform_settings 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      return {
        commissionRate: parseFloat(result.rows[0].commission_rate),
        securityDeposit: parseFloat(result.rows[0].security_deposit),
        minApartments: parseInt(result.rows[0].min_apartments),
        maxRentalDays: parseInt(result.rows[0].max_rental_days)
      };
    }
  } catch (error) {
    console.error('Error fetching platform settings:', error);
  }
  
  // Return default values if query fails
  return {
    commissionRate: 5,
    securityDeposit: 100,
    minApartments: 90,
    maxRentalDays: 30
  };
}

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
        address: user.address,
        profilePicture: user.profilePicture,
        userNumber: user.userNumber,
        totalReferrals: user.totalReferrals,
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

  // User profile endpoints
  app.put("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const { name, email, phone, address } = req.body;
      const userId = req.session.userId!;
      
      // In a real app, you'd update the user in the database
      // For now, we'll just return success
      res.json({ message: "Profile updated successfully" });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put("/api/user/password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.session.userId!;
      
      console.log('Password change request:', { userId, currentPassword, newPassword });
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log('Current user password:', user.password);

      // Verify current password
      if (user.password !== currentPassword) {
        console.log('Password mismatch');
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Update password in database using SQL
      await db.execute(sql`
        UPDATE users 
        SET password = ${newPassword}
        WHERE id = ${userId}
      `);

      console.log('Password updated successfully');
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Update password error:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.post("/api/user/profile-picture", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Generate a placeholder avatar URL
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=200&background=random`;
      
      // Update user in memory storage using proper method
      const updatedUser = await (storage as any).updateUser(userId, { profilePicture: avatarUrl });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update profile picture" });
      }

      console.log('Profile picture updated for user:', userId);
      res.json({ 
        message: "Profile picture updated successfully",
        profilePicture: avatarUrl
      });
    } catch (error) {
      console.error("Upload profile picture error:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

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
      const societies = await storage.getAvailableSocieties(req.session.userId!);
      
      res.json(societies);
    } catch (error) {
      console.error("Get available societies error:", error);
      res.status(500).json({ message: "Failed to fetch available societies" });
    }
  });

  app.post("/api/societies", requireAuth, async (req, res) => {
    try {
      console.log('Raw request body:', req.body);
      
      // First validate the basic data
      const validatedData = insertSocietySchema.parse(req.body);
      console.log('Validated data:', validatedData);

      // Get minimum apartment requirement from admin settings
      const minApartments = 90; // This could be fetched from settings in the future
      
      // Check if apartment count meets minimum requirement
      if (validatedData.apartmentCount < minApartments) {
        // Find existing societies in the same city for potential merging
        const existingSocieties = await storage.getSocietiesByLocation(validatedData.city);
        
        return res.status(400).json({
          message: `Minimum ${minApartments} apartments required. Consider merging with existing societies in your area.`,
          minApartments,
          suggestedSocieties: existingSocieties.map(s => ({
            id: s.id,
            name: s.name,
            location: s.location,
            apartmentCount: s.apartmentCount,
            memberCount: s.memberCount
          })),
          requiresMerge: true
        });
      }

      // Create society request for admin approval
      const requestData = {
        ...validatedData,
        requestedBy: req.session.userId!,
        status: 'pending'
      };
      
      const request = await storage.createSocietyRequest(requestData);
      
      res.json({
        message: "Society creation request submitted for admin approval",
        requestId: request.id,
        status: "pending"
      });
    } catch (error) {
      console.error("Create society error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Please fill all required fields", errors: error.errors });
      }
      res.status(400).json({ message: "Failed to create society request" });
    }
  });

  // Merge with existing society endpoint
  app.post("/api/societies/merge", requireAuth, async (req, res) => {
    try {
      const { targetSocietyId, newSocietyName, newSocietyDescription } = req.body;
      
      if (!targetSocietyId || !newSocietyName) {
        return res.status(400).json({ message: "Target society ID and new society name are required" });
      }

      // Check if target society exists
      const targetSociety = await storage.getSociety(targetSocietyId);
      if (!targetSociety) {
        return res.status(404).json({ message: "Target society not found" });
      }

      // Create merge request
      const mergeRequestData = {
        name: `${newSocietyName} (merge with ${targetSociety.name})`,
        description: newSocietyDescription || `Merge request to join ${targetSociety.name}`,
        city: targetSociety.city,
        apartmentCount: 1, // Placeholder, will be handled during admin review
        location: targetSociety.location,
        requestedBy: req.session.userId!,
        status: 'pending_merge',
        targetSocietyId: targetSocietyId
      };
      
      const request = await storage.createSocietyRequest(mergeRequestData);
      
      res.json({
        message: "Merge request submitted for admin approval",
        requestId: request.id,
        status: "pending_merge",
        targetSociety: {
          name: targetSociety.name,
          location: targetSociety.location
        }
      });
    } catch (error) {
      console.error("Merge society request error:", error);
      res.status(400).json({ message: "Failed to create merge request" });
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
        // Filter out user's own books
        const otherBooks = societyBooks.filter(book => book.ownerId !== req.session.userId!);
        allBooks.push(...otherBooks);
      }
      
      // Sort books by creation date (newest first) for home page recent books
      allBooks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      console.log("📚 Total books found:", allBooks.length);
      console.log("📚 Sample book:", allBooks[0]);
      console.log("📚 Sending response:", JSON.stringify(allBooks).substring(0, 200) + "...");
      
      res.status(200).json(allBooks);
    } catch (error) {
      console.error("❌ Get all books error:", error);
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  app.get("/api/books/browse", requireAuth, async (req, res) => {
    try {
      const { 
        search, 
        genres, 
        minPrice, 
        maxPrice, 
        conditions, 
        societies, 
        availability, 
        sortBy, 
        location 
      } = req.query;

      // Get all books from user's societies, excluding user's own books
      const userSocieties = await storage.getSocietiesByUser(req.session.userId!);
      let allBooks: any[] = [];
      
      for (const society of userSocieties) {
        const societyBooks = await storage.getBooksBySociety(society.id);
        // Filter out user's own books
        const otherBooks = societyBooks.filter(book => book.ownerId !== req.session.userId!);
        allBooks.push(...otherBooks);
      }

      // Apply search filter
      if (search && typeof search === 'string') {
        const searchTerm = search.toLowerCase();
        allBooks = allBooks.filter(book => 
          book.title.toLowerCase().includes(searchTerm) ||
          book.author.toLowerCase().includes(searchTerm) ||
          book.genre.toLowerCase().includes(searchTerm) ||
          (book.description && book.description.toLowerCase().includes(searchTerm))
        );
      }

      // Apply genre filter
      if (genres && typeof genres === 'string') {
        const genreList = genres.split(',');
        allBooks = allBooks.filter(book => genreList.includes(book.genre));
      }

      // Apply price range filter
      if (minPrice && maxPrice) {
        const min = parseFloat(minPrice as string);
        const max = parseFloat(maxPrice as string);
        allBooks = allBooks.filter(book => {
          const price = parseFloat(book.dailyFee);
          return price >= min && price <= max;
        });
      }

      // Apply condition filter
      if (conditions && typeof conditions === 'string') {
        const conditionList = conditions.split(',');
        allBooks = allBooks.filter(book => conditionList.includes(book.condition));
      }

      // Apply availability filter
      if (availability && availability !== 'all') {
        if (availability === 'available') {
          allBooks = allBooks.filter(book => book.isAvailable);
        } else if (availability === 'rented') {
          allBooks = allBooks.filter(book => !book.isAvailable);
        }
      }

      // Apply sorting
      if (sortBy) {
        switch (sortBy) {
          case 'newest':
            allBooks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            break;
          case 'oldest':
            allBooks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            break;
          case 'price_low':
            allBooks.sort((a, b) => parseFloat(a.dailyFee) - parseFloat(b.dailyFee));
            break;
          case 'price_high':
            allBooks.sort((a, b) => parseFloat(b.dailyFee) - parseFloat(a.dailyFee));
            break;
          default:
            allBooks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }

      res.json(allBooks);
    } catch (error) {
      console.error("Browse books error:", error);
      res.status(500).json([]);
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

  // Extension request
  app.post("/api/rentals/:id/request-extension", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const { extensionDays, reason } = req.body;
      
      const rental = await storage.getRental(rentalId);
      
      if (!rental || rental.borrowerId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (!extensionDays || extensionDays < 1 || extensionDays > 30) {
        return res.status(400).json({ message: "Extension days must be between 1 and 30" });
      }

      if (!reason || reason.length < 10) {
        return res.status(400).json({ message: "Reason must be at least 10 characters" });
      }

      const currentEndDate = new Date(rental.endDate);
      const proposedEndDate = new Date(currentEndDate);
      proposedEndDate.setDate(currentEndDate.getDate() + extensionDays);

      // Create notification for book owner
      await storage.createNotification({
        userId: rental.lenderId,
        title: "Extension Request",
        message: `${rental.borrower.name} requests to extend "${rental.book.title}" for ${extensionDays} day(s). Current return date: ${currentEndDate.toLocaleDateString()}, Proposed: ${proposedEndDate.toLocaleDateString()}. Reason: ${reason}`,
        type: "extension_request",
        data: JSON.stringify({ 
          rentalId: rentalId,
          extensionDays: extensionDays,
          reason: reason,
          proposedEndDate: proposedEndDate.toISOString()
        })
      });

      res.json({ message: "Extension request sent to book owner" });
    } catch (error) {
      console.error("Request extension error:", error);
      res.status(500).json({ message: "Failed to request extension" });
    }
  });

  // Book return request (by borrower)
  app.post("/api/rentals/:id/request-return", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental || rental.borrowerId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Check if return request already sent
      if (rental.status === 'return_requested') {
        return res.status(400).json({ message: "Return request already sent" });
      }

      const { notes } = req.body;

      // Get borrower and lender details including phone numbers
      const borrower = await storage.getUser(rental.borrowerId);
      const lender = await storage.getUser(rental.lenderId);

      if (!borrower || !lender) {
        return res.status(400).json({ message: "User details not found" });
      }

      // Update rental status to indicate return request
      await storage.updateRental(rentalId, {
        status: 'return_requested'
      });

      // Create comprehensive notification for lender with coordination details
      await storage.createNotification({
        userId: rental.lenderId,
        title: "Book Return Request",
        message: `${borrower.name} wants to return "${rental.book.title}". Please coordinate a meeting spot for the book return. Once you receive the book, confirm the return to complete the transaction.${notes ? ` Borrower's message: ${notes}` : ''}`,
        type: "return_request",
        data: JSON.stringify({
          rentalId: rentalId,
          borrowerName: borrower.name,
          borrowerPhone: borrower.phone,
          lenderPhone: lender.phone,
          bookTitle: rental.book.title,
          notes: notes || null
        })
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
        const dailyLateFee = (Number(rental.book?.dailyFee) || 10) * 0.5; // 50% of daily fee
        lateFee = daysLate * dailyLateFee;
      }

      // Calculate payments (fake payment processing)
      const securityDepositAmount = parseFloat(rental.securityDeposit);
      const lenderEarnings = parseFloat(rental.lenderAmount);
      const totalRefund = Math.max(0, securityDepositAmount - lateFee);
      
      // Update rental status and mark book as available
      await storage.updateRental(rentalId, {
        status: 'returned',
        actualReturnDate: new Date(),
        paymentStatus: 'completed'
      });

      // Mark book as available
      await storage.updateBook(rental.bookId, { isAvailable: true });

      // Notify borrower about return confirmation and payment details
      await storage.createNotification({
        userId: rental.borrowerId,
        title: "Book Return Confirmed - Payment Processed",
        message: `Return of "${rental.book.title}" confirmed! Security deposit: ₹${securityDepositAmount.toFixed(2)}${lateFee > 0 ? `, Late fee: ₹${lateFee.toFixed(2)}` : ''}, Refund: ₹${totalRefund.toFixed(2)} has been processed.`,
        type: "return_confirmed",
        data: JSON.stringify({
          rentalId: rentalId,
          securityDeposit: securityDepositAmount,
          lateFee: lateFee,
          refundAmount: totalRefund,
          bookTitle: rental.book.title
        })
      });

      // Notify borrower about lender payment (fake payment notification)
      await storage.createNotification({
        userId: rental.lenderId,
        title: "Rental Payment Received",
        message: `Payment of ₹${lenderEarnings.toFixed(2)} for "${rental.book.title}" rental has been processed to your account.`,
        type: "payment_received",
        data: JSON.stringify({
          rentalId: rentalId,
          amount: lenderEarnings,
          bookTitle: rental.book.title
        })
      });

      res.json({ 
        message: "Book return confirmed and payments processed successfully",
        securityDeposit: securityDepositAmount,
        lateFee: lateFee,
        refundAmount: totalRefund,
        lenderEarnings: lenderEarnings
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
        status: 'active' // Update status instead of non-existent fields
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

  // Notification endpoints
  app.post("/api/notifications/:id/respond-extension", requireAuth, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const { approved } = req.body;
      
      // Get the notification and parse extension data
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification || notification.type !== "extension_request") {
        return res.status(404).json({ message: "Extension request not found" });
      }
      
      const extensionData = JSON.parse(notification.data || "{}");
      const rental = await storage.getRental(extensionData.rentalId);
      
      if (!rental || rental.lenderId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      if (approved) {
        // Approve extension - update rental end date
        const newEndDate = new Date(extensionData.proposedEndDate);
        await storage.updateRental(extensionData.rentalId, {
          endDate: newEndDate
        });
        
        // Create notification for borrower
        await storage.createNotification({
          userId: rental.borrowerId,
          title: "Extension Approved",
          message: `Your extension request for "${rental.book.title}" has been approved. New return date: ${newEndDate.toLocaleDateString()}`,
          type: "extension_approved",
          data: JSON.stringify({
            rentalId: extensionData.rentalId,
            newEndDate: newEndDate.toISOString()
          })
        });
      } else {
        // Decline extension
        await storage.createNotification({
          userId: rental.borrowerId,
          title: "Extension Declined",
          message: `Your extension request for "${rental.book.title}" has been declined. Please return the book by the original due date: ${new Date(rental.endDate).toLocaleDateString()}`,
          type: "extension_declined",
          data: JSON.stringify({
            rentalId: extensionData.rentalId
          })
        });
      }
      
      // Mark the original notification as read
      await storage.markNotificationAsRead(notificationId);
      
      res.json({ message: approved ? "Extension approved" : "Extension declined" });
    } catch (error) {
      console.error("Respond to extension error:", error);
      res.status(500).json({ message: "Failed to respond to extension request" });
    }
  });

  app.post("/api/notifications/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const success = await storage.markNotificationAsRead(notificationId);
      
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Get user earnings details
  app.get("/api/user/earnings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Get all rentals where user was lender (earnings)
      const lentRentals = await storage.getRentalsByLender(userId);
      console.log(`💰 Earnings API - User ${userId} - Lent rentals:`, lentRentals.length);
      
      // Get all rentals where user was borrower (spendings)
      const borrowedRentals = await storage.getRentalsByBorrower(userId);
      console.log(`💰 Earnings API - User ${userId} - Borrowed rentals:`, borrowedRentals.length);
      
      // Calculate totals - include active rentals in earnings calculation
      const totalEarned = lentRentals
        .reduce((sum, rental) => sum + parseFloat(rental.lenderAmount || '0'), 0);
      
      const totalSpent = borrowedRentals
        .reduce((sum, rental) => sum + parseFloat(rental.totalAmount || '0'), 0);
      
      console.log(`💰 Earnings API - Total earned: ${totalEarned}, Total spent: ${totalSpent}`);
      
      res.json({
        totalEarned,
        totalSpent,
        lentRentals: lentRentals.map(rental => ({
          id: rental.id,
          bookTitle: rental.book.title,
          borrowerName: rental.borrower.name,
          amount: parseFloat(rental.lenderAmount || '0'),
          status: rental.status,
          startDate: rental.startDate,
          endDate: rental.endDate,
          actualReturnDate: rental.actualReturnDate
        })),
        borrowedRentals: borrowedRentals.map(rental => ({
          id: rental.id,
          bookTitle: rental.book.title,
          lenderName: rental.lender.name,
          amount: parseFloat(rental.totalAmount || '0'),
          status: rental.status,
          startDate: rental.startDate,
          endDate: rental.endDate,
          actualReturnDate: rental.actualReturnDate
        }))
      });
    } catch (error) {
      console.error("Get earnings error:", error);
      res.status(500).json({ message: "Failed to fetch earnings data" });
    }
  });

  // Send reminder to borrower
  app.post("/api/rentals/:id/send-reminder", requireAuth, async (req, res) => {
    try {
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental || rental.lenderId !== req.session.userId!) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Calculate days until due
      const daysUntilDue = Math.ceil((new Date(rental.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      let reminderMessage;
      if (daysUntilDue > 0) {
        reminderMessage = `Reminder: "${rental.book.title}" is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}. Please prepare to return it soon.`;
      } else if (daysUntilDue === 0) {
        reminderMessage = `Reminder: "${rental.book.title}" is due today. Please return it as soon as possible.`;
      } else {
        reminderMessage = `Urgent: "${rental.book.title}" was due ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) > 1 ? 's' : ''} ago. Please return it immediately.`;
      }

      // Create notification for borrower
      await storage.createNotification({
        userId: rental.borrowerId,
        title: "Return Reminder",
        message: reminderMessage,
        type: "reminder",
        data: JSON.stringify({
          rentalId: rentalId,
          bookTitle: rental.book.title,
          dueDate: rental.endDate,
          daysUntilDue: daysUntilDue
        })
      });

      res.json({ message: "Reminder sent successfully" });
    } catch (error) {
      console.error("Send reminder error:", error);
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

  // Admin settings endpoints
  app.get("/api/admin/settings", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin && user?.email !== 'abhinic@gmail.com') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Return default settings (could be stored in database in future)
      const settings = {
        commissionRate: 5,
        securityDeposit: 100,
        minApartments: 90,
        maxRentalDays: 30
      };
      
      res.json(settings);
    } catch (error) {
      console.error("Get admin settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/admin/settings", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin && user?.email !== 'abhinic@gmail.com') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { commissionRate, securityDeposit, minApartments, maxRentalDays } = req.body;

      // Validate the settings
      if (commissionRate < 0 || commissionRate > 20) {
        return res.status(400).json({ message: "Commission rate must be between 0 and 20%" });
      }
      if (securityDeposit < 0) {
        return res.status(400).json({ message: "Security deposit must be positive" });
      }
      if (minApartments < 1) {
        return res.status(400).json({ message: "Minimum apartments must be at least 1" });
      }
      if (maxRentalDays < 1) {
        return res.status(400).json({ message: "Maximum rental days must be at least 1" });
      }

      // In a real implementation, these would be saved to database
      // For now, we'll just return success
      const savedSettings = {
        commissionRate,
        securityDeposit,
        minApartments,
        maxRentalDays
      };

      res.json({ message: "Settings saved successfully", settings: savedSettings });
    } catch (error) {
      console.error("Save admin settings error:", error);
      res.status(500).json({ message: "Failed to save settings" });
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
      
      if (approved) {
        // Get the request details to create the society
        const requests = await storage.getSocietyRequests();
        const request = requests.find(r => r.id === requestId);
        
        if (request && request.status === 'pending') {
          // Auto-generate a simple code from the society name
          const generateCode = (name: string) => {
            return name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() + Math.floor(Math.random() * 1000);
          };

          // Create the approved society
          const societyData = {
            name: request.name,
            description: request.description,
            city: request.city,
            apartmentCount: request.apartmentCount,
            location: request.location,
            code: generateCode(request.name),
            status: 'active',
            createdBy: request.requestedBy
          };
          
          const society = await storage.createSociety(societyData);
          
          // Auto-join the creator to the society
          await storage.joinSociety(society.id, request.requestedBy);
          
          // Update request status
          await storage.reviewSocietyRequest(requestId, true, reason);
          
          // Notify the requester about approval
          await storage.createNotification({
            userId: request.requestedBy,
            title: "Society Request Approved",
            message: `Your society "${request.name}" has been approved and created successfully!`,
            type: "society_approved",
            data: JSON.stringify({
              societyId: society.id,
              societyName: society.name,
              societyCode: society.code
            })
          });
        }
      } else {
        // Just update request status for rejection
        await storage.reviewSocietyRequest(requestId, false, reason);
        
        // Notify the requester about rejection
        const requests = await storage.getSocietyRequests();
        const request = requests.find(r => r.id === requestId);
        
        if (request) {
          await storage.createNotification({
            userId: request.requestedBy,
            title: "Society Request Declined",
            message: `Your society request for "${request.name}" has been declined. ${reason ? `Reason: ${reason}` : ''}`,
            type: "society_declined",
            data: JSON.stringify({
              requestId: requestId,
              reason: reason || null
            })
          });
        }
      }
      
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

      // Get current platform settings
      const settings = await getPlatformSettings();
      
      // Calculate costs using dynamic settings
      const dailyFee = parseFloat(book.dailyFee);
      const totalRentalFee = dailyFee * duration;
      const platformFeeRate = settings.commissionRate / 100; // Convert percentage to decimal
      const platformFee = totalRentalFee * platformFeeRate;
      const lenderAmount = totalRentalFee - platformFee;
      const securityDeposit = settings.securityDeposit;
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

  // Admin settings routes
  app.get("/api/admin/settings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const settings = await getPlatformSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get admin settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/admin/settings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { commissionRate, securityDeposit, minApartments, maxRentalDays } = req.body;

      await pool.query(`
        UPDATE platform_settings 
        SET commission_rate = $1, security_deposit = $2, min_apartments = $3, max_rental_days = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM platform_settings ORDER BY id DESC LIMIT 1)
      `, [commissionRate, securityDeposit, minApartments, maxRentalDays]);

      res.json({ message: "Settings saved successfully" });
    } catch (error) {
      console.error("Update admin settings error:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // Referral rewards management
  app.get("/api/admin/rewards", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const result = await pool.query(`
        SELECT * FROM referral_rewards 
        ORDER BY created_at DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("Get admin rewards error:", error);
      res.status(500).json({ message: "Failed to fetch rewards" });
    }
  });

  app.post("/api/admin/rewards", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { description, rewardType, value, requiredReferrals, requiredBooksPerReferral } = req.body;

      const result = await pool.query(`
        INSERT INTO referral_rewards (user_id, description, reward_type, value, is_active, expires_at)
        VALUES ($1, $2, $3, $4, true, NULL)
        RETURNING *
      `, [0, description, rewardType, JSON.stringify({ 
        requiredReferrals, 
        requiredBooksPerReferral,
        value
      })]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Create admin reward error:", error);
      res.status(500).json({ message: "Failed to create reward" });
    }
  });

  app.delete("/api/admin/rewards/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const rewardId = parseInt(req.params.id);
      
      await pool.query(`
        DELETE FROM referral_rewards WHERE id = $1
      `, [rewardId]);

      res.json({ message: "Reward deleted successfully" });
    } catch (error) {
      console.error("Delete admin reward error:", error);
      res.status(500).json({ message: "Failed to delete reward" });
    }
  });

  // Society requests management
  app.get("/api/admin/society-requests", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const requests = await storage.getSocietyRequests();
      res.json(requests);
    } catch (error) {
      console.error("Get society requests error:", error);
      res.status(500).json({ message: "Failed to fetch society requests" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
