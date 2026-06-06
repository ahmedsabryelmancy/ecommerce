// GET /api/products?category=&search=&featured=&page=1&limit=20
// Mirrors server/src/routes/products.ts so the client gets { success, products, total, page, pages }.
import { getProductsCollection } from "../_db.js";

export default async function handler(req, res) {
  try {
    const { category, search, featured, page = "1", limit = "20" } = req.query || {};

    const filter = {};

    if (category && category !== "all") {
      filter.catetory = {
        $in: String(category)
          .split(",")
          .map((c) => c.trim().toLowerCase()),
      };
    }

    if (featured === "true") {
      filter.featured = true;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { catetory: { $regex: term, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const col = await getProductsCollection();
    const [products, total] = await Promise.all([
      col.find(filter).skip(skip).limit(limitNum).toArray(),
      col.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      products,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
}
