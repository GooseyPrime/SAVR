import type Stripe from 'stripe';

export function makeSubscription(args: {
  id: string;
  customerId?: string;
  priceId?: string;
  status?: Stripe.Subscription.Status;
  created?: number;
  metadata?: Record<string, string>;
  currentPeriodEnd?: number | null;
  trialEnd?: number | null;
}): Stripe.Subscription {
  return {
    id: args.id,
    object: 'subscription',
    customer: args.customerId ?? 'cus_test',
    status: args.status ?? 'active',
    created: args.created ?? 1700000000,
    cancel_at_period_end: false,
    trial_end: args.trialEnd ?? null,
    metadata: args.metadata ?? {},
    items: {
      object: 'list',
      data: [
        {
          id: `si_${args.id}`,
          object: 'subscription_item',
          price: { id: args.priceId ?? 'price_pro_monthly', object: 'price' } as Stripe.Price,
          current_period_end: args.currentPeriodEnd ?? 1800000000,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
  } as unknown as Stripe.Subscription;
}

export function makeSession(args: {
  id: string;
  url?: string | null;
  status?: Stripe.Checkout.Session.Status | null;
  created?: number;
  mode?: Stripe.Checkout.Session.Mode | null;
  metadata?: Record<string, string>;
}): Stripe.Checkout.Session {
  return {
    id: args.id,
    object: 'checkout.session',
    url: args.url ?? 'https://checkout.stripe.test/session',
    status: args.status ?? 'open',
    created: args.created ?? 1700000000,
    mode: args.mode ?? 'subscription',
    metadata: args.metadata ?? {},
  } as Stripe.Checkout.Session;
}

export function makeCustomer(args: {
  id: string;
  created?: number;
  metadata?: Record<string, string>;
}): Stripe.Customer {
  return {
    id: args.id,
    object: 'customer',
    created: args.created ?? 1700000000,
    metadata: args.metadata ?? {},
  } as Stripe.Customer;
}

export function makePrice(args: {
  id: string;
  productId?: string;
  currency?: string;
  unitAmount?: number | null;
}): Stripe.Price {
  return {
    id: args.id,
    object: 'price',
    active: true,
    billing_scheme: 'per_unit',
    currency: args.currency ?? 'usd',
    livemode: false,
    metadata: {},
    product: args.productId ?? 'prod_pro',
    recurring: {
      interval: 'month',
      interval_count: 1,
      usage_type: 'licensed',
    },
    type: 'recurring',
    unit_amount: args.unitAmount ?? 999,
    unit_amount_decimal: String(args.unitAmount ?? 999),
  } as Stripe.Price;
}

export function makePromotionCode(args: {
  id: string;
  code?: string;
  customerId?: string | null;
  coupon?: Partial<Stripe.Coupon> & {
    applies_to?: { products: string[] } | null;
    currency_options?: Record<string, { amount_off?: number | null }> | null;
  };
}): Stripe.PromotionCode {
  return {
    id: args.id,
    object: 'promotion_code',
    active: true,
    code: args.code ?? 'PROMO',
    customer: args.customerId ?? null,
    promotion: {
      type: 'coupon',
      coupon: {
        id: `coupon_${args.id}`,
        object: 'coupon',
        valid: true,
        duration: 'forever',
        percent_off: 100,
        amount_off: null,
        currency: null,
        livemode: false,
        metadata: {},
        ...args.coupon,
      } as Stripe.Coupon,
    },
    restrictions: {
      first_time_transaction: false,
      minimum_amount: null,
      minimum_amount_currency: null,
    },
  } as unknown as Stripe.PromotionCode;
}

type QueryResult = { data: unknown; error: unknown };

export class MockSupabase {
  public updates: Array<{ table: string; data: Record<string, unknown> }> = [];
  public userRow: Record<string, unknown> | null = null;
  public selectError: unknown = null;
  public updateError: unknown = null;

  from(table: string) {
    let updateData: Record<string, unknown> | null = null;

    const builder = {
      select: (_columns: string) => {
        return builder;
      },
      update: (data: Record<string, unknown>) => {
        updateData = data;
        return builder;
      },
      eq: (_column: string, _value: unknown) => {
        return builder as typeof builder & Promise<QueryResult>;
      },
      single: (): Promise<QueryResult> => {
        if (this.selectError) {
          return Promise.resolve({ data: null, error: this.selectError });
        }
        return Promise.resolve({ data: this.userRow, error: null });
      },
      then: (resolve: (value: QueryResult) => unknown) => {
        if (updateData) {
          this.updates.push({ table, data: updateData });
        }
        return Promise.resolve({ data: null, error: this.updateError }).then(resolve);
      },
    };

    return builder;
  }
}

export class MockStripe {
  public createCalls: Array<{
    params: Stripe.Checkout.SessionCreateParams;
    options?: { idempotencyKey?: string };
  }> = [];
  public subscriptionsByCustomer = new Map<string, Stripe.Subscription[]>();
  public openSessionsByCustomer = new Map<string, Stripe.Checkout.Session[]>();
  public customersByEmail = new Map<string, Array<Stripe.Customer | Stripe.DeletedCustomer>>();
  public customersListError: unknown = null;
  public missingCustomerIds = new Set<string>();
  public customerActivityErrors = new Map<string, unknown>();
  public promotionCodesByCode = new Map<string, Stripe.PromotionCode[]>();
  public promotionCodesListError: unknown = null;
  public pricesById = new Map<string, Stripe.Price>();
  public priceRetrieveErrors = new Map<string, unknown>();
  public nextSession: Stripe.Checkout.Session = makeSession({ id: 'cs_new', url: 'https://checkout.stripe.test/new' });
  public createErrorWhenTrial: unknown = null;

  private throwIfMissingCustomer(customerId: string | null | undefined) {
    if (!customerId) return;
    if (this.customerActivityErrors.has(customerId)) {
      throw this.customerActivityErrors.get(customerId);
    }
    if (!this.missingCustomerIds.has(customerId)) return;
    throw {
      code: 'resource_missing',
      rawType: 'invalid_request_error',
      type: 'StripeInvalidRequestError',
      message: `No such customer: '${customerId}'`,
    };
  }

  checkout = {
    sessions: {
      create: async (
        params: Stripe.Checkout.SessionCreateParams,
        options?: { idempotencyKey?: string },
      ) => {
        this.createCalls.push({ params, options });
        if (
          this.createErrorWhenTrial &&
          params.subscription_data?.trial_period_days != null
        ) {
          throw this.createErrorWhenTrial;
        }
        return this.nextSession;
      },
      list: async (params: Stripe.Checkout.SessionListParams) => {
        this.throwIfMissingCustomer(params.customer);
        return {
          data: this.openSessionsByCustomer.get(params.customer ?? '') ?? [],
        };
      },
    },
  };

  customers = {
    list: async (params: Stripe.CustomerListParams) => {
      if (this.customersListError) {
        throw this.customersListError;
      }
      return {
        data: this.customersByEmail.get(params.email ?? '') ?? [],
      };
    },
  };

  prices = {
    retrieve: async (priceId: string) => {
      if (this.priceRetrieveErrors.has(priceId)) {
        throw this.priceRetrieveErrors.get(priceId);
      }
      const price = this.pricesById.get(priceId);
      if (!price) {
        throw new Error(`No such price: '${priceId}'`);
      }
      return price;
    },
  };

  promotionCodes = {
    list: async (params: Stripe.PromotionCodeListParams) => {
      if (this.promotionCodesListError) {
        throw this.promotionCodesListError;
      }
      return {
        data: this.promotionCodesByCode.get(params.code ?? '') ?? [],
      };
    },
  };

  subscriptions = {
    list: async (params: Stripe.SubscriptionListParams) => {
      this.throwIfMissingCustomer(params.customer);
      return {
        data: this.subscriptionsByCustomer.get(params.customer ?? '') ?? [],
      };
    },
  };
}
