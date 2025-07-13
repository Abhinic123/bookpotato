import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSocietySchema, insertBookSchema, insertBookRentalSchema, users, rentalExtensions, societyRequests } from "@shared/schema";
import { z } from "zod";
import { db, pool } from "./db";
import { sql, eq, and } from "drizzle-orm";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

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

// Google OAuth configuration
const getCallbackURL = () => {
  const domain = process.env.REPLIT_DEV_DOMAIN || '59203db4-a967-4b1c-b1d8-9d66f27d10d9-00-3bzw6spzdofx2.picard.replit.dev';
  // Ensure HTTPS protocol
  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
  return `${baseUrl}/api/auth/google/callback`;
};

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "87181857437-6dvvqvt19cd6796pq633h4eh540h480t.apps.googleusercontent.com",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "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",
  callbackURL: getCallbackURL()
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists
    let user = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
    
    if (!user) {
      // Create new user
      const userData = {
        name: profile.displayName || 'Unknown User',
        email: profile.emails?.[0]?.value || '',
        phone: '0000000000', // Default phone for OAuth users
        password: 'oauth-user', // OAuth users don't need password
        address: ''
      };
      user = await storage.createUser(userData);
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const borrowBookSchema = z.object({
  bookId: z.number(),
  duration: z.number().min(1),
  paymentMethod: z.string(),
  appliedBrocks: z.object({
    offerType: z.enum(['rupees', 'commission-free']),
    brocksUsed: z.number(),
    discountAmount: z.number(),
  }).nullable().optional(),
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
  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth routes
  app.get("/api/auth/google", (req, res, next) => {
    console.log("Initiating Google OAuth with Client ID:", process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...");
    console.log("Callback URL should be:", getCallbackURL());
    passport.authenticate("google", {
      scope: ["profile", "email"]
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", 
    passport.authenticate("google", { failureRedirect: "/auth?error=oauth_failed" }),
    async (req, res) => {
      // OAuth success - manually handle session and redirect
      console.log("Google OAuth success:", req.user);
      req.session.userId = (req.user as any)?.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/auth?error=session");
        }
        console.log("Session saved successfully, redirecting to home");
        res.redirect("/");
      });
    }
  );

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Separate referral code from user data for processing
      const { referralCode, ...restUserData } = req.body;
      const userData = insertUserSchema.parse(restUserData);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const user = await storage.createUser(userData);
      req.session.userId = user.id;
      
      // Award starting credits to new user
      const startingCreditsSetting = await storage.getRewardSetting('starting_credits');
      const startingCredits = parseInt(startingCreditsSetting?.settingValue || '100');
      
      if (startingCredits > 0) {
        await storage.awardCredits(user.id, startingCredits, "Welcome bonus for new user");
        console.log(`🎉 Awarded ${startingCredits} starting credits to new user ${user.name}`);
      }
      
      // Handle referral if provided
      if (referralCode && referralCode.trim()) {
        // Convert referral code to user number and find referrer
        const referrerUserNumber = parseInt(referralCode.trim());
        if (!isNaN(referrerUserNumber)) {
          const [referrer] = await db.select().from(users).where(eq(users.userNumber, referrerUserNumber));
          if (referrer) {
            // Award credits to referrer
            const creditsPerReferralSetting = await storage.getRewardSetting('credits_per_referral');
            const creditsPerReferral = parseInt(creditsPerReferralSetting?.settingValue || '5');
            
            if (creditsPerReferral > 0) {
              await storage.awardCredits(referrer.id, creditsPerReferral, `Referral: ${user.name} joined`);
            }
            
            // Update referrer's total referrals
            await storage.updateUser(referrer.id, {
              totalReferrals: (referrer.totalReferrals || 0) + 1
            });
            
            // Set referred by for new user
            await storage.updateUser(user.id, {
              referredBy: referrer.id
            });
            
            console.log(`🎉 Referral success: ${referrer.name} referred ${user.name}, awarded ${creditsPerReferral} credits`);
          } else {
            console.log(`⚠️ Invalid referral code: User number ${referrerUserNumber} not found`);
          }
        } else {
          console.log(`⚠️ Invalid referral code format: ${referralCode}`);
        }
      }
      
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
      
      // Initialize starting credits for existing users if they don't have any credits record
      try {
        const existingCredits = await storage.getUserCredits(user.id);
        if (!existingCredits) {
          // User has no credits record at all, award starting credits
          await storage.awardCredits(user.id, 100, "Starting credits bonus");
          console.log(`🎁 Awarded 100 starting credits to user ${user.id} (first time)`);
        }
      } catch (error) {
        console.error("Error initializing starting credits:", error);
      }
      
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

    console.log(`🔍 User ${user.id} data:`, {
      userNumber: user.userNumber,
      name: user.name,
      email: user.email
    });

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
      const platformSettings = await getPlatformSettings();
      const minApartments = platformSettings.minApartments;
      
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
      
      // Create notification for all admin users
      try {
        const user = await storage.getUser(req.session.userId!);
        
        // Get all admin users
        const adminUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.isAdmin, true));
        
        // Create notification for each admin
        for (const admin of adminUsers) {
          await storage.createNotification({
            userId: admin.id,
            title: "New Society Request",
            message: `${user?.name || 'User'} has requested to create "${validatedData.name}" society with ${validatedData.apartmentCount} apartments in ${validatedData.city}. Please review and approve.`,
            type: "society_request",
            data: JSON.stringify({
              requestId: request.id,
              societyName: validatedData.name,
              requestedBy: req.session.userId!,
              apartmentCount: validatedData.apartmentCount,
              city: validatedData.city
            })
          });
        }
      } catch (notificationError) {
        console.error("Failed to create admin notifications:", notificationError);
        // Don't fail the request if notification creation fails
      }
      
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
      
      // Award Brocks credits for book upload
      const creditsPerUploadSetting = await storage.getRewardSetting('credits_per_book_upload');
      const creditsPerUpload = parseInt(creditsPerUploadSetting?.settingValue || '1');
      
      if (creditsPerUpload > 0) {
        await storage.awardCredits(req.session.userId!, creditsPerUpload, "Book upload");
      }
      
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

  app.delete("/api/books/:id", requireAuth, async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      const book = await storage.getBook(bookId);
      
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }

      if (book.ownerId !== req.session.userId!) {
        return res.status(403).json({ message: "You can only delete your own books" });
      }

      // Check if book is currently borrowed
      if (!book.isAvailable) {
        return res.status(400).json({ message: "Cannot delete a book that is currently borrowed" });
      }

      await storage.deleteBook(bookId);
      res.json({ message: "Book deleted successfully" });
    } catch (error) {
      console.error("Delete book error:", error);
      res.status(400).json({ message: "Failed to delete book" });
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

  // Society request approval via notifications
  app.post("/api/notifications/:id/respond-society", requireAuth, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const { approved, reason } = req.body;
      
      // Check if user is admin
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin && user?.email !== 'abhinic@gmail.com') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification || notification.type !== "society_request") {
        return res.status(404).json({ message: "Society request not found" });
      }
      
      const requestData = JSON.parse(notification.data || "{}");
      const requestId = requestData.requestId;
      
      console.log('Processing society request from notification:', { requestId, approved, reason, requestData });
      
      // Update the society request status using the existing admin endpoint logic
      await storage.reviewSocietyRequest(requestId, approved, reason);
      
      // Mark the notification as read
      await storage.markNotificationAsRead(notificationId);
      
      // Create notification for the requester
      const requesterUserId = requestData.requestedBy;
      await storage.createNotification({
        userId: requesterUserId,
        title: approved ? "Society Request Approved" : "Society Request Rejected",
        message: approved 
          ? `Your request to create "${requestData.societyName}" society has been approved!`
          : `Your request to create "${requestData.societyName}" society has been rejected. ${reason ? `Reason: ${reason}` : ''}`,
        type: approved ? "society_approved" : "society_rejected",
        data: JSON.stringify({
          requestId,
          societyName: requestData.societyName,
          reason: reason || null
        })
      });
      
      res.json({ message: approved ? "Society request approved" : "Society request rejected" });
    } catch (error) {
      console.error("Respond to society request error:", error);
      res.status(500).json({ message: "Failed to respond to society request" });
    }
  });

  // Admin Brocks settings endpoint
  app.post("/api/admin/brocks-settings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { 
        // New comprehensive reward settings
        credits_per_book_upload,
        credits_per_referral,
        credits_per_borrow,
        credits_per_lend,
        credits_for_commission_free_days,
        commission_free_days_per_conversion,
        credits_for_rupees_conversion,
        rupees_per_credit_conversion,
        
        // Legacy settings
        opening_credits, 
        silver_referrals, 
        gold_referrals, 
        platinum_referrals,
        upload_10_reward,
        upload_20_reward,
        upload_30_reward,
        credit_value_rupees
      } = req.body;

      // Update reward settings in the database
      const settingsToUpdate = [
        // New comprehensive settings
        { key: 'credits_per_book_upload', value: credits_per_book_upload.toString() },
        { key: 'credits_per_referral', value: credits_per_referral.toString() },
        { key: 'credits_per_borrow', value: credits_per_borrow.toString() },
        { key: 'credits_per_lend', value: credits_per_lend.toString() },
        { key: 'credits_for_commission_free_days', value: credits_for_commission_free_days.toString() },
        { key: 'commission_free_days_per_conversion', value: commission_free_days_per_conversion.toString() },
        { key: 'credits_for_rupees_conversion', value: credits_for_rupees_conversion.toString() },
        { key: 'rupees_per_credit_conversion', value: rupees_per_credit_conversion.toString() },
        
        // Legacy settings
        { key: 'opening_credits', value: opening_credits.toString() },
        { key: 'silver_referrals', value: silver_referrals.toString() },
        { key: 'gold_referrals', value: gold_referrals.toString() },
        { key: 'platinum_referrals', value: platinum_referrals.toString() },
        { key: 'upload_10_reward', value: upload_10_reward.toString() },
        { key: 'upload_20_reward', value: upload_20_reward.toString() },
        { key: 'upload_30_reward', value: upload_30_reward.toString() },
        { key: 'credit_value_rupees', value: credit_value_rupees.toString() }
      ];

      for (const setting of settingsToUpdate) {
        await storage.updateRewardSetting(setting.key, setting.value);
      }

      res.json({ message: "Brocks settings updated successfully" });
    } catch (error) {
      console.error("Update Brocks settings error:", error);
      res.status(500).json({ message: "Failed to update Brocks settings" });
    }
  });

  // Get user Brocks credits
  app.get("/api/user/credits", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      let credits = await storage.getUserCredits(userId);
      
      // If user has no credits, award starting credits
      if (!credits || (credits.balance === 0 && credits.totalEarned === 0)) {
        const startingCreditsSetting = await storage.getRewardSetting('starting_credits');
        const startingCredits = parseInt(startingCreditsSetting?.settingValue || '100');
        
        if (startingCredits > 0) {
          await storage.awardCredits(userId, startingCredits, "Welcome bonus for existing user");
          console.log(`🎉 Awarded ${startingCredits} starting credits to user ${userId}`);
          
          // Get updated credits
          credits = await storage.getUserCredits(userId);
        }
      }
      
      res.json(credits || { balance: 0, totalEarned: 0 });
    } catch (error) {
      console.error("Get user credits error:", error);
      res.status(500).json({ message: "Failed to fetch user credits" });
    }
  });

  // Initialize starting credits for user
  app.post("/api/user/initialize-credits", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Check if user already has credits
      const existingCredits = await storage.getUserCredits(userId);
      if (existingCredits) {
        return res.json({ message: "User already has credits", credits: existingCredits });
      }
      
      // Award starting credits (100 by default)
      await storage.awardCredits(userId, 100, "Starting credits bonus");
      
      const newCredits = await storage.getUserCredits(userId);
      res.json({ message: "Starting credits awarded", credits: newCredits });
    } catch (error) {
      console.error("Initialize credits error:", error);
      res.status(500).json({ message: "Failed to initialize credits" });
    }
  });

  // Get user badges
  app.get("/api/user/badges", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const badges = await storage.getUserBadges(userId);
      res.json(badges || []);
    } catch (error) {
      console.error("Get user badges error:", error);
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });

  // Get Brocks conversion rates for offers
  app.get("/api/admin/brocks-conversion-rates", requireAuth, async (req, res) => {
    try {
      const creditsToRupeesRate = await storage.getRewardSetting('credits_to_rupees_rate');
      const creditsToCommissionFreeRate = await storage.getRewardSetting('credits_to_commission_free_rate');

      res.json({
        creditsToRupeesRate: creditsToRupeesRate?.settingValue || '20',
        creditsToCommissionFreeRate: creditsToCommissionFreeRate?.settingValue || '20'
      });
    } catch (error) {
      console.error("Get Brocks conversion rates error:", error);
      res.status(500).json({ message: "Failed to fetch conversion rates" });
    }
  });

  // Apply Brocks to payment calculation
  app.post("/api/payments/apply-brocks", requireAuth, async (req, res) => {
    try {
      const { offerType, brocksUsed, originalAmount } = req.body;
      const userId = req.session.userId!;

      const result = await storage.applyBrocksToPayment(userId, offerType, brocksUsed, originalAmount);
      
      res.json({
        originalAmount,
        newAmount: result.newAmount,
        brocksSpent: result.brocksSpent,
        discount: originalAmount - result.newAmount
      });
    } catch (error) {
      console.error("Apply Brocks to payment error:", error);
      res.status(500).json({ message: error.message || "Failed to apply Brocks to payment" });
    }
  });

  // Manual award credits (temporary endpoint for fixing existing users)
  app.post("/api/user/manual-award-credits", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { credits, reason } = req.body;
      
      if (!credits || credits <= 0) {
        return res.status(400).json({ message: "Invalid credits amount" });
      }
      
      // Award credits directly
      await storage.awardCredits(userId, credits, reason || "Manual credit award");
      
      const updatedCredits = await storage.getUserCredits(userId);
      res.json({ message: "Credits awarded successfully", credits: updatedCredits });
    } catch (error) {
      console.error("Manual award credits error:", error);
      res.status(500).json({ message: "Failed to award credits" });
    }
  });

  // Get user recent rewards
  app.get("/api/user/recent-rewards", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const rewards = await storage.getUserRecentRewards(userId);
      res.json(rewards || []);
    } catch (error) {
      console.error("Get user recent rewards error:", error);
      res.status(500).json({ message: "Failed to fetch user recent rewards" });
    }
  });

  // Convert Brocks credits to commission-free days
  app.post("/api/user/convert-credits-to-commission-free", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Get conversion rates from settings
      const creditsRequiredSetting = await storage.getRewardSetting('credits_for_commission_free_days');
      const daysPerConversionSetting = await storage.getRewardSetting('commission_free_days_per_conversion');
      
      const creditsRequired = parseInt(creditsRequiredSetting?.settingValue || '20');
      const daysPerConversion = parseInt(daysPerConversionSetting?.settingValue || '7');
      
      // Check if user has enough credits
      const userCredits = await storage.getUserCredits(userId);
      if (!userCredits || userCredits.balance < creditsRequired) {
        return res.status(400).json({ message: "Insufficient credits for conversion" });
      }
      
      // Deduct credits
      const success = await storage.deductCredits(userId, creditsRequired, "Converted to commission-free days");
      if (!success) {
        return res.status(400).json({ message: "Failed to deduct credits" });
      }
      
      // Add commission-free period
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysPerConversion);
      
      await storage.createCommissionFreePeriod({
        userId,
        startDate: new Date(),
        endDate,
        daysRemaining: daysPerConversion,
        isActive: true,
        reason: `Converted ${creditsRequired} Brocks credits`
      });
      
      res.json({ 
        message: "Successfully converted credits to commission-free days",
        creditsDeducted: creditsRequired,
        daysAdded: daysPerConversion
      });
    } catch (error) {
      console.error("Convert credits to commission-free error:", error);
      res.status(500).json({ message: "Failed to convert credits" });
    }
  });

  // Convert Brocks credits to rupees
  app.post("/api/user/convert-credits-to-rupees", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Get conversion rates from settings
      const creditsRequiredSetting = await storage.getRewardSetting('credits_for_rupees_conversion');
      const rupeesPerCreditSetting = await storage.getRewardSetting('rupees_per_credit_conversion');
      
      const creditsRequired = parseInt(creditsRequiredSetting?.settingValue || '20');
      const rupeesPerCredit = parseFloat(rupeesPerCreditSetting?.settingValue || '1');
      
      // Check if user has enough credits
      const userCredits = await storage.getUserCredits(userId);
      if (!userCredits || userCredits.balance < creditsRequired) {
        return res.status(400).json({ message: "Insufficient credits for conversion" });
      }
      
      // Deduct credits
      const success = await storage.deductCredits(userId, creditsRequired, "Converted to rupees");
      if (!success) {
        return res.status(400).json({ message: "Failed to deduct credits" });
      }
      
      const rupeesEarned = creditsRequired * rupeesPerCredit;
      
      // Update user earnings (add to total earnings)
      const user = await storage.getUser(userId);
      if (user) {
        const currentEarnings = parseFloat(user.totalEarnings || '0');
        await storage.updateUser(userId, {
          totalEarnings: (currentEarnings + rupeesEarned).toString()
        });
      }
      
      res.json({ 
        message: "Successfully converted credits to rupees",
        creditsDeducted: creditsRequired,
        rupeesEarned: rupeesEarned
      });
    } catch (error) {
      console.error("Convert credits to rupees error:", error);
      res.status(500).json({ message: "Failed to convert credits" });
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
      
      // Calculate earnings from regular rentals
      const totalEarned = lentRentals
        .reduce((sum, rental) => sum + parseFloat(rental.lenderAmount || '0'), 0);
      
      // Calculate spending from regular rentals
      const totalSpent = borrowedRentals
        .reduce((sum, rental) => sum + parseFloat(rental.totalAmount || '0'), 0);

      // Add extension earnings for lent books
      const extensionEarnings = await db
        .select({ 
          total: sql<string>`COALESCE(SUM(CAST(${rentalExtensions.lenderEarnings} AS DECIMAL)), 0)` 
        })
        .from(rentalExtensions)
        .where(and(
          eq(rentalExtensions.lenderId, userId),
          eq(rentalExtensions.paymentStatus, 'completed')
        ));

      // Add extension spending for borrowed books
      const extensionSpending = await db
        .select({ 
          total: sql<string>`COALESCE(SUM(CAST(${rentalExtensions.extensionFee} AS DECIMAL)), 0)` 
        })
        .from(rentalExtensions)
        .where(and(
          eq(rentalExtensions.userId, userId),
          eq(rentalExtensions.paymentStatus, 'completed')
        ));

      const finalTotalEarned = totalEarned + parseFloat(extensionEarnings[0]?.total || '0');
      const finalTotalSpent = totalSpent + parseFloat(extensionSpending[0]?.total || '0');
      
      console.log(`💰 Earnings API - Total earned: ${finalTotalEarned} (rental: ${totalEarned} + extensions: ${parseFloat(extensionEarnings[0]?.total || '0')}), Total spent: ${finalTotalSpent} (rental: ${totalSpent} + extensions: ${parseFloat(extensionSpending[0]?.total || '0')})`);
      
      res.json({
        totalEarned: finalTotalEarned,
        totalSpent: finalTotalSpent,
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
      console.log('Admin Panel: Reviewing society request', { requestId, approved, reason, userEmail: user?.email, isAdmin: user?.isAdmin });
      
      if (approved) {
        // Get the specific request details to create the society
        const allRequests = await db.select().from(societyRequests).where(eq(societyRequests.id, requestId));
        const request = allRequests[0];
        
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
        
        // Get the specific request for notification
        const allRequests = await db.select().from(societyRequests).where(eq(societyRequests.id, requestId));
        const request = allRequests[0];
        
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
      const { bookId, duration, paymentMethod, appliedBrocks } = borrowBookSchema.parse(req.body);
      
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
      const rentalFee = dailyFee * duration; // Amount lender should receive
      const platformFeeRate = settings.commissionRate / 100; // Convert percentage to decimal
      const platformFee = rentalFee * platformFeeRate; // Platform commission on top
      const lenderAmount = rentalFee; // Lender gets full rental amount
      const securityDeposit = settings.securityDeposit;
      let totalAmount = rentalFee + platformFee + securityDeposit; // Borrower pays rental + commission + deposit

      // Apply Brocks discount if provided and deduct credits
      if (appliedBrocks && appliedBrocks.brocksUsed > 0) {
        // First, deduct the Brocks credits from user's balance
        const deductionSuccess = await storage.deductCredits(req.session.userId!, appliedBrocks.brocksUsed, `Used for rental discount - ${book.title}`);
        
        if (!deductionSuccess) {
          return res.status(400).json({ message: "Insufficient Brocks credits for the applied discount" });
        }
        
        if (appliedBrocks.offerType === 'rupees') {
          totalAmount = Math.max(0, totalAmount - appliedBrocks.discountAmount);
          console.log(`💰 Applied ${appliedBrocks.brocksUsed} Brocks for ₹${appliedBrocks.discountAmount} discount. New total: ₹${totalAmount}`);
        } else if (appliedBrocks.offerType === 'commission-free') {
          // For commission-free, we eliminate the platform fee
          totalAmount = rentalFee + securityDeposit; // Remove platform fee from total
          lenderAmount = rentalFee; // Lender still gets full rental amount
          platformFee = 0; // No platform fee
          console.log(`🎁 Applied ${appliedBrocks.brocksUsed} Brocks for commission-free benefits. Platform fee waived: ₹${platformFeeRate * rentalFee}`);
        }
      }

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
      
      // Award Brocks credits for borrow and lend transactions
      const creditsPerBorrowSetting = await storage.getRewardSetting('credits_per_borrow');
      const creditsPerLendSetting = await storage.getRewardSetting('credits_per_lend');
      
      const creditsPerBorrow = parseInt(creditsPerBorrowSetting?.settingValue || '5');
      const creditsPerLend = parseInt(creditsPerLendSetting?.settingValue || '5');
      
      // Award credits to borrower
      if (creditsPerBorrow > 0) {
        try {
          await storage.awardCredits(req.session.userId!, creditsPerBorrow, "Borrowed a book");
          console.log(`✅ Successfully awarded ${creditsPerBorrow} credits to borrower ${req.session.userId!}`);
        } catch (error) {
          console.error(`❌ Failed to award credits to borrower:`, error);
        }
      }
      
      // Award credits to lender
      if (creditsPerLend > 0) {
        try {
          await storage.awardCredits(book.ownerId, creditsPerLend, "Lent a book");
          console.log(`✅ Successfully awarded ${creditsPerLend} credits to lender ${book.ownerId}`);
        } catch (error) {
          console.error(`❌ Failed to award credits to lender:`, error);
        }
      }
      
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

  // Brocks purchase endpoint
  app.post("/api/brocks/purchase", requireAuth, async (req, res) => {
    try {
      const { packageId, paymentMethod } = req.body;
      
      // Define available packages
      const packages = {
        starter: { brocks: 50, price: 99, bonus: 0 },
        value: { brocks: 100, price: 179, bonus: 10 },
        premium: { brocks: 250, price: 399, bonus: 50 },
        mega: { brocks: 500, price: 749, bonus: 150 },
      };
      
      const selectedPackage = packages[packageId as keyof typeof packages];
      if (!selectedPackage) {
        return res.status(400).json({ message: "Invalid package selected" });
      }
      
      const totalBrocks = selectedPackage.brocks + selectedPackage.bonus;
      
      // Simulate payment processing (in real app, integrate with payment gateway)
      console.log(`💳 Processing payment: ₹${selectedPackage.price} for ${totalBrocks} Brocks via ${paymentMethod}`);
      
      // Award Brocks credits to user
      await storage.awardCredits(
        req.session.userId!, 
        totalBrocks, 
        `Purchased ${selectedPackage.brocks} + ${selectedPackage.bonus} bonus Brocks`
      );
      
      console.log(`🎁 Awarded ${totalBrocks} Brocks to user ${req.session.userId!} via purchase`);
      
      res.json({
        success: true,
        brocksAwarded: totalBrocks,
        transactionId: `txn_${Date.now()}`,
        message: "Payment processed successfully"
      });
    } catch (error) {
      console.error("Brocks purchase error:", error);
      res.status(500).json({ message: "Failed to process purchase" });
    }
  });

  // Brocks leaderboard endpoint
  app.get("/api/brocks/leaderboard", requireAuth, async (req, res) => {
    try {
      const leaderboard = await storage.getBrocksLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Brocks leaderboard error:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
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
  // Public platform settings endpoint (no auth required)
  app.get("/api/platform/settings", async (req, res) => {
    try {
      const settings = await getPlatformSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get platform settings error:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

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

      const { commissionRate, securityDeposit, minApartments, maxRentalDays, extensionFeePerDay } = req.body;

      console.log('Updating platform settings:', { commissionRate, securityDeposit, minApartments, maxRentalDays, extensionFeePerDay });

      const updateResult = await pool.query(`
        UPDATE platform_settings 
        SET commission_rate = $1, security_deposit = $2, min_apartments = $3, max_rental_days = $4, extension_fee_per_day = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        RETURNING *
      `, [commissionRate, securityDeposit, minApartments, maxRentalDays, extensionFeePerDay || 10]);

      console.log('Update result:', updateResult.rows[0]);

      // Clear any cached platform settings to force refresh across the platform
      console.log('✅ Platform settings updated successfully. All platform components will use new values.');

      res.json({ message: "Settings saved successfully" });
    } catch (error) {
      console.error("Update admin settings error:", error);
      res.status(500).json({ message: "Failed to save settings" });
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

  // Extension payment processing
  app.post("/api/rentals/extensions/calculate", requireAuth, async (req, res) => {
    try {
      const { rentalId, extensionDays } = req.body;
      
      const rental = await storage.getRental(rentalId);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }

      // Only the borrower can request extension
      if (rental.borrowerId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const settings = await getPlatformSettings();
      // Use the book's actual daily fee for extension calculation
      const extensionFeePerDay = parseFloat(rental.book.dailyFee);
      const commissionRate = parseFloat(settings.commissionRate) / 100;

      const extensionRentalFee = extensionFeePerDay * extensionDays;
      const platformCommission = extensionRentalFee * commissionRate;
      const lenderEarnings = extensionRentalFee; // Lender gets full extension amount
      const totalExtensionFee = extensionRentalFee + platformCommission; // Borrower pays rental + commission

      console.log('Extension calculation:', {
        bookTitle: rental.book.title,
        bookDailyFee: rental.book.dailyFee,
        extensionDays,
        extensionFeePerDay,
        extensionRentalFee,
        platformCommission,
        lenderEarnings,
        totalExtensionFee
      });

      res.json({
        extensionDays,
        extensionFeePerDay,
        totalExtensionFee,
        platformCommission,
        lenderEarnings,
        commissionRate: settings.commissionRate
      });
    } catch (error) {
      console.error("Extension calculation error:", error);
      res.status(500).json({ message: "Failed to calculate extension cost" });
    }
  });

  app.post("/api/rentals/extensions/create-payment", requireAuth, async (req, res) => {
    try {
      const { rentalId, extensionDays, totalAmount } = req.body;
      
      const rental = await storage.getRental(rentalId);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }

      if (rental.borrowerId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Create dummy payment intent (simulating Stripe/Razorpay)
      const paymentId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      res.json({
        paymentId,
        clientSecret: `${paymentId}_secret`,
        amount: totalAmount
      });
    } catch (error) {
      console.error("Extension payment creation error:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Create extension request (replaces direct payment processing)
  app.post("/api/rentals/extensions/request", requireAuth, async (req, res) => {
    try {
      const { rentalId, extensionDays } = req.body;
      const userId = req.session.userId!;
      
      console.log('Extension request:', { rentalId, extensionDays, userId });

      if (!rentalId || !extensionDays) {
        return res.status(400).json({ 
          message: "Missing required fields: rentalId, extensionDays" 
        });
      }

      // Get rental details
      const rental = await storage.getRental(rentalId);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }

      // Verify user is the borrower
      if (rental.borrowerId !== userId) {
        return res.status(403).json({ message: "Unauthorized - you are not the borrower" });
      }

      // Get platform settings
      const settings = await getPlatformSettings();
      const commissionRate = parseFloat(settings.commissionRate) / 100;

      // Calculate extension costs using the book's actual daily fee
      const extensionFeePerDay = parseFloat(rental.book.dailyFee);
      const extensionRentalFee = extensionFeePerDay * extensionDays;
      const platformCommission = extensionRentalFee * commissionRate;
      const lenderEarnings = extensionRentalFee; // Lender gets full extension amount
      const totalExtensionFee = extensionRentalFee + platformCommission; // Borrower pays rental + commission

      // Calculate new due date
      let currentDueDate = rental.dueDate ? new Date(rental.dueDate) : new Date(rental.endDate);
      if (!currentDueDate || isNaN(currentDueDate.getTime())) {
        currentDueDate = rental.endDate ? new Date(rental.endDate) : new Date();
      }
      
      const newDueDate = new Date(currentDueDate);
      newDueDate.setDate(currentDueDate.getDate() + extensionDays);

      // Create extension request
      const extensionRequest = await storage.createExtensionRequest({
        rentalId,
        requesterId: userId,
        ownerId: rental.lenderId,
        extensionDays,
        extensionFee: totalExtensionFee.toString(),
        platformCommission: platformCommission.toString(),
        lenderEarnings: lenderEarnings.toString(),
        status: 'pending',
        newDueDate
      });

      // Create notification for the book owner
      await storage.createNotification({
        userId: rental.lenderId,
        title: "Extension Request Received",
        message: `${rental.borrower.name} wants to extend "${rental.book.title}" for ${extensionDays} days. You'll earn ₹${lenderEarnings.toFixed(2)}.`,
        type: "extension_request",
        data: JSON.stringify({ requestId: extensionRequest.id })
      });

      res.json({
        success: true,
        message: "Extension request sent to book owner",
        requestId: extensionRequest.id,
        extensionFee: totalExtensionFee,
        lenderEarnings
      });

    } catch (error: any) {
      console.error('Extension request error:', error);
      res.status(500).json({ 
        message: "Failed to create extension request",
        error: error.message 
      });
    }
  });

  // Get extension requests for owner
  app.get("/api/rentals/extensions/requests", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const requests = await storage.getExtensionRequestsByOwner(userId);
      
      // Enrich requests with rental and book details
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const rental = await storage.getRental(request.rentalId);
          return {
            ...request,
            rental: rental ? {
              id: rental.id,
              book: rental.book,
              borrower: rental.borrower
            } : null
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error: any) {
      console.error('Error fetching extension requests:', error);
      res.status(500).json({ message: "Failed to fetch extension requests" });
    }
  });

  // Approve extension request
  app.post("/api/rentals/extensions/requests/:requestId/approve", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const userId = req.session.userId!;
      
      const request = await storage.getExtensionRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Extension request not found" });
      }

      if (request.ownerId !== userId) {
        return res.status(403).json({ message: "Unauthorized - you are not the book owner" });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: "Request already processed" });
      }

      // Approve the request
      await storage.approveExtensionRequest(requestId);

      // Get rental details for notifications
      const rental = await storage.getRental(request.rentalId);
      if (rental) {
        // Create notification for borrower about approval with payment details
        await storage.createNotification({
          userId: request.requesterId,
          title: "Extension Request Approved",
          message: `Your extension request for "${rental.book.title}" has been approved! Click "Pay Now" to complete the extension.`,
          type: "extension_approved",
          data: JSON.stringify({ 
            requestId, 
            rentalId: request.rentalId,
            bookTitle: rental.book.title,
            extensionDays: request.extensionDays,
            totalAmount: parseFloat(request.extensionFee.toString()),
            platformCommission: parseFloat(request.platformCommission.toString()),
            lenderEarnings: parseFloat(request.lenderEarnings.toString()),
            newDueDate: request.newDueDate?.toISOString(),
            paymentRequired: true
          })
        });
      }

      res.json({
        success: true,
        message: "Extension request approved",
        requestId
      });

    } catch (error: any) {
      console.error('Error approving extension request:', error);
      res.status(500).json({ message: "Failed to approve extension request" });
    }
  });

  // Deny extension request
  app.post("/api/rentals/extensions/requests/:requestId/deny", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const { reason } = req.body;
      const userId = req.session.userId!;
      
      const request = await storage.getExtensionRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Extension request not found" });
      }

      if (request.ownerId !== userId) {
        return res.status(403).json({ message: "Unauthorized - you are not the book owner" });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: "Request already processed" });
      }

      // Deny the request
      await storage.denyExtensionRequest(requestId, reason || "No reason provided");

      // Get rental details for notifications
      const rental = await storage.getRental(request.rentalId);
      if (rental) {
        // Create notification for borrower about denial
        await storage.createNotification({
          userId: request.requesterId,
          title: "Extension Request Denied",
          message: `Your extension request for "${rental.book.title}" has been denied. Reason: ${reason || "No reason provided"}`,
          type: "extension_denied",
          data: JSON.stringify({ requestId, rentalId: request.rentalId })
        });
      }

      res.json({
        success: true,
        message: "Extension request denied",
        requestId
      });

    } catch (error: any) {
      console.error('Error denying extension request:', error);
      res.status(500).json({ message: "Failed to deny extension request" });
    }
  });

  // Process payment for approved extension request
  app.post("/api/rentals/extensions/requests/:requestId/pay", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const userId = req.session.userId!;
      
      const request = await storage.getExtensionRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Extension request not found" });
      }

      if (request.requesterId !== userId) {
        return res.status(403).json({ message: "Unauthorized - you are not the requester" });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ message: "Request is not approved for payment" });
      }

      if (request.paymentId) {
        return res.status(400).json({ message: "Payment already processed for this request" });
      }

      // Get rental details
      const rental = await storage.getRental(request.rentalId);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }

      // Create dummy payment ID (simulating payment processing)
      const paymentId = `ext_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate new due date
      const currentEndDate = new Date(rental.endDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(currentEndDate.getDate() + request.extensionDays);

      // Update the rental with new end date
      await storage.updateRental(request.rentalId, {
        endDate: newEndDate
      });

      // Update extension request with payment info
      await storage.updateRentalExtensionPayment(requestId, paymentId, 'completed');

      // Create extension record for tracking
      await storage.createRentalExtension({
        rentalId: request.rentalId,
        requestId: request.id,
        userId: request.requesterId, // borrower
        lenderId: request.ownerId, // book owner
        extensionDays: request.extensionDays,
        extensionFee: request.extensionFee,
        platformCommission: request.platformCommission,
        lenderEarnings: request.lenderEarnings,
        paymentId,
        paymentStatus: 'completed',
        newDueDate: newEndDate
      });

      // Create success notification for borrower
      await storage.createNotification({
        userId: request.requesterId,
        title: "Extension Payment Successful",
        message: `Payment successful! Your book "${rental.book.title}" has been extended for ${request.extensionDays} days. New due date: ${newEndDate.toLocaleDateString()}`,
        type: "extension_completed",
        data: JSON.stringify({ 
          rentalId: request.rentalId,
          extensionDays: request.extensionDays,
          newDueDate: newEndDate.toISOString(),
          paymentId,
          paymentRequired: false  // Payment completed
        })
      });

      // Create earnings notification for book owner
      await storage.createNotification({
        userId: request.ownerId,
        title: "Extension Payment Received",
        message: `You've earned ₹${parseFloat(request.lenderEarnings.toString()).toFixed(2)} from the extension of "${rental.book.title}"`,
        type: "earnings_notification",
        data: JSON.stringify({ 
          rentalId: request.rentalId,
          earnings: parseFloat(request.lenderEarnings.toString()),
          paymentId
        })
      });

      res.json({
        success: true,
        message: "Extension payment processed successfully",
        newDueDate: newEndDate.toISOString(),
        paymentId,
        extensionDays: request.extensionDays
      });

    } catch (error: any) {
      console.error('Error processing extension payment:', error);
      res.status(500).json({ message: "Failed to process extension payment" });
    }
  });

  // Process payment for approved extension request
  app.post("/api/rentals/extensions/requests/:requestId/process-payment", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const { paymentId } = req.body;
      const userId = req.session.userId!;
      
      const request = await storage.getExtensionRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Extension request not found" });
      }

      if (request.requesterId !== userId) {
        return res.status(403).json({ message: "Unauthorized - you are not the requester" });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ message: "Request not approved" });
      }

      // Get rental details
      const rental = await storage.getRental(request.rentalId);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }

      // Create rental extension record
      const extension = await storage.createRentalExtension({
        rentalId: request.rentalId,
        requestId: requestId,
        userId: request.requesterId,
        lenderId: request.ownerId,
        extensionDays: request.extensionDays,
        extensionFee: request.extensionFee,
        platformCommission: request.platformCommission,
        lenderEarnings: request.lenderEarnings,
        paymentStatus: 'completed',
        paymentId,
        newDueDate: request.newDueDate!
      });
      
      // Update the extension request to mark as paid
      await storage.updateExtensionRequest(requestId, { 
        paymentId: paymentId 
      });

      // Update rental due date
      await storage.updateRental(request.rentalId, {
        endDate: request.newDueDate!
      });

      // Update lender's earnings
      await db.update(users)
        .set({
          totalEarnings: sql`${users.totalEarnings} + ${parseFloat(request.lenderEarnings)}`
        })
        .where(eq(users.id, request.ownerId));

      // Create notification for the lender about payment
      await storage.createNotification({
        userId: request.ownerId,
        title: "Extension Payment Received",
        message: `You earned ₹${parseFloat(request.lenderEarnings).toFixed(2)} from a ${request.extensionDays}-day extension for "${rental.book.title}".`,
        type: "extension_payment"
      });

      res.json({
        success: true,
        message: "Extension payment processed successfully",
        newDueDate: request.newDueDate,
        extensionFee: parseFloat(request.extensionFee),
        lenderEarnings: parseFloat(request.lenderEarnings)
      });

    } catch (error: any) {
      console.error('Extension payment processing error:', error);
      res.status(500).json({ 
        message: "Failed to process extension payment",
        error: error.message 
      });
    }
  });

  // Credits and Rewards System Routes
  
  // Get user credits and statistics
  app.get("/api/user/credits", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      let userCredits = await storage.getUserCredits(userId);
      if (!userCredits) {
        // Create initial credits account with starting balance  
        const startingCredits = await storage.getRewardSetting('starting_credits');
        const initialBalance = parseInt(startingCredits?.settingValue || '100');
        
        userCredits = await storage.createUserCredits({
          userId,
          balance: initialBalance,
          totalEarned: initialBalance,
          totalSpent: 0
        });
        
        // Add welcome bonus transaction
        await storage.addCreditTransaction({
          userId,
          amount: initialBalance,
          type: 'welcome_bonus',
          description: 'Welcome bonus - Initial Brocks credit',
          relatedId: null
        });
      }
      
      const transactions = await storage.getCreditTransactions(userId);
      const badges = await storage.getUserBadges(userId);
      const referralCount = await storage.getReferralCount(userId);
      const commissionFreePeriods = await storage.getActiveCommissionFreePeriods(userId);
      
      res.json({
        credits: userCredits,
        transactions,
        badges,
        referralCount,
        commissionFreePeriods
      });
    } catch (error) {
      console.error("Get user credits error:", error);
      res.status(500).json({ message: "Failed to fetch user credits" });
    }
  });

  // Get reward settings for admin
  app.get("/api/admin/rewards/settings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const settings = await storage.getAllRewardSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get reward settings error:", error);
      res.status(500).json({ message: "Failed to fetch reward settings" });
    }
  });

  // Update reward settings
  app.post("/api/admin/rewards/settings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { settings } = req.body;
      
      for (const setting of settings) {
        await storage.updateRewardSetting(setting.key, setting.value);
      }
      
      res.json({ message: "Reward settings updated successfully" });
    } catch (error) {
      console.error("Update reward settings error:", error);
      res.status(500).json({ message: "Failed to update reward settings" });
    }
  });

  // Get user referrals and badge progress
  app.get("/api/user/referrals", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const referrals = await storage.getReferralsByUser(userId);
      const referralCount = await storage.getReferralCount(userId);
      const badges = await storage.getUserBadges(userId);
      
      // Get badge thresholds
      const silverThreshold = await storage.getRewardSetting('silver_referrals');
      const goldThreshold = await storage.getRewardSetting('gold_referrals');
      const platinumThreshold = await storage.getRewardSetting('platinum_referrals');
      
      const badgeProgress = {
        silver: {
          threshold: parseInt(silverThreshold?.settingValue || '5'),
          current: referralCount,
          earned: badges.some(b => b.badgeType === 'silver' && b.category === 'referral')
        },
        gold: {
          threshold: parseInt(goldThreshold?.settingValue || '10'),
          current: referralCount,
          earned: badges.some(b => b.badgeType === 'gold' && b.category === 'referral')
        },
        platinum: {
          threshold: parseInt(platinumThreshold?.settingValue || '15'),
          current: referralCount,
          earned: badges.some(b => b.badgeType === 'platinum' && b.category === 'referral')
        }
      };
      
      res.json({
        referrals,
        referralCount,
        badgeProgress,
        badges: badges.filter(b => b.category === 'referral')
      });
    } catch (error) {
      console.error("Get user referrals error:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Get upload rewards progress
  app.get("/api/user/upload-rewards", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const user = await storage.getUser(userId);
      const booksUploaded = user?.booksUploaded || 0;
      const badges = await storage.getUserBadges(userId);
      const commissionFreePeriods = await storage.getActiveCommissionFreePeriods(userId);
      
      // Get upload reward thresholds
      const upload10Reward = await storage.getRewardSetting('upload_10_reward');
      const upload20Reward = await storage.getRewardSetting('upload_20_reward');
      const upload30Reward = await storage.getRewardSetting('upload_30_reward');
      
      const uploadProgress = {
        books10: {
          threshold: 10,
          current: booksUploaded,
          reward: parseInt(upload10Reward?.settingValue || '10'),
          earned: booksUploaded >= 10
        },
        books20: {
          threshold: 20,
          current: booksUploaded,
          reward: parseInt(upload20Reward?.settingValue || '20'),
          earned: booksUploaded >= 20
        },
        books30: {
          threshold: 30,
          current: booksUploaded,
          reward: parseInt(upload30Reward?.settingValue || '60'),
          earned: booksUploaded >= 30
        }
      };
      
      res.json({
        booksUploaded,
        uploadProgress,
        badges: badges.filter(b => b.category === 'upload'),
        commissionFreePeriods
      });
    } catch (error) {
      console.error("Get upload rewards error:", error);
      res.status(500).json({ message: "Failed to fetch upload rewards" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
