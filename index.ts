import express from "express";
import cors from "cors";
import productsRouter from "./src/routes/products.js";
import ordersRouter from "./src/routes/orders.js";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
