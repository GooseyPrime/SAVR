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

  subscriptions = {
    list: async (params: Stripe.SubscriptionListParams) => {
      this.throwIfMissingCustomer(params.customer);
      return {
        data: this.subscriptionsByCustomer.get(params.customer ?? '') ?? [],
      };
    },
  };
}
