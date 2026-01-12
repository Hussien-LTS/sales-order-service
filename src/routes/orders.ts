import express from "express";
import prisma from "../lib/prisma.js";
import axios from "axios";

const router = express.Router();
const THIRD_PARTY_URL = "https://third-party-api.com/salesOrder";
const AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"; // Use env in production

router.post("/", express.json(), async (req, res) => {
  try {
    const { customerName, email, mobileNumber, status, orderDate, orderItems } =
      req.body;

    // Validate stock availability FIRST
    for (const item of orderItems) {
      const product = await prisma.product.findUnique({
        where: { id: parseInt(item.productId) },
      });
      if (!product || product.stockQty < parseInt(item.quantity)) {
        return res.status(400).json({
          error: `Insufficient stock for product ID ${item.productId}`,
          available: product?.stockQty || 0,
          requested: item.quantity,
        });
      }
    }

    const totalAmount = orderItems.reduce(
      (sum: number, item: any) => sum + item.quantity * parseFloat(item.price),
      0
    );

    // ATOMIC TRANSACTION: Create order + decrease stock together
    const order = await prisma.$transaction(async (tx) => {
      // 1. Create order with items
      const order = await tx.salesOrder.create({
        data: {
          customerName,
          email,
          mobileNumber,
          status,
          orderDate: new Date(orderDate),
          totalAmount,
          orderNumber: `SO-${Date.now()}`,
          orderItems: {
            create: orderItems.map((item: any) => ({
              productId: parseInt(item.productId),
              quantity: parseInt(item.quantity),
              price: parseFloat(item.price),
            })),
          },
        },
        include: { orderItems: { include: { product: true } } },
      });

      // 2. Decrease stock immediately
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: parseInt(item.productId) },
          data: {
            stockQty: {
              decrement: parseInt(item.quantity),
            },
          },
        });
      }

      return order;
    });

    // 3. Push to third-party API (fire-and-forget)
    pushToThirdParty(order).catch(console.error);

    res.status(201).json({
      message: "Order created successfully",
      order,
      stockUpdated: true,
    });
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Separate function for third-party push
async function pushToThirdParty(order: any) {
  const payload = {
    salesOrder: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      email: order.email,
      mobileNumber: order.mobileNumber,
      status: order.status,
      orderDate: order.orderDate,
      totalAmount: order.totalAmount,
    },
    products: order.orderItems.map((oi: any) => ({
      productId: oi.productId,
      productName: oi.product.name,
      quantity: oi.quantity,
      price: oi.price,
    })),
  };

  await axios.post(THIRD_PARTY_URL, payload, {
    headers: {
      Authorization: AUTH_TOKEN,
      "Content-Type": "application/json",
    },
  });
}

// GET /orders with filters
router.get("/", async (req, res) => {
  try {
    const { name, email, mobileNumber, status, orderDateFrom, orderDateTo } =
      req.query;
    const where: any = {};

    if (name)
      where.customerName = { contains: name as string, mode: "insensitive" };
    if (email) where.email = { contains: email as string, mode: "insensitive" };
    if (mobileNumber) where.mobileNumber = { contains: mobileNumber as string };
    if (status) where.status = status as string;
    if (orderDateFrom || orderDateTo) {
      where.orderDate = {};
      if (orderDateFrom)
        where.orderDate.gte = new Date(orderDateFrom as string);
      if (orderDateTo) where.orderDate.lte = new Date(orderDateTo as string);
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      include: { orderItems: { include: { product: true } } },
    });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /orders/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: { orderItems: { include: { product: true } } },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json(order);
  } catch (error) {
    console.error("Failed to fetch order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// PUT /orders/:id
router.put("/:id", express.json(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const { customerName, email, mobileNumber, status, orderDate, orderItems } =
      req.body;

    const updatedOrder = await prisma.salesOrder.update({
      where: { id },
      data: {
        customerName,
        email,
        mobileNumber,
        status,
        orderDate: new Date(orderDate),
        orderItems: {
          deleteMany: {}, // Clear existing items
          create: orderItems.map((item: any) => ({
            productId: parseInt(item.productId),
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
          })),
        },
      },
      include: { orderItems: { include: { product: true } } },
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("Failed to update order:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

router.patch("/:id/status", express.json(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const { status } = req.body;
    const validStatuses = [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ error: "Invalid status", allowed: validStatuses });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: { orderItems: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // BLOCK 1: DELIVERED = FINAL STATE
    if (order.status === "delivered") {
      return res.status(400).json({
        error: "Delivered orders cannot be modified",
        currentStatus: "delivered",
        message: "Order is complete and cannot change status",
      });
    }

    // BLOCK 2: Linear flow validation
    const statusOrder = {
      pending: 0,
      confirmed: 1,
      shipped: 2,
      delivered: 3,
      cancelled: 99,
    };

    const currentStatusNum =
      statusOrder[order.status as keyof typeof statusOrder];
    const newStatusNum = statusOrder[status as keyof typeof statusOrder];

    if (
      newStatusNum < currentStatusNum ||
      (order.status === "cancelled" && status !== "cancelled")
    ) {
      return res.status(400).json({
        error: "Invalid status transition",
        current: order.status,
        requested: status,
        allowed: getAllowedNextStatuses(order.status),
      });
    }

    // Continue with transaction...
    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({ where: { id }, data: { status } });

      // Stock adjustments (only for relevant transitions)
      if (status === "cancelled" && order.status !== "cancelled") {
        for (const item of order.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      } else if (status === "confirmed" && order.status === "pending") {
        for (const item of order.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.quantity } },
          });
        }
      }
    });

    res.status(200).json({
      message: `Status updated to "${status}" successfully`,
      order: await prisma.salesOrder.findUnique({
        where: { id },
        include: { orderItems: { include: { product: true } } },
      }),
    });
  } catch (error) {
    console.error("Status update failed:", error);
    res.status(500).json({ error: "Status update failed" });
  }
});

function getAllowedNextStatuses(current: string): string[] {
  const transitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipped", "cancelled"],
    shipped: ["delivered", "cancelled"],
    delivered: [], // NOTHING ALLOWED
    cancelled: [], // NOTHING ALLOWED
  };
  return transitions[current] || [];
}

export default router;
