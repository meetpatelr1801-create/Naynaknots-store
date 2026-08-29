import express from "express";
import crypto from "crypto";
import dns from "dns";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";

const SECRET = process.env.NAYNAKNOTS_SECRET;
const TOKEN_SECRET =
  SECRET || "local-only-change-this-secret";

if (!SECRET) {
  console.warn(
    "WARNING: NAYNAKNOTS_SECRET is not set."
  );
}

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB =
  process.env.MONGODB_DB || "naynaknots";

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing from .env");
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);

let db;

const users = () => db.collection("users");
const products = () => db.collection("products");
const orders = () => db.collection("orders");
const wishlists = () => db.collection("wishlists");
const customOrders = () =>
  db.collection("custom_orders");
const messages = () => db.collection("messages");

// Permanent product images
const images = () => db.collection("images");

function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex")
) {
  return {
    passwordHash: crypto
      .scryptSync(String(password), salt, 64)
      .toString("hex"),
    passwordSalt: salt
  };
}

function passwordMatches(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) {
    return false;
  }

  const { passwordHash } =
    hashPassword(password, user.passwordSalt);

  const a = Buffer.from(passwordHash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomInt(
    100,
    999
  )}`;
}

function signToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      role: user.role,
      exp:
        Date.now() +
        7 * 24 * 60 * 60 * 1000
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [payload, signature] =
      String(token || "").split(".");

    if (!payload || !signature) return null;

    const expected = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(payload)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const data = JSON.parse(
      Buffer.from(
        payload,
        "base64url"
      ).toString("utf8")
    );

    if (
      !data.exp ||
      Date.now() > data.exp
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

async function authUser(req) {
  const authorization =
    req.headers.authorization || "";

  const token =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

  const claims = verifyToken(token);

  if (!claims) return null;

  return users().findOne({
    id: claims.id
  });
}

async function requireUser(
  req,
  res,
  next
) {
  try {
    const user =
      await authUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Please log in."
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Authentication failed."
    });
  }
}

async function requireAdmin(
  req,
  res,
  next
) {
  try {
    const user =
      await authUser(req);

    if (
      !user ||
      user.role !== "admin"
    ) {
      return res.status(403).json({
        message:
          "Admin permission required."
      });
    }

    req.user = user;
    req.admin = user;

    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Authentication failed."
    });
  }
}

function rateLimit(
  limit,
  windowMs
) {
  const buckets = new Map();

  return (
    req,
    res,
    next
  ) => {
    const key =
      `${req.ip}:${req.path}`;

    const now = Date.now();

    const row =
      buckets.get(key);

    if (
      !row ||
      now - row.start > windowMs
    ) {
      buckets.set(key, {
        start: now,
        count: 1
      });

      return next();
    }

    row.count++;

    if (row.count > limit) {
      return res.status(429).json({
        message:
          "Too many attempts. Please wait and try again."
      });
    }

    next();
  };
}

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "8mb"
  })
);

app.disable(
  "x-powered-by"
);

app.use(
  (req, res, next) => {
    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "X-Frame-Options",
      "DENY"
    );

    res.setHeader(
      "Referrer-Policy",
      "strict-origin-when-cross-origin"
    );

    next();
  }
);

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get(
  "/api/health",
  (_, res) => {
    res.json({
      ok: true,
      service:
        "naynaknots-api",
      database: "mongodb",
      time:
        new Date().toISOString()
    });
  }
);

// --------------------------------------------------
// STORE CONFIG
// --------------------------------------------------

app.get(
  "/api/store-config",
  (_, res) => {
    res.json({
      instagram:
        "naynaknots",
      whatsapp:
        "916352198619",
      storeName:
        "Naynaknots",
      supportEmail:
        "meetpatelr1801@gmail.com"
    });
  }
);

// --------------------------------------------------
// PRODUCTS
// --------------------------------------------------

app.get(
  "/api/products",
  async (_, res) => {
    try {
      const list =
        await products()
          .find({})
          .sort({ id: 1 })
          .toArray();

      res.json(list);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to load products."
      });
    }
  }
);

// --------------------------------------------------
// REGISTER
// --------------------------------------------------

app.post(
  "/api/register",
  rateLimit(
    10,
    15 * 60 * 1000
  ),
  async (req, res) => {
    try {
      const name =
        String(
          req.body?.name ||
            ""
        ).trim();

      const email =
        String(
          req.body?.email ||
            ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body?.password ||
            ""
        );

      if (
        name.length < 2 ||
        name.length > 60
      ) {
        return res.status(400).json({
          message:
            "Name must be between 2 and 60 characters."
        });
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return res.status(400).json({
          message:
            "Please enter a valid email address."
        });
      }

      if (
        password.length < 8
      ) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters."
        });
      }

      if (
        await users().findOne({
          email
        })
      ) {
        return res.status(409).json({
          message:
            "An account with this email already exists."
        });
      }

      const user = {
        id:
          crypto.randomUUID(),

        name,

        email,

        ...hashPassword(
          password
        ),

        role: "customer",

        createdAt:
          new Date().toISOString()
      };

      await users().insertOne(
        user
      );

      res.json({
        user:
          sanitizeUser(user),

        token:
          signToken(user)
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Registration failed."
      });
    }
  }
);

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post(
  "/api/login",
  rateLimit(
    10,
    15 * 60 * 1000
  ),
  async (req, res) => {
    try {
      const email =
        String(
          req.body?.email ||
            ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body?.password ||
            ""
        );

      const user =
        await users().findOne({
          email
        });

      if (
        !user ||
        !passwordMatches(
          password,
          user
        )
      ) {
        return res.status(401).json({
          message:
            "Incorrect email or password."
        });
      }

      res.json({
        user:
          sanitizeUser(user),

        token:
          signToken(user)
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Login failed."
      });
    }
  }
);

// --------------------------------------------------
// CURRENT USER
// --------------------------------------------------

app.get(
  "/api/me",
  requireUser,
  (req, res) => {
    res.json({
      user:
        sanitizeUser(
          req.user
        )
    });
  }
);

// --------------------------------------------------
// UPDATE PROFILE
// --------------------------------------------------

app.patch(
  "/api/my/profile",
  requireUser,
  async (req, res) => {
    try {
      const name =
        String(
          req.body?.name ||
            ""
        ).trim();

      if (
        name.length < 2 ||
        name.length > 60
      ) {
        return res.status(400).json({
          message:
            "Name must be between 2 and 60 characters."
        });
      }

      await users().updateOne(
        {
          id: req.user.id
        },
        {
          $set: {
            name
          }
        }
      );

      const updated =
        await users().findOne({
          id: req.user.id
        });

      res.json({
        user:
          sanitizeUser(
            updated
          )
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to update profile."
      });
    }
  }
);

// --------------------------------------------------
// MY WISHLIST
// --------------------------------------------------

app.get(
  "/api/my/wishlist",
  requireUser,
  async (req, res) => {
    try {
      const wishlist =
        await wishlists().findOne({
          userId:
            req.user.id
        });

      res.json(
        wishlist?.productIds ||
          []
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to load wishlist."
      });
    }
  }
);

app.post(
  "/api/my/wishlist/:productId",
  requireUser,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.productId
        );

      if (
        !(await products().findOne({
          id
        }))
      ) {
        return res.status(404).json({
          message:
            "Product not found."
        });
      }

      await wishlists().updateOne(
        {
          userId:
            req.user.id
        },
        {
          $addToSet: {
            productIds:
              id
          }
        },
        {
          upsert: true
        }
      );

      const wishlist =
        await wishlists().findOne({
          userId:
            req.user.id
        });

      res.json({
        productIds:
          wishlist?.productIds ||
          []
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to update wishlist."
      });
    }
  }
);

app.delete(
  "/api/my/wishlist/:productId",
  requireUser,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.productId
        );

      await wishlists().updateOne(
        {
          userId:
            req.user.id
        },
        {
          $pull: {
            productIds:
              id
          }
        }
      );

      const wishlist =
        await wishlists().findOne({
          userId:
            req.user.id
        });

      res.json({
        productIds:
          wishlist?.productIds ||
          []
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to update wishlist."
      });
    }
  }
);

// --------------------------------------------------
// MY ORDERS
// --------------------------------------------------

app.get(
  "/api/my/orders",
  requireUser,
  async (req, res) => {
    try {
      const list =
        await orders()
          .find({
            userId:
              req.user.id
          })
          .sort({
            createdAt: -1
          })
          .toArray();

      res.json(list);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to load orders."
      });
    }
  }
);

// --------------------------------------------------
// MY CUSTOM ORDERS
// --------------------------------------------------

app.get(
  "/api/my/custom-orders",
  requireUser,
  async (req, res) => {
    try {
      const list =
        await customOrders()
          .find({
            userId:
              req.user.id
          })
          .sort({
            createdAt: -1
          })
          .toArray();

      res.json(list);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to load custom orders."
      });
    }
  }
);
// --------------------------------------------------
// CREATE ORDER
// --------------------------------------------------

app.post(
  "/api/orders",
  requireUser,
  async (req, res) => {
    try {
      const {
        items,
        customer
      } = req.body || {};

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          message:
            "Your cart is empty."
        });
      }

      if (
        !customer ||
        [
          "name",
          "phone",
          "city",
          "address"
        ].some(
          key =>
            !String(
              customer[key] || ""
            ).trim()
        )
      ) {
        return res.status(400).json({
          message:
            "Please complete your delivery details."
        });
      }

      const safeItems = [];

      // Verify every product and stock
      for (const item of items) {
        const productId =
          Number(item.id);

        const quantity =
          Math.floor(
            Number(item.qty)
          );

        if (
          !Number.isInteger(
            productId
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid product."
          });
        }

        const product =
          await products().findOne({
            id: productId
          });

        if (!product) {
          return res.status(400).json({
            message:
              "One of the products is no longer available."
          });
        }

        if (
          !Number.isInteger(
            quantity
          ) ||
          quantity < 1
        ) {
          return res.status(400).json({
            message:
              "Invalid item quantity."
          });
        }

        if (
          Number(product.stock) <
          quantity
        ) {
          return res.status(400).json({
            message:
              `Only ${product.stock} ${product.name} available.`
          });
        }

        safeItems.push({
          id:
            product.id,

          name:
            product.name,

          price:
            Number(product.price),

          qty:
            quantity
        });
      }

      // Reduce stock safely
      for (const item of safeItems) {
        const result =
          await products().updateOne(
            {
              id: item.id,
              stock: {
                $gte: item.qty
              }
            },
            {
              $inc: {
                stock:
                  -item.qty
              }
            }
          );

        if (
          result.modifiedCount !== 1
        ) {
          return res.status(409).json({
            message:
              "Stock changed while placing the order. Please try again."
          });
        }
      }

      const total =
        safeItems.reduce(
          (sum, item) =>
            sum +
            item.price *
              item.qty,
          0
        );

      const order = {
        id:
          makeId("ORD"),

        createdAt:
          new Date().toISOString(),

        status:
          "Placed",

        userId:
          req.user.id,

        email:
          req.user.email,

        customer: {
          name:
            String(
              customer.name
            )
              .trim()
              .slice(0, 80),

          phone:
            String(
              customer.phone
            )
              .trim()
              .slice(0, 30),

          city:
            String(
              customer.city
            )
              .trim()
              .slice(0, 80),

          address:
            String(
              customer.address
            )
              .trim()
              .slice(0, 250),

          note:
            String(
              customer.note ||
                ""
            )
              .trim()
              .slice(0, 300)
        },

        items:
          safeItems,

        total
      };

      await orders().insertOne(
        order
      );

      res.status(201).json({
        order
      });
    } catch (error) {
      console.error(
        "❌ CREATE ORDER ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to place order."
      });
    }
  }
);


// --------------------------------------------------
// CREATE CUSTOM ORDER
// --------------------------------------------------

app.post(
  "/api/custom-orders",
  requireUser,
  async (req, res) => {
    try {
      const order = {
        id:
          makeId("CUS"),

        createdAt:
          new Date().toISOString(),

        status:
          "Submitted",

        userId:
          req.user.id,

        email:
          req.user.email,

        type:
          String(
            req.body?.type || ""
          )
            .trim()
            .slice(0, 60),

        color:
          String(
            req.body?.color || ""
          )
            .trim()
            .slice(0, 60),

        size:
          String(
            req.body?.size || ""
          )
            .trim()
            .slice(0, 60),

        occasion:
          String(
            req.body?.occasion || ""
          )
            .trim()
            .slice(0, 80),

        idea:
          String(
            req.body?.idea || ""
          )
            .trim()
            .slice(0, 800),

        price:
          Number(
            req.body?.price
          ) || 0
      };

      await customOrders().insertOne(
        order
      );

      res.status(201).json({
        ok: true,
        order
      });
    } catch (error) {
      console.error(
        "❌ CUSTOM ORDER ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to submit custom order."
      });
    }
  }
);


// --------------------------------------------------
// CONTACT
// --------------------------------------------------

app.post(
  "/api/contact",
  async (req, res) => {
    try {
      const name =
        String(
          req.body?.name || ""
        )
          .trim()
          .slice(0, 80);

      const email =
        String(
          req.body?.email || ""
        )
          .trim()
          .slice(0, 120);

      const messageText =
        String(
          req.body?.message || ""
        )
          .trim()
          .slice(0, 1500);

      if (
        !name ||
        !email ||
        !messageText
      ) {
        return res.status(400).json({
          message:
            "Name, email and message are required."
        });
      }

      const message = {
        id:
          makeId("MSG"),

        name,

        email,

        message:
          messageText,

        createdAt:
          new Date().toISOString()
      };

      await messages().insertOne(
        message
      );

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(
        "❌ CONTACT ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to send message."
      });
    }
  }
);


// --------------------------------------------------
// ADMIN - ALL DATA
// --------------------------------------------------

app.get(
  "/api/admin/data",
  requireAdmin,
  async (req, res) => {
    try {
      const [
        allUsers,
        allProducts,
        allOrders,
        allCustomOrders,
        allMessages,
        allWishlists
      ] = await Promise.all([
        users()
          .find({})
          .project({
            passwordHash: 0,
            passwordSalt: 0
          })
          .toArray(),

        products()
          .find({})
          .sort({
            id: 1
          })
          .toArray(),

        orders()
          .find({})
          .sort({
            createdAt: -1
          })
          .toArray(),

        customOrders()
          .find({})
          .sort({
            createdAt: -1
          })
          .toArray(),

        messages()
          .find({})
          .sort({
            createdAt: -1
          })
          .toArray(),

        wishlists()
          .find({})
          .toArray()
      ]);

      res.json({
        users:
          allUsers,

        products:
          allProducts,

        orders:
          allOrders,

        customOrders:
          allCustomOrders,

        messages:
          allMessages,

        wishlists:
          allWishlists
      });
    } catch (error) {
      console.error(
        "❌ ADMIN DATA ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to load admin data."
      });
    }
  }
);


// --------------------------------------------------
// ADMIN - ORDER STATUS
// --------------------------------------------------

app.patch(
  "/api/admin/orders/:id/status",
  requireAdmin,
  async (req, res) => {
    try {
      const allowed = [
        "Placed",
        "Confirmed",
        "Preparing",
        "Ready",
        "Completed",
        "Cancelled"
      ];

      const status =
        String(
          req.body?.status || ""
        );

      if (
        !allowed.includes(status)
      ) {
        return res.status(400).json({
          message:
            "Invalid order status."
        });
      }

      const result =
        await orders().findOneAndUpdate(
          {
            id:
              req.params.id
          },
          {
            $set: {
              status
            }
          },
          {
            returnDocument:
              "after"
          }
        );

      if (!result) {
        return res.status(404).json({
          message:
            "Order not found."
        });
      }

      res.json({
        order:
          result
      });
    } catch (error) {
      console.error(
        "❌ ORDER STATUS ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to update order."
      });
    }
  }
);


// --------------------------------------------------
// ADMIN - CUSTOM ORDER STATUS
// --------------------------------------------------

app.patch(
  "/api/admin/custom-orders/:id/status",
  requireAdmin,
  async (req, res) => {
    try {
      const allowed = [
        "Submitted",
        "Reviewed",
        "Accepted",
        "In Progress",
        "Ready",
        "Completed",
        "Cancelled"
      ];

      const status =
        String(
          req.body?.status || ""
        );

      if (
        !allowed.includes(status)
      ) {
        return res.status(400).json({
          message:
            "Invalid custom order status."
        });
      }

      const result =
        await customOrders()
          .findOneAndUpdate(
            {
              id:
                req.params.id
            },
            {
              $set: {
                status
              }
            },
            {
              returnDocument:
                "after"
            }
          );

      if (!result) {
        return res.status(404).json({
          message:
            "Custom order not found."
        });
      }

      res.json({
        order:
          result
      });
    } catch (error) {
      console.error(
        "❌ CUSTOM ORDER STATUS ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to update custom order."
      });
    }
  }
);


// --------------------------------------------------
// ADMIN - CHANGE USER ROLE
// --------------------------------------------------

app.patch(
  "/api/admin/users/:id/role",
  requireAdmin,
  async (req, res) => {
    try {
      const role =
        String(
          req.body?.role || ""
        );

      if (
        ![
          "customer",
          "admin"
        ].includes(role)
      ) {
        return res.status(400).json({
          message:
            "Invalid role."
        });
      }

      if (
        req.params.id ===
          req.admin.id &&
        role !== "admin"
      ) {
        return res.status(400).json({
          message:
            "You cannot remove your own admin access."
        });
      }

      const result =
        await users().findOneAndUpdate(
          {
            id:
              req.params.id
          },
          {
            $set: {
              role
            }
          },
          {
            returnDocument:
              "after"
          }
        );

      if (!result) {
        return res.status(404).json({
          message:
            "User not found."
        });
      }

      res.json({
        user:
          sanitizeUser(
            result
          )
      });
    } catch (error) {
      console.error(
        "❌ USER ROLE ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to update user role."
      });
    }
  }
);
// --------------------------------------------------
// ADMIN - IMAGE UPLOAD
// PERMANENT MONGODB STORAGE
// --------------------------------------------------

app.post(
  "/api/admin/upload-image",
  requireAdmin,
  async (req, res) => {
    try {
      const {
        dataUrl
      } = req.body || {};

      if (
        typeof dataUrl !== "string" ||
        !dataUrl.startsWith(
          "data:image/"
        )
      ) {
        return res.status(400).json({
          message:
            "Please select a valid image."
        });
      }

      /*
        Supported formats:
        PNG
        JPG / JPEG
        WebP
      */

      const match =
        dataUrl.match(
          /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/
        );

      if (!match) {
        return res.status(400).json({
          message:
            "Only PNG, JPG or WebP images are supported."
        });
      }

      const extension =
        match[1];

      const contentType =
        extension === "jpg" ||
        extension === "jpeg"
          ? "image/jpeg"
          : `image/${extension}`;

      const base64Data =
        match[2];

      const buffer =
        Buffer.from(
          base64Data,
          "base64"
        );

      /*
        Maximum 5 MB.
      */

      if (
        buffer.length >
        5 * 1024 * 1024
      ) {
        return res.status(400).json({
          message:
            "Image must be smaller than 5 MB."
        });
      }

      /*
        Save image permanently
        inside MongoDB.
      */

      const result =
        await images().insertOne({
          data: buffer,

          contentType,

          size:
            buffer.length,

          createdAt:
            new Date().toISOString()
        });

      const imageId =
        result.insertedId.toString();

      const imageUrl =
        `/api/images/${imageId}`;

      console.log(
        `✅ Image saved permanently: ${imageId}`
      );

      return res.status(201).json({
        ok: true,

        url: imageUrl,

        imageId
      });

    } catch (error) {
      console.error(
        "❌ IMAGE UPLOAD ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to upload image."
      });
    }
  }
);


// --------------------------------------------------
// GET IMAGE FROM MONGODB
// --------------------------------------------------

app.get(
  "/api/images/:id",
  async (req, res) => {
    try {
      const imageId =
        String(
          req.params.id || ""
        ).trim();

      /*
        Validate MongoDB ObjectId.
      */

      if (
        !ObjectId.isValid(
          imageId
        )
      ) {
        return res.status(400).send(
          "Invalid image ID."
        );
      }

      /*
        Find image in MongoDB.
      */

      const image =
        await images().findOne({
          _id:
            new ObjectId(
              imageId
            )
        });

      if (
        !image ||
        !image.data
      ) {
        return res.status(404).send(
          "Image not found."
        );
      }

      let buffer;

      /*
        MongoDB Binary can be
        returned in different forms.
      */

      if (
        Buffer.isBuffer(
          image.data
        )
      ) {
        buffer =
          image.data;
      } else if (
        image.data &&
        image.data.buffer
      ) {
        buffer =
          Buffer.from(
            image.data.buffer
          );
      } else {
        buffer =
          Buffer.from(
            image.data
          );
      }

      /*
        Tell browser the image type.
      */

      res.setHeader(
        "Content-Type",
        image.contentType ||
          "image/jpeg"
      );

      res.setHeader(
        "Content-Length",
        buffer.length
      );

      /*
        Images are permanently
        stored in MongoDB, so
        browser caching is safe.
      */

      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable"
      );

      return res.send(
        buffer
      );

    } catch (error) {
      console.error(
        "❌ IMAGE LOAD ERROR:",
        error
      );

      return res.status(500).send(
        "Unable to load image."
      );
    }
  }
);


// --------------------------------------------------
// ADMIN - ADD PRODUCT
// --------------------------------------------------

app.post(
  "/api/admin/products",
  requireAdmin,
  async (req, res) => {
    try {
      const name =
        String(
          req.body?.name || ""
        )
          .trim()
          .slice(0, 120);

      const category =
        String(
          req.body?.category ||
            "Flowers"
        )
          .trim()
          .slice(0, 60);

      const description =
        String(
          req.body?.description ||
            ""
        )
          .trim()
          .slice(0, 1200);

      const image =
        String(
          req.body?.image || ""
        )
          .trim()
          .slice(0, 500);

      const price =
        Number(
          req.body?.price
        );

      const stock =
        Number(
          req.body?.stock
        );

      const rating =
        Number(
          req.body?.rating
        );

      if (!name) {
        return res.status(400).json({
          message:
            "Product name is required."
        });
      }

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          message:
            "Please enter a valid price."
        });
      }

      if (
        !Number.isFinite(stock) ||
        stock < 0
      ) {
        return res.status(400).json({
          message:
            "Please enter a valid stock quantity."
        });
      }

      const safeRating =
        Number.isFinite(rating)
          ? Math.min(
              5,
              Math.max(
                0,
                rating
              )
            )
          : 5;

      /*
        Generate numeric product ID
        compatible with your frontend.
      */

      let id;

      do {
        id =
          Date.now() +
          Math.floor(
            Math.random() * 1000
          );
      } while (
        await products().findOne({
          id
        })
      );

      const product = {
        id,

        name,

        price,

        category,

        image,

        description,

        stock:

          Math.floor(
            stock
          ),

        rating:
          safeRating,

        createdAt:
          new Date().toISOString()
      };

      await products().insertOne(
        product
      );

      console.log(
        `✅ Product added: ${name}`
      );

      return res.status(201).json({
        product
      });

    } catch (error) {
      console.error(
        "❌ ADD PRODUCT ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to add product."
      });
    }
  }
);


// --------------------------------------------------
// ADMIN - UPDATE PRODUCT
// --------------------------------------------------

app.put(
  "/api/admin/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id)
      ) {
        return res.status(400).json({
          message:
            "Invalid product ID."
        });
      }

      const existing =
        await products().findOne({
          id
        });

      if (!existing) {
        return res.status(404).json({
          message:
            "Product not found."
        });
      }

      const name =
        String(
          req.body?.name ??
            existing.name
        )
          .trim()
          .slice(0, 120);

      const category =
        String(
          req.body?.category ??
            existing.category
        )
          .trim()
          .slice(0, 60);

      const description =
        String(
          req.body?.description ??
            existing.description
        )
          .trim()
          .slice(0, 1200);

      const image = String(
  req.body?.image ??
    existing.image ??
    ""
)
  .trim()
  .slice(0, 500);

      const price =
        Number(
          req.body?.price ??
            existing.price
        );

      const stock =
        Number(
          req.body?.stock ??
            existing.stock
        );

      const rating =
        Number(
          req.body?.rating ??
            existing.rating
        );

      if (!name) {
        return res.status(400).json({
          message:
            "Product name is required."
        });
      }

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          message:
            "Please enter a valid price."
        });
      }

      if (
        !Number.isFinite(stock) ||
        stock < 0
      ) {
        return res.status(400).json({
          message:
            "Please enter a valid stock quantity."
        });
      }

      const safeRating =
        Number.isFinite(rating)
          ? Math.min(
              5,
              Math.max(
                0,
                rating
              )
            )
          : 5;

      const updatedProduct = {
        ...existing,

        id,

        name,

        price,

        category,

        image,

        description,

        stock:
          Math.floor(
            stock
          ),

        rating:
          safeRating,

        updatedAt:
          new Date().toISOString()
      };

      await products().replaceOne(
        {
          id
        },
        updatedProduct
      );

      console.log(
        `✅ Product updated: ${name}`
      );

      return res.json({
        product:
          updatedProduct
      });

    } catch (error) {
      console.error(
        "❌ UPDATE PRODUCT ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to update product."
      });
    }
  }
);


// --------------------------------------------------
// ADMIN - DELETE PRODUCT
// --------------------------------------------------

app.delete(
  "/api/admin/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id)
      ) {
        return res.status(400).json({
          message:
            "Invalid product ID."
        });
      }

      const product =
        await products().findOne({
          id
        });

      if (!product) {
        return res.status(404).json({
          message:
            "Product not found."
        });
      }

      await products().deleteOne({
        id
      });

      /*
        IMPORTANT:

        We intentionally DO NOT delete
        the image from MongoDB here.

        This means if the product is
        deleted and later another
        product uses the same image,
        the image record remains safe.

        It also prevents accidental
        loss of existing product photos.
      */

      console.log(
        `🗑️ Product removed: ${product.name}`
      );

      return res.json({
        ok: true,

        productId: id
      });

    } catch (error) {
      console.error(
        "❌ DELETE PRODUCT ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to remove product."
      });
    }
  }
);

// --------------------------------------------------
// DATABASE INITIALIZATION
// --------------------------------------------------

async function ensureDatabase() {
  console.log(
    "Connecting to MongoDB Atlas..."
  );

  await client.connect();

  db = client.db(MONGODB_DB);

  console.log(
    `✅ MongoDB connected: ${MONGODB_DB}`
  );

  // Create collections if they don't exist.
  const existingCollections =
    await db.listCollections().toArray();

  const existingNames = new Set(
    existingCollections.map(
      (collection) => collection.name
    )
  );

  const requiredCollections = [
    "users",
    "products",
    "orders",
    "wishlists",
    "custom_orders",
    "messages",
    "images"
  ];

  for (const collectionName of requiredCollections) {
    if (!existingNames.has(collectionName)) {
      await db.createCollection(collectionName);

      console.log(
        `✅ Created collection: ${collectionName}`
      );
    }
  }

  // ------------------------------------------------
  // INDEXES
  // ------------------------------------------------

  /*
    IMPORTANT:
    Do not recreate the existing products/orders
    "id_1" indexes. They already exist in MongoDB.
  */

  try {
    await users().createIndex(
      { email: 1 },
      {
        unique: true,
        name: "users_email_unique"
      }
    );
  } catch (error) {
    if (error.code !== 85 && error.code !== 86) {
      throw error;
    }
  }

  try {
    await orders().createIndex(
      {
        userId: 1,
        createdAt: -1
      },
      {
        name: "orders_user_created"
      }
    );
  } catch (error) {
    if (error.code !== 85 && error.code !== 86) {
      throw error;
    }
  }

  try {
    await customOrders().createIndex(
      {
        userId: 1,
        createdAt: -1
      },
      {
        name: "custom_orders_user_created"
      }
    );
  } catch (error) {
    if (error.code !== 85 && error.code !== 86) {
      throw error;
    }
  }

  try {
    await wishlists().createIndex(
      { userId: 1 },
      {
        unique: true,
        name: "wishlists_user_unique"
      }
    );
  } catch (error) {
    if (error.code !== 85 && error.code !== 86) {
      throw error;
    }
  }

  try {
    await messages().createIndex(
      { createdAt: -1 },
      {
        name: "messages_created"
      }
    );
  } catch (error) {
    if (error.code !== 85 && error.code !== 86) {
      throw error;
    }
  }

  try {
    await images().createIndex(
      { createdAt: -1 },
      {
        name: "images_created"
      }
    );
  } catch (error) {
    if (error.code !== 85 && error.code !== 86) {
      throw error;
    }
  }

  console.log(
    "✅ MongoDB indexes ready."
  );
}


// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use(
  (err, req, res, next) => {
    console.error(
      "❌ UNHANDLED SERVER ERROR:",
      err
    );

    if (res.headersSent) {
      return next(err);
    }

    return res.status(500).json({
      message:
        "Something went wrong on the server."
    });
  }
);


// --------------------------------------------------
// 404 API HANDLER
// --------------------------------------------------

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      message:
        "API endpoint not found."
    });
  }
);


// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function start() {
  try {
    await ensureDatabase();

    app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `Naynaknots API running on ${HOST}:${PORT}`
        );

        console.log(
          `MongoDB database: ${MONGODB_DB}`
        );
      }
    );
  } catch (error) {
    console.error(
      "❌ Failed to start Naynaknots API:"
    );

    console.error(error);

    process.exit(1);
  }
}


// --------------------------------------------------
// GRACEFUL SHUTDOWN
// --------------------------------------------------

async function shutdown(signal) {
  console.log(
    `\n${signal} received. Shutting down...`
  );

  try {
    await client.close();

    console.log(
      "MongoDB connection closed."
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Error while closing MongoDB:",
      error
    );

    process.exit(1);
  }
}


process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);


// --------------------------------------------------
// START APPLICATION
// --------------------------------------------------

start();