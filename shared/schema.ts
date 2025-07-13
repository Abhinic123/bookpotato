import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  address: text("address"),
  userNumber: integer("user_number").unique().notNull(),
  referredBy: integer("referred_by"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  referralCode: text("referral_code"),
  totalReferrals: integer("total_referrals").default(0).notNull(),
  referralEarnings: decimal("referral_earnings", { precision: 10, scale: 2 }).default("0").notNull(),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0").notNull(),
  rank: text("rank").default("Bronze").notNull(),
  commissionFreeUntil: timestamp("commission_free_until"),
  booksUploaded: integer("books_uploaded").default(0).notNull(),
  profilePicture: text("profile_picture"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const societies = pgTable("societies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  code: text("code").notNull().unique(),
  city: text("city").notNull(),
  apartmentCount: integer("apartment_count").notNull(),
  location: text("location"),
  createdBy: integer("created_by").notNull(),
  memberCount: integer("member_count").default(1).notNull(),
  bookCount: integer("book_count").default(0).notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const societyMembers = pgTable("society_members", {
  id: serial("id").primaryKey(),
  societyId: integer("society_id").notNull(),
  userId: integer("user_id").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  isbn: text("isbn"),
  genre: text("genre").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  coverImageUrl: text("cover_image_url"),
  condition: text("condition").notNull(),
  dailyFee: decimal("daily_fee", { precision: 10, scale: 2 }).notNull(),
  ownerId: integer("owner_id").notNull(),
  societyId: integer("society_id").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookRentals = pgTable("book_rentals", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull(),
  borrowerId: integer("borrower_id").notNull(),
  lenderId: integer("lender_id").notNull(),
  societyId: integer("society_id").notNull(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  actualReturnDate: timestamp("actual_return_date"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  lenderAmount: decimal("lender_amount", { precision: 10, scale: 2 }).notNull(),
  securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // 'active', 'returned', 'overdue'
  paymentStatus: text("payment_status").notNull(), // 'pending', 'completed', 'refunded'
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  data: text("data"), // JSON string for additional data like extension requests
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  rentalId: integer("rental_id").notNull(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referralRewards = pgTable("referral_rewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  rewardType: text("reward_type").notNull(),
  description: text("description").notNull(),
  value: text("value").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const societyRequests = pgTable("society_requests", {
  id: serial("id").primaryKey(),
  requestedBy: integer("requested_by").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  city: text("city").notNull(),
  apartmentCount: integer("apartment_count").notNull(),
  location: text("location"),
  status: text("status").default("pending").notNull(),
  reviewReason: text("review_reason"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  targetSocietyId: integer("target_society_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("5.00").notNull(),
  securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 }).default("100.00").notNull(),
  minApartments: integer("min_apartments").default(90).notNull(),
  maxRentalDays: integer("max_rental_days").default(30).notNull(),
  extensionFeePerDay: decimal("extension_fee_per_day", { precision: 10, scale: 2 }).default("10.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const extensionRequests = pgTable("extension_requests", {
  id: serial("id").primaryKey(),
  rentalId: integer("rental_id").notNull(),
  requesterId: integer("requester_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  extensionDays: integer("extension_days").notNull(),
  extensionFee: decimal("extension_fee", { precision: 10, scale: 2 }).notNull(),
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }).notNull(),
  lenderEarnings: decimal("lender_earnings", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, denied
  reason: text("reason"), // for denial reason
  paymentId: text("payment_id"), // set when approved and payment processed
  newDueDate: timestamp("new_due_date"), // calculated new due date
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentalExtensions = pgTable("rental_extensions", {
  id: serial("id").primaryKey(),
  rentalId: integer("rental_id").notNull(),
  requestId: integer("request_id"), // link to approved request (nullable for existing records)
  userId: integer("user_id").notNull(),
  lenderId: integer("lender_id").notNull(),
  extensionDays: integer("extension_days").notNull(),
  extensionFee: decimal("extension_fee", { precision: 10, scale: 2 }).notNull(),
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }).notNull(),
  lenderEarnings: decimal("lender_earnings", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"), // 'pending', 'completed', 'failed'
  paymentId: text("payment_id"),
  newDueDate: timestamp("new_due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Credits system (Brocks)
export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  balance: integer("balance").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // positive for earned, negative for spent
  type: text("type").notNull(), // 'welcome_bonus', 'referral', 'upload_bonus', 'purchase', 'spending'
  description: text("description").notNull(),
  relatedId: integer("related_id"), // related entity ID (referral ID, book ID, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referral system
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  refereeId: integer("referee_id").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'completed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// User badges
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  badgeType: text("badge_type").notNull(), // 'silver', 'gold', 'platinum'
  category: text("category").notNull(), // 'referral', 'upload'
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  value: integer("value").notNull(), // number of referrals/uploads that earned this badge
});

// Commission-free periods
export const commissionFreePeriods = pgTable("commission_free_periods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  daysRemaining: integer("days_remaining").notNull(),
  reason: text("reason").notNull(), // 'book_upload_reward', 'referral_bonus'
  relatedValue: integer("related_value"), // number of books uploaded, referrals made
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reward system settings
export const rewardSettings = pgTable("reward_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  userNumber: true,
  isAdmin: true,
  createdAt: true,
});

export const insertSocietySchema = createInsertSchema(societies).omit({
  id: true,
  memberCount: true,
  bookCount: true,
  createdAt: true,
  code: true,
  status: true,
  createdBy: true,
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  isAvailable: true,
  createdAt: true,
}).extend({
  dailyFee: z.union([z.string(), z.number()]).transform(val => String(val))
});

export const insertBookRentalSchema = createInsertSchema(bookRentals).omit({
  id: true,
  startDate: true,
  actualReturnDate: true,
  paymentId: true,
  createdAt: true,
});

export const insertSocietyMemberSchema = createInsertSchema(societyMembers).omit({
  id: true,
  isActive: true,
  joinedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  createdAt: true,
}).extend({
  data: z.string().optional().nullable(),
});

export const insertExtensionRequestSchema = createInsertSchema(extensionRequests).omit({
  id: true,
  status: true,
  approvedAt: true,
  createdAt: true,
});

export const insertRentalExtensionSchema = createInsertSchema(rentalExtensions).omit({
  id: true,
  createdAt: true,
});

export const insertUserCreditsSchema = createInsertSchema(userCredits).omit({
  id: true,
  updatedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true,
});

export const insertCommissionFreePeriodSchema = createInsertSchema(commissionFreePeriods).omit({
  id: true,
  createdAt: true,
});

export const insertRewardSettingSchema = createInsertSchema(rewardSettings).omit({
  id: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Society = typeof societies.$inferSelect;
export type InsertSociety = z.infer<typeof insertSocietySchema>;

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;

export type BookRental = typeof bookRentals.$inferSelect;
export type InsertBookRental = z.infer<typeof insertBookRentalSchema>;

export type SocietyMember = typeof societyMembers.$inferSelect;
export type InsertSocietyMember = z.infer<typeof insertSocietyMemberSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type ExtensionRequest = typeof extensionRequests.$inferSelect;
export type InsertExtensionRequest = z.infer<typeof insertExtensionRequestSchema>;

export type RentalExtension = typeof rentalExtensions.$inferSelect;
export type InsertRentalExtension = z.infer<typeof insertRentalExtensionSchema>;

export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

export type CommissionFreePeriod = typeof commissionFreePeriods.$inferSelect;
export type InsertCommissionFreePeriod = z.infer<typeof insertCommissionFreePeriodSchema>;

export type RewardSetting = typeof rewardSettings.$inferSelect;
export type InsertRewardSetting = z.infer<typeof insertRewardSettingSchema>;

// Extended types for API responses
export type BookWithOwner = Book & {
  owner: Pick<User, 'id' | 'name'>;
};

export type RentalWithDetails = BookRental & {
  book: Book;
  borrower: Pick<User, 'id' | 'name'>;
  lender: Pick<User, 'id' | 'name'>;
};

export type SocietyWithStats = Society & {
  isJoined?: boolean;
};

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertReferralRewardSchema = createInsertSchema(referralRewards).omit({
  id: true,
  createdAt: true,
});

export const insertSocietyRequestSchema = createInsertSchema(societyRequests).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type ReferralReward = typeof referralRewards.$inferSelect;
export type InsertReferralReward = z.infer<typeof insertReferralRewardSchema>;

export type SocietyRequest = typeof societyRequests.$inferSelect;
export type InsertSocietyRequest = z.infer<typeof insertSocietyRequestSchema>;

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = z.infer<typeof insertPlatformSettingsSchema>;


