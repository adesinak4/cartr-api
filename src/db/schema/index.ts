import { relations } from 'drizzle-orm';
import { merchants } from './merchants.schema';
import { users } from './users.schema';
import { refreshTokens } from './refresh-tokens.schema';
import { products } from './products.schema';
import { productImages } from './product-images.schema';
import { orders } from './orders.schema';
import { orderItems } from './order-items.schema';
import { customers } from './customers.schema';
import { plans } from './plans.schema';
import { planPrices } from './plan-prices.schema';
import { themes } from './themes.schema';
import { paymentAccounts } from './payment-accounts.schema';
import { transactions } from './transactions.schema';
import { paymentMethods } from './payment-methods.schema';
import { subscriptionCharges } from './subscription-charges.schema';

export * from './enums';
export * from './merchants.schema';
export * from './users.schema';
export * from './refresh-tokens.schema';
export * from './products.schema';
export * from './product-images.schema';
export * from './orders.schema';
export * from './order-items.schema';
export * from './customers.schema';
export * from './plans.schema';
export * from './plan-prices.schema';
export * from './themes.schema';
export * from './payment-accounts.schema';
export * from './transactions.schema';
export * from './payment-methods.schema';
export * from './subscription-charges.schema';
export * from './signup-drafts.schema';
export * from './domain-provisioning-tasks.schema';

export const merchantsRelations = relations(merchants, ({ many, one }) => ({
  users: many(users),
  products: many(products),
  orders: many(orders),
  customers: many(customers),
  transactions: many(transactions),
  paymentMethods: many(paymentMethods),
  subscriptionCharges: many(subscriptionCharges),
  plan: one(plans, { fields: [merchants.planId], references: [plans.id] }),
  pendingPlan: one(plans, { fields: [merchants.pendingPlanId], references: [plans.id] }),
  theme: one(themes, { fields: [merchants.themeId], references: [themes.id] }),
  paymentAccount: one(paymentAccounts, {
    fields: [merchants.id],
    references: [paymentAccounts.tenantId],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(merchants, { fields: [users.tenantId], references: [merchants.id] }),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(merchants, { fields: [products.tenantId], references: [merchants.id] }),
  images: many(productImages),
  orderItems: many(orderItems),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(merchants, { fields: [customers.tenantId], references: [merchants.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(merchants, { fields: [orders.tenantId], references: [merchants.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
  transactions: many(transactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  merchants: many(merchants),
  prices: many(planPrices),
}));

export const planPricesRelations = relations(planPrices, ({ one }) => ({
  plan: one(plans, { fields: [planPrices.planId], references: [plans.id] }),
}));

export const themesRelations = relations(themes, ({ many }) => ({
  merchants: many(merchants),
}));

export const paymentAccountsRelations = relations(paymentAccounts, ({ one }) => ({
  tenant: one(merchants, { fields: [paymentAccounts.tenantId], references: [merchants.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  order: one(orders, { fields: [transactions.orderId], references: [orders.id] }),
  tenant: one(merchants, { fields: [transactions.tenantId], references: [merchants.id] }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one, many }) => ({
  tenant: one(merchants, { fields: [paymentMethods.tenantId], references: [merchants.id] }),
  charges: many(subscriptionCharges),
}));

export const subscriptionChargesRelations = relations(subscriptionCharges, ({ one }) => ({
  tenant: one(merchants, { fields: [subscriptionCharges.tenantId], references: [merchants.id] }),
  plan: one(plans, { fields: [subscriptionCharges.planId], references: [plans.id] }),
  paymentMethod: one(paymentMethods, {
    fields: [subscriptionCharges.paymentMethodId],
    references: [paymentMethods.id],
  }),
}));
