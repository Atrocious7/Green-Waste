import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      businessId?: string | null;
    };
  }

  interface User {
    id: string;
    role?: string;
    businessId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      businessId?: string | null;
    };
  }
}
