import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Middleware for internal APIs (check 'X-Internal-Key' header)
const internalOnly = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized internal access" });
  }
  next();
};

// External: GET /products (list all)
router.get("/", async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// External: GET /products/:id
router.get("/:id", async (req, res) => {
  try {
    const idParam = req.params.id;

    // Validate if `id` is a valid integer string
    if (!/^\d+$/.test(idParam)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const id = parseInt(idParam, 10);

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    console.log("Product fetched successfully");
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// External: POST /products (create)
router.post("/", express.json(), async (req, res) => {
  try {
    const { name, description, sku, price, stockQty, status } = req.body;
    const product = await prisma.product.create({
      data: {
        name,
        description,
        sku,
        price: parseFloat(price),
        stockQty: parseInt(stockQty),
        status,
      },
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

// External: PUT /products/:id
router.put("/:id", internalOnly, express.json(), async (req, res) => {
  const { name, description, sku, price, stockQty, status } = req.body;
  try {
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id as string, 10) },
      data: {
        name,
        description,
        sku,
        price: parseFloat(price),
        stockQty: parseInt(stockQty),
        status,
      },
    });
    res.json(product);
  } catch {
    res.status(404).json({ error: "Product not found" });
  }
});

// External: DELETE /products/:id (internal only)
router.delete("/:id", internalOnly, async (req, res) => {
  try {
    await prisma.product.delete({
      where: { id: parseInt(req.params.id as string, 10) },
    });
    res.status(200).json({
      message: "Product deleted successfully",
      productId: parseInt(req.params.id as string, 10),
    });
  } catch {
    res.status(404).json({ error: "Product not found" });
  }
});

export default router;
