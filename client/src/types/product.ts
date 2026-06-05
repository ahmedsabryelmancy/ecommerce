export type Product = {
  id: number;
  _id?: string;       // backend MongoDB ObjectId
  img: string;
  image?: string;     // backend field name
  name: string;
  price: number;
  old_price?: number;
  catetory: string;
  category?: string;  // backend field name
  rating?: number;
  numReviews?: number;
};