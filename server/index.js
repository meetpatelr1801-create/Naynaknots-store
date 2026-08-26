import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import dns from "dns";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import "dotenv/config";
import cors from "cors";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const dir = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(dir, "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

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
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
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
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (!data.exp || Date.now() > data.exp) {
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

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  const claims = verifyToken(token);

  if (!claims) return null;

  return users().findOne({
    id: claims.id
  });
}

async function requireUser(req, res, next) {
  try {
    const user = await authUser(req);

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
      message: "Authentication failed."
    });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await authUser(req);

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        message: "Admin permission required."
      });
    }

    req.user = user;
    req.admin = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Authentication failed."
    });
  }
}

function rateLimit(limit, windowMs) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const row = buckets.get(key);

    if (!row || now - row.start > windowMs) {
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

app.disable("x-powered-by");

app.use((req, res, next) => {
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
});

app.use(
  "/uploads",
  express.static(uploadsDir)
);

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    service: "naynaknots-api",
    database: "mongodb",
    time: new Date().toISOString()
  });
});

app.get("/api/store-config", (_, res) => {
  res.json({
    instagram: "naynaknots",
    whatsapp: "916352198619",
    storeName: "Naynaknots",
    supportEmail: "meetpatelr1801@gmail.com"
  });
});

app.get("/api/products", async (_, res) => {
  try {
    const list = await products()
      .find({})
      .sort({ id: 1 })
      .toArray();

    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to load products."
    });
  }
});

app.post(
  "/api/register",
  rateLimit(10, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const name = String(
        req.body?.name || ""
      ).trim();

      const email = String(
        req.body?.email || ""
      ).trim().toLowerCase();

      const password = String(
        req.body?.password || ""
      );

      if (name.length < 2 || name.length > 60) {
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

      if (password.length < 8) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters."
        });
      }

      if (await users().findOne({ email })) {
        return res.status(409).json({
          message:
            "An account with this email already exists."
        });
      }

      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        ...hashPassword(password),
        role: "customer",
        createdAt: new Date().toISOString()
      };

      await users().insertOne(user);

      res.json({
        user: sanitizeUser(user),
        token: signToken(user)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Registration failed."
      });
    }
  }
);

app.post(
  "/api/login",
  rateLimit(10, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const email = String(
        req.body?.email || ""
      ).trim().toLowerCase();

      const password = String(
        req.body?.password || ""
      );

      const user = await users().findOne({
        email
      });

      if (
        !user ||
        !passwordMatches(password, user)
      ) {
        return res.status(401).json({
          message:
            "Incorrect email or password."
        });
      }

      res.json({
        user: sanitizeUser(user),
        token: signToken(user)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Login failed."
      });
    }
  }
);

app.get("/api/me", requireUser, (req, res) => {
  res.json({
    user: sanitizeUser(req.user)
  });
});

