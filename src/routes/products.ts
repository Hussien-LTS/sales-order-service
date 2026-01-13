import express, { Request, Response, Router } from "express";
import prisma from "../lib/prisma.js";
import {
  getPaginationParams,
  getPagingData,
  PaginationResponse,
} from "../utils/pagination.js";
import multer from "multer";
import { uploadImage } from "../utils/upload";

const router: Router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
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
interface PaginatedProductsResponse extends PaginationResponse<any> {}

// External: GET /products (paginated)

router.get("/", async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page as string | string[] | undefined,
      req.query.limit as string | string[] | undefined
    );

    // Get total count
    const total = await prisma.product.count();

    // Get paginated products
    const products = await prisma.product.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    const response: PaginatedProductsResponse = getPagingData(
      { count: total, rows: products },
      page,
      limit
    );

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
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
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch product" });
  }
});

// External: POST /products (create)
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const imageUrl = req.file
      ? await uploadImage(req.file.buffer, "products")
      : null;
    const { name, description, sku, price, stockQty, status } = req.body;
    const product = await prisma.product.create({
      data: {
        name,
        imageUrl,
        description,
        sku,
        price: parseFloat(price),
        stockQty: parseInt(stockQty),
        status,
      },
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create product",
      message: error,
    });
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
    res.json({ success: true, data: product });
  } catch {
    res.status(404).json({ success: false, error: "Product not found" });
  }
});

// External: DELETE /products/:id (internal only)
router.delete("/:id", internalOnly, async (req, res) => {
  try {
    await prisma.product.delete({
      where: { id: parseInt(req.params.id as string, 10) },
    });
    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      productId: parseInt(req.params.id as string, 10),
    });
  } catch {
    res.status(404).json({ success: false, error: "Product not found" });
  }
});

export default router;
