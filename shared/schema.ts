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
  userNumber: integer("user_number").unique(),
  referredBy: integer("referred_by"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  referralCode: text("referral_code").unique(),
  totalReferrals: integer("total_referrals").default(0).notNull(),
  referralEarnings: decimal("referral_earnings", { precision: 10, scale: 2 }).default("0").notNull(),
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
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type ReferralReward = typeof referralRewards.$inferSelect;
export type InsertReferralReward = z.infer<typeof insertReferralRewardSchema>;

export type SocietyRequest = typeof societyRequests.$inferSelect;
export type InsertSocietyRequest = z.infer<typeof insertSocietyRequestSchema>;