app.patch(
  "/api/my/profile",
  requireUser,
  async (req, res) => {
    try {
      const name = String(
        req.body?.name || ""
      ).trim();

      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({
          message:
            "Name must be between 2 and 60 characters."
        });
      }

      await users().updateOne(
        { id: req.user.id },
        { $set: { name } }
      );

      const updated = await users().findOne({
        id: req.user.id
      });

      res.json({
        user: sanitizeUser(updated)
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

app.get(
  "/api/my/wishlist",
  requireUser,
  async (req, res) => {
    try {
      const wishlist =
        await wishlists().findOne({
          userId: req.user.id
        });

      res.json(
        wishlist?.productIds || []
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
      const id = Number(
        req.params.productId
      );

      if (
        !(await products().findOne({ id }))
      ) {
        return res.status(404).json({
          message: "Product not found."
        });
      }

      await wishlists().updateOne(
        { userId: req.user.id },
        {
          $addToSet: {
            productIds: id
          }
        },
        { upsert: true }
      );

      const wishlist =
        await wishlists().findOne({
          userId: req.user.id
        });

      res.json({
        productIds:
          wishlist?.productIds || []
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
      const id = Number(
        req.params.productId
      );

      await wishlists().updateOne(
        { userId: req.user.id },
        {
          $pull: {
            productIds: id
          }
        }
      );

      const wishlist =
        await wishlists().findOne({
          userId: req.user.id
        });

      res.json({
        productIds:
          wishlist?.productIds || []
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
      const list = await orders()
        .find({
          userId: req.user.id
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
      const list = await customOrders()
        .find({
          userId: req.user.id
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

      for (const item of items) {
        const productId =
          Number(item.id);

        const quantity =
          Math.floor(
            Number(item.qty)
          );

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
          id: product.id,
          name: product.name,
          price: Number(
            product.price
          ),
          qty: quantity
        });
      }

      // Reduce stock in MongoDB.
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
                stock: -item.qty
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
        id: makeId("ORD"),

        createdAt:
          new Date().toISOString(),

        status: "Placed",

        userId:
          req.user.id,

        email:
          req.user.email,

        customer: {
          name: String(
            customer.name
          )
            .trim()
            .slice(0, 80),

          phone: String(
            customer.phone
          )
            .trim()
            .slice(0, 30),

          city: String(
            customer.city
          )
            .trim()
            .slice(0, 80),

          address: String(
            customer.address
          )
            .trim()
            .slice(0, 250),

          note: String(
            customer.note || ""
          )
            .trim()
            .slice(0, 300)
        },

        items: safeItems,

        total
      };

      await orders().insertOne(
        order
      );

      res.status(201).json({
        order
      });
    } catch (error) {
      console.error(error);

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
        id: makeId("CUS"),

        createdAt:
          new Date().toISOString(),

        status:
          "Submitted",

        userId:
          req.user.id,

        email:
          req.user.email,

        type: String(
          req.body?.type || ""
        ).slice(0, 60),

        color: String(
          req.body?.color || ""
        ).slice(0, 60),

        size: String(
          req.body?.size || ""
        ).slice(0, 60),

        occasion: String(
          req.body?.occasion || ""
        ).slice(0, 80),

        idea: String(
          req.body?.idea || ""
        ).slice(0, 800),

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
      console.error(error);

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
      const message = {
        id: makeId("MSG"),

        name: String(
          req.body?.name || ""
        ).slice(0, 80),

        email: String(
          req.body?.email || ""
        ).slice(0, 120),

        message: String(
          req.body?.message || ""
        ).slice(0, 1500),

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
      console.error(error);

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
        users: allUsers,
        products: allProducts,
        orders: allOrders,
        customOrders:
          allCustomOrders,
        messages:
          allMessages,
        wishlists:
          allWishlists
      });
    } catch (error) {
      console.error(error);

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

      const status = String(
        req.body?.status || ""
      );

      if (!allowed.includes(status)) {
        return res.status(400).json({
          message:
            "Invalid order status."
        });
      }

      const result =
        await orders().findOneAndUpdate(
          {
            id: req.params.id
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
        order: result
      });
    } catch (error) {
      console.error(error);

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

      const status = String(
        req.body?.status || ""
      );

      if (!allowed.includes(status)) {
        return res.status(400).json({
          message:
            "Invalid custom order status."
        });
      }

      const result =
        await customOrders()
          .findOneAndUpdate(
            {
              id: req.params.id
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
        order: result
      });
    } catch (error) {
      console.error(error);

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
      const role = String(
        req.body?.role || ""
      );

      if (
        !["customer", "admin"].includes(role)
      ) {
        return res.status(400).json({
          message: "Invalid role."
        });
      }

      if (
        req.params.id === req.admin.id &&
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
            id: req.params.id
          },
          {
            $set: {
              role
            }
          },
          {
            returnDocument: "after"
          }
        );

      if (!result) {
        return res.status(404).json({
          message: "User not found."
        });
      }

      res.json({
        user: sanitizeUser(result)
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to update user role."
      });
    }
  }
);

// --------------------------------------------------
// ADMIN - IMAGE UPLOAD
// --------------------------------------------------

app.post(
  "/api/admin/upload-image",
  requireAdmin,
  async (req, res) => {
    try {
      const { dataUrl } = req.body || {};

      if (
        typeof dataUrl !== "string" ||
        !dataUrl.startsWith("data:image/")
      ) {
        return res.status(400).json({
          message:
            "Please select a valid image."
        });
      }

      const match = dataUrl.match(
        /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/
      );

      if (!match) {
        return res.status(400).json({
          message:
            "Only PNG, JPG or WebP images are supported."
        });
      }

      const extension =
        match[1] === "jpeg" ||
        match[1] === "jpg"
          ? "jpg"
          : match[1];

      const buffer = Buffer.from(
        match[2],
        "base64"
      );

      if (
        buffer.length >
        5 * 1024 * 1024
      ) {
        return res.status(400).json({
          message:
            "Image must be smaller than 5 MB."
        });
      }

      const filename =
        `product-${Date.now()}-${crypto.randomUUID()}.${extension}`;

      fs.writeFileSync(
        path.join(
          uploadsDir,
          filename
        ),
        buffer
      );

      res.status(201).json({
        url:
          `/uploads/${filename}`
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to upload image."
      });
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
      const {
        name,
        price,
        category,
        image,
        description,
        stock,
        rating
      } = req.body || {};

      // Clean input
      const productName =
        String(name || "").trim();

      const productCategory =
        String(category || "").trim();

      const productImage =
        String(image || "").trim();

      const productDescription =
        String(description || "").trim();

      const productPrice =
        Number(price);

      const productStock =
        Math.max(
          0,
          Math.floor(Number(stock) || 0)
        );

      const productRating =
        Math.min(
          5,
          Math.max(
            0,
            Number(rating) || 5
          )
        );

      // Validate required fields
      if (
        !productName ||
        !productCategory ||
        !productImage ||
        !productDescription ||
        !Number.isFinite(productPrice) ||
        productPrice < 0
      ) {
        return res.status(400).json({
          message:
            "Name, price, category, image and description are required."
        });
      }

      // Find highest existing product ID
      const lastProduct =
        await products()
          .find({})
          .sort({ id: -1 })
          .limit(1)
          .next();

      const nextId =
        lastProduct &&
        Number.isFinite(
          Number(lastProduct.id)
        )
          ? Number(lastProduct.id) + 1
          : 1;

      // Create product
      const product = {
        id: nextId,

        name: productName,

        price: productPrice,

        category: productCategory,

        image: productImage,

        description: productDescription,

        stock: productStock,

        rating: productRating,

        createdAt:
          new Date().toISOString()
      };

      // Save ONLY the new product
      await products().insertOne(product);

      console.log(
        `✅ Product added: ${product.name} (ID: ${product.id})`
      );

      res.status(201).json({
        product
      });

    } catch (error) {
      console.error(
        "❌ ADD PRODUCT ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to add product."
      });
    }
  }
);

// --------------------------------------------------
// ADMIN - EDIT PRODUCT
// --------------------------------------------------

app.put(
  "/api/admin/products/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

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

      const updated = {
        name: String(
          req.body?.name ??
            existing.name
        ).trim(),

        price: Number(
          req.body?.price ??
            existing.price
        ),

        category: String(
          req.body?.category ??
            existing.category
        ).trim(),

        image: String(
          req.body?.image ??
            existing.image
        ).trim(),

        description: String(
          req.body?.description ??
            existing.description
        ).trim(),

        stock: Math.max(
          0,
          Math.floor(
            Number(
              req.body?.stock ??
                existing.stock
            )
          )
        ),

        rating: Math.min(
          5,
          Math.max(
            0,
            Number(
              req.body?.rating ??
                existing.rating
            )
          )
        )
      };

      if (
        !updated.name ||
        !updated.category ||
        !updated.image ||
        !updated.description ||
        !Number.isFinite(
          updated.price
        ) ||
        updated.price < 0
      ) {
        return res.status(400).json({
          message:
            "Invalid product details."
        });
      }

      await products().updateOne(
        {
          id
        },
        {
          $set: updated
        }
      );

      const product =
        await products().findOne({
          id
        });

      res.json({
        product
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
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
        Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          message: "Invalid product ID."
        });
      }

      const result =
        await products().deleteOne({
          id
        });

      if (!result.deletedCount) {
        return res.status(404).json({
          message:
            "Product not found."
        });
      }

      // Remove deleted product from wishlists
      await wishlists().updateMany(
        {},
        {
          $pull: {
            productIds: id
          }
        }
      );

      console.log(
        `🗑️ Product deleted: ${id}`
      );

      res.json({
        ok: true,
        deletedId: id
      });

    } catch (error) {
      console.error(
        "❌ DELETE PRODUCT ERROR:",
        error
      );

      res.status(500).json({
        message:
          "Unable to delete product."
      });
    }
  }
);

// --------------------------------------------------
// MONGODB INITIALIZATION
// --------------------------------------------------

async function ensureDatabase() {
  console.log(
    "Connecting to MongoDB Atlas..."
  );

  await client.connect();

  db = client.db(
    MONGODB_DB
  );

  console.log(
    `✅ MongoDB connected: ${MONGODB_DB}`
  );

  const requiredCollections = [
    "users",
    "products",
    "orders",
    "wishlists",
    "custom_orders",
    "messages"
  ];

  const existingCollections =
    new Set(
      (
        await db
          .listCollections(
            {},
            {
              nameOnly: true
            }
          )
          .toArray()
      ).map(
        collection =>
          collection.name
      )
    );

  // Create missing collections
  for (
    const collectionName of
      requiredCollections
  ) {
    if (
      !existingCollections.has(
        collectionName
      )
    ) {
      await db.createCollection(
        collectionName
      );

      console.log(
        `✅ Created collection: ${collectionName}`
      );
    }
  }

  // Create indexes
  await Promise.allSettled([
    users().createIndex(
      { id: 1 },
      { unique: true }
    ),

    users().createIndex(
      { email: 1 },
      { unique: true }
    ),

    products().createIndex(
      { id: 1 },
      { unique: true }
    ),

    orders().createIndex(
      { id: 1 },
      { unique: true }
    ),

    customOrders().createIndex(
      { id: 1 },
      { unique: true }
    ),

    wishlists().createIndex(
      { userId: 1 },
      { unique: true }
    )
  ]);

  console.log(
    "✅ MongoDB indexes ready."
  );
}

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
// CLEAN SHUTDOWN
// --------------------------------------------------

process.on(
  "SIGINT",
  async () => {
    try {
      await client.close();
    } finally {
      process.exit(0);
    }
  }
);

process.on(
  "SIGTERM",
  async () => {
    try {
      await client.close();
    } finally {
      process.exit(0);
    }
  }
);

start();