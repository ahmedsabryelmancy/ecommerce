export type Product = {
  id: number;
  img: string;
  name: string;
  price: number;
  old_price?: number;
  catetory: string;  // intentional typo — matches DB schema, do not fix
  rating?: number;
  numReviews?: number;
};