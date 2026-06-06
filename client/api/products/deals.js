// GET /api/products/deals — on-sale products (those with an old_price).
import { getProductsCollection } from "../_db.js";

export default async function handler(_req, res) {
  try {
    const col = await getProductsCollection();
    const products = await col
      .find({ old_price: { $exists: true, $ne: null } })
      .limit(20)
      .toArray();
    res.status(200).json({ success: true, products });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
}
