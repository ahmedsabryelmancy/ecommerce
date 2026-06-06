// GET /api/products/:id — single product by its numeric id field.
import { getProductsCollection } from "../_db.js";

export default async function handler(req, res) {
  try {
    const id = parseInt(req.query.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid product id." });
      return;
    }
    const col = await getProductsCollection();
    const product = await col.findOne({ id });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }
    res.status(200).json({ success: true, product });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
}
