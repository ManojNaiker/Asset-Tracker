import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as SamlStrategy } from "@node-saml/passport-saml";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET || "replit-dev-secret-key-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Helper to ensure SAML strategy is configured with latest settings
  const configureSamlStrategy = async (req?: any) => {
    const settings = await storage.getEmailSettings();
    if (settings?.enableSso && settings.samlEntryPoint) {
      const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
      const callbackUrl = `${baseUrl}/api/auth/saml/callback`;
      const logoutCallbackUrl = `${baseUrl}/api/auth/saml/logout/callback`;

      console.log(`[SAML] Refreshing SAML Strategy configuration (Base: ${baseUrl || 'relative'})...`);
      
      let idpCert = settings.samlCert || "";
      if (idpCert && !idpCert.includes("-----BEGIN CERTIFICATE-----")) {
        console.warn("[SAML] Certificate missing BEGIN header, attempting to wrap...");
        idpCert = `-----BEGIN CERTIFICATE-----\n${idpCert}\n-----END CERTIFICATE-----`;
      }
      
      const samlStrategy = new SamlStrategy(
        {
          entryPoint: settings.samlEntryPoint,
          issuer: settings.samlIssuer || "Skillmine",
          idpIssuer: settings.samlIdpIssuer || undefined,
          idpCert: idpCert,
          callbackUrl,
          logoutUrl: settings.samlLogoutUrl || "",
          logoutCallbackUrl,
          wantAssertionsSigned: true,
          wantAuthnResponseSigned: false, // Most IdPs only sign assertions
          acceptedClockSkewMs: 60000, // 1 minute buffer for clock skew
        },
        (profile: any, done: any) => {
          const email = profile.email || profile.nameID || profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
          if (!email) {
            return done(new Error("Email not found in SAML profile"));
          }

          (async () => {
            try {
              let user = await storage.getUserByEmail(email);
              if (!user) {
                if (!settings?.samlJitEnabled) {
                  return done(null, false, { message: "User not found in application. JIT provisioning is disabled." });
                }

                console.log(`[SAML] User ${email} not found, creating new account (JIT enabled)...`);
                const { v4: uuidv4 } = await import("uuid");
                user = await storage.createUser({
                  id: uuidv4(),
                  email: email,
                  firstName: profile.firstName || profile.givenName || "SSO",
                  lastName: profile.lastName || profile.surname || "User",
                  role: "user",
                  passwordHash: "SSO_AUTH_ONLY",
                  isActivated: true,
                  mustChangePassword: false,
                });
              }

                // Add SAML identifiers to the user object so they are available in req.user
                const userWithSaml = {
                  ...user,
                  nameID: profile.nameID,
                  nameIDFormat: profile.nameIDFormat,
                  sessionIndex: profile.sessionIndex,
                };

                return done(null, userWithSaml);
              } catch (err) {
              return done(err);
            }
          })();
        },
        (profile: any, done: any) => {
          return done(null, profile);
        }
      );
      passport.use("saml", samlStrategy as any);
      return samlStrategy;
    }
    return null;
  };

  // Pre-initialize if possible (don't await here to ensure routes are registered synchronously)
  configureSamlStrategy().catch(err => console.error("[SAML] Initialization error:", err));

  // SAML routes (Registered statically to avoid 404s)
  console.log("[SAML] Registering static SAML routes...");
  
  app.get("/api/auth/saml/login", async (req, res, next) => {
    console.log("[SAML] Hit login route");
    const strategy = await configureSamlStrategy(req);
    if (!strategy) {
      return res.status(400).json({ message: "SAML is not configured or enabled" });
    }
    passport.authenticate("saml")(req, res, next);
  });
  
  app.post(
    "/api/auth/saml/callback",
    async (req, res, next) => {
      console.log(`[SAML] Callback received: ${req.method} ${req.originalUrl}`);
      const strategy = await configureSamlStrategy(req);
      if (!strategy) {
        console.error("[SAML] Strategy not found in callback");
        return res.status(400).json({ message: "SAML is not configured or enabled" });
      }
      next();
    },
    (req, res, next) => {
      passport.authenticate("saml", (err: any, user: any, info: any) => {
        if (err) {
          console.error("[SAML] Passport error:", err);
          return res.status(500).json({ message: "SAML Auth Error", details: err.message });
        }
        if (!user) {
          console.warn("[SAML] Auth failed:", info);
          return res.status(401).json({ 
            message: info?.message || "SAML Authentication failed",
            details: info
          });
        }
        
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error("[SAML] req.logIn error:", loginErr);
            return res.status(500).json({ message: "Session login failed" });
          }
          next();
        });
      })(req, res, next);
    },
    async (req: any, res) => {
      console.log("[SAML] Login successful for user:", req.user.email);
        // Create session compatible with existing auth and store SAML identifiers for SLO
        (req.session as any).user = {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          authMethod: 'saml',
          samlNameID: req.user.nameID,
          samlNameIDFormat: req.user.nameIDFormat,
          samlSessionIndex: req.user.sessionIndex,
        };
      
      await storage.createAuditLog({
        userId: req.user.id,
        action: 'login',
        resourceType: 'user',
        resourceId: req.user.id,
        details: { email: req.user.email, method: 'saml' },
      });

      res.redirect("/");
    }
  );

  app.get("/api/auth/saml/metadata", async (req, res) => {
    console.log(`[SAML] Hit metadata route: ${req.method} ${req.url}`);
    const strategy = await configureSamlStrategy(req);
    if (!strategy) {
      return res.status(400).json({ message: "SAML is not configured or enabled" });
    }
    const settings = await storage.getEmailSettings();
    res.type("application/xml");
    res.status(200).send(
      strategy.generateServiceProviderMetadata(settings?.samlCert || "")
    );
  });
  // SAML Logout routes
  app.get("/api/auth/saml/logout", async (req: any, res) => {
    const strategy = await configureSamlStrategy(req);
    const settings = await storage.getEmailSettings();
    const sessionUser = (req.session as any).user;

    console.log(`[SAML] Initiating SLO for user: ${sessionUser?.email}`);
    console.log(`[SAML] Session identifiers - NameID: ${sessionUser?.samlNameID}, SessionIndex: ${sessionUser?.samlSessionIndex}`);

    if (strategy && settings?.samlLogoutUrl) {
      if (req.user && sessionUser) {
        req.user.nameID = sessionUser.samlNameID;
        req.user.nameIDFormat = sessionUser.samlNameIDFormat;
        req.user.sessionIndex = sessionUser.samlSessionIndex;
      }
      
      strategy.logout(req, (err, url) => {
        if (err) {
          console.error("[SAML] Logout generation failed:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        console.log(`[SAML] Redirecting to IdP logout: ${url}`);
        res.redirect(url || "/login");
      });
    } else {
      req.logout(() => res.json({ message: "Logged out locally" }));
    }
  });

  app.all("/api/auth/saml/logout/callback", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });

  // Sanity check route
  app.get("/api/sanity-check", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash || "");
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.isActivated === false && user.role !== 'admin') {
        return res.status(403).json({ 
          message: "Please activate your account using the link sent to your email before logging in" 
        });
      }

      (req.session as any).user = {
        id: user.id,
        email: user.email,
        role: user.role,
        authMethod: 'local',
      };

      await storage.createAuditLog({
        userId: user.id,
        action: 'login',
        resourceType: 'user',
        resourceId: user.id,
        details: { email: user.email },
      });

      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          mustChangePassword: user.mustChangePassword || false
        } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = (req.session as any)?.user;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = user;
  next();
};
