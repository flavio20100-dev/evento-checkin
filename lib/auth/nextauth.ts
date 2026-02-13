import GoogleProvider from 'next-auth/providers/google';

/**
 * NextAuth.js Configuration
 * Gestisce Google OAuth per admin e whitelist email/domini
 */
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'select_account', // Force account selection
        },
      },
    }),
  ],

  callbacks: {
    /**
     * Verifica se utente è autorizzato ad accedere (whitelist)
     */
    async signIn({ user, account, profile }: any) {
      if (!user.email) {
        return false;
      }

      const allowedEmails = (process.env.ALLOWED_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      const allowedDomains = (process.env.ALLOWED_ADMIN_DOMAINS || '')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      // Check email whitelist
      if (allowedEmails.includes(user.email)) {
        return true;
      }

      // Check domain whitelist
      const domain = user.email.split('@')[1];
      if (domain && allowedDomains.includes(domain)) {
        return true;
      }

      console.log(`Access denied for email: ${user.email}`);
      return false; // Unauthorized
    },

    /**
     * Aggiunge user ID alla session
     */
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },

    /**
     * JWT callback
     */
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Helper for NextAuth v5 compatibility
import NextAuth from 'next-auth';

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
