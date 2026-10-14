export const BUSINESS_TYPES = [
  {
    key: 'kirana', label: 'Kirana & Grocery', icon: '🛒', tagline: 'Daily needs, grains, packaged foods',
    categories: ['Grains & Rice', 'Atta & Flour', 'Oil & Ghee', 'Masala & Spices', 'Snacks & Namkeen', 'Beverages', 'Dairy & Bakery', 'Packaged Foods', 'Household'],
  },
  {
    key: 'clothing', label: 'Clothing & Fashion', icon: '👗', tagline: 'Men, women & kids wear',
    categories: ['Men', 'Women', 'Kids', 'Sarees', 'Kurtas', 'Jeans & Trousers', 'Shirts & Tops', 'Footwear', 'Accessories'],
  },
  {
    key: 'restaurant', label: 'Restaurant, Cafe & Bakery', icon: '🍽️', tagline: 'Food, drinks & desserts',
    categories: ['Starters', 'Main Course', 'Breads', 'Rice & Biryani', 'Snacks', 'Beverages', 'Desserts', 'Bakery', 'Combos'],
  },
  {
    key: 'electronics', label: 'Electronics & Mobile', icon: '📱', tagline: 'Mobiles, accessories & gadgets',
    categories: ['Mobiles', 'Chargers & Cables', 'Earphones & Headphones', 'Power Banks', 'Covers & Cases', 'Appliances', 'Accessories', 'Spare Parts'],
  },
  {
    key: 'medical', label: 'Medical & Pharmacy', icon: '💊', tagline: 'Medicines & wellness',
    categories: ['Tablets & Capsules', 'Syrups', 'Injections', 'Ointments', 'Baby Care', 'Personal Care', 'Wellness', 'Equipment'],
  },
  {
    key: 'hardware', label: 'Hardware & Electrical', icon: '🔧', tagline: 'Tools, fittings & wires',
    categories: ['Tools', 'Paints', 'Plumbing', 'Electrical', 'Wires & Cables', 'Switches', 'Fasteners', 'Safety'],
  },
  {
    key: 'salon', label: 'Salon & Spa', icon: '💈', tagline: 'Beauty & grooming',
    categories: ['Hair', 'Facial', 'Beauty', 'Bridal', 'Nails', 'Products', 'Packages'],
  },
  {
    key: 'general', label: 'General Retail', icon: '🏬', tagline: 'Any product business',
    categories: ['General', 'Best Sellers', 'New Arrivals', 'Offers'],
  },
];

export function getBusinessType(key) {
  return BUSINESS_TYPES.find((b) => b.key === key) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}
