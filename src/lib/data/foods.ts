import type { FoodItem } from '@/lib/types';

/**
 * India-first food reference database. Values are per stated portion.
 * `verified` entries follow standard reference values (IFCT/USDA-style);
 * `estimate` entries (restaurant / home-style preparations) vary widely and
 * are always labelled as estimates in the UI.
 */
export const FOODS: FoodItem[] = [
  // Breakfast
  { id: 'idli', name: 'Idli', category: 'Breakfast', portionLabel: '1 piece (40 g)', calories: 39, protein: 2, carbs: 8.3, fat: 0.1, source: 'reference' },
  { id: 'plain-dosa', name: 'Plain Dosa', category: 'Breakfast', portionLabel: '1 dosa (80 g)', calories: 133, protein: 3, carbs: 25, fat: 2.5, source: 'reference' },
  { id: 'masala-dosa', name: 'Masala Dosa', category: 'Breakfast', portionLabel: '1 dosa (150 g)', calories: 250, protein: 5, carbs: 35, fat: 10, source: 'estimate' },
  { id: 'poha', name: 'Poha', category: 'Breakfast', portionLabel: '1 katori (150 g)', calories: 180, protein: 3, carbs: 35, fat: 4, source: 'reference' },
  { id: 'upma', name: 'Upma', category: 'Breakfast', portionLabel: '1 katori (150 g)', calories: 190, protein: 4, carbs: 30, fat: 6, source: 'reference' },
  { id: 'aloo-paratha', name: 'Aloo Paratha', category: 'Breakfast', portionLabel: '1 piece (120 g)', calories: 210, protein: 5, carbs: 32, fat: 7, source: 'estimate' },

  // Breads & grains
  { id: 'roti', name: 'Whole Wheat Roti', category: 'Breads & Grains', portionLabel: '1 roti (30 g)', calories: 71, protein: 3, carbs: 15, fat: 0.4, source: 'reference' },
  { id: 'rice', name: 'Cooked Rice', category: 'Breads & Grains', portionLabel: '1 katori (150 g)', calories: 195, protein: 4, carbs: 42, fat: 0.5, source: 'reference' },
  { id: 'jeera-rice', name: 'Jeera Rice', category: 'Breads & Grains', portionLabel: '1 katori (150 g)', calories: 215, protein: 4, carbs: 40, fat: 4.5, source: 'estimate' },
  { id: 'veg-biryani', name: 'Veg Biryani', category: 'Breads & Grains', portionLabel: '1 plate (250 g)', calories: 400, protein: 8, carbs: 65, fat: 12, source: 'estimate' },
  { id: 'chicken-biryani', name: 'Chicken Biryani', category: 'Breads & Grains', portionLabel: '1 plate (300 g)', calories: 480, protein: 22, carbs: 62, fat: 15, source: 'estimate' },

  // Dals & legumes
  { id: 'dal-tadka', name: 'Dal Tadka', category: 'Dals & Legumes', portionLabel: '1 katori (150 g)', calories: 150, protein: 7, carbs: 18, fat: 6, source: 'reference' },
  { id: 'chole', name: 'Chole (Chana Masala)', category: 'Dals & Legumes', portionLabel: '1 katori (150 g)', calories: 210, protein: 9, carbs: 30, fat: 6, source: 'reference' },
  { id: 'rajma', name: 'Rajma', category: 'Dals & Legumes', portionLabel: '1 katori (150 g)', calories: 160, protein: 8, carbs: 24, fat: 3, source: 'reference' },
  { id: 'sambar', name: 'Sambar', category: 'Dals & Legumes', portionLabel: '1 katori (150 g)', calories: 90, protein: 4, carbs: 12, fat: 3, source: 'reference' },

  // Protein
  { id: 'paneer-bhurji', name: 'Paneer Bhurji', category: 'Protein', portionLabel: '1 katori (120 g)', calories: 220, protein: 14, carbs: 6, fat: 16, source: 'estimate' },
  { id: 'chicken-curry', name: 'Chicken Curry (home-style)', category: 'Protein', portionLabel: '1 katori (150 g)', calories: 230, protein: 20, carbs: 6, fat: 14, source: 'estimate' },
  { id: 'boiled-egg', name: 'Boiled Egg', category: 'Protein', portionLabel: '1 large egg (50 g)', calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, source: 'reference' },
  { id: 'grilled-chicken', name: 'Grilled Chicken Breast', category: 'Protein', portionLabel: '100 g', calories: 165, protein: 31, carbs: 0, fat: 3.6, source: 'reference' },
  { id: 'paneer-raw', name: 'Paneer (raw)', category: 'Protein', portionLabel: '50 g', calories: 132, protein: 11, carbs: 2, fat: 9, source: 'reference' },

  // Dairy
  { id: 'curd', name: 'Curd / Dahi', category: 'Dairy', portionLabel: '1 katori (150 g)', calories: 90, protein: 5, carbs: 6, fat: 4, source: 'reference' },
  { id: 'milk', name: 'Milk (toned)', category: 'Dairy', portionLabel: '1 glass (200 ml)', calories: 100, protein: 6.6, carbs: 9.6, fat: 4, source: 'reference' },
  { id: 'buttermilk', name: 'Buttermilk / Chaas', category: 'Dairy', portionLabel: '1 glass (200 ml)', calories: 40, protein: 3, carbs: 5, fat: 1.5, source: 'reference' },

  // Fruits & nuts
  { id: 'banana', name: 'Banana', category: 'Fruits & Nuts', portionLabel: '1 medium (120 g)', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, source: 'reference' },
  { id: 'apple', name: 'Apple', category: 'Fruits & Nuts', portionLabel: '1 medium (180 g)', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, source: 'reference' },
  { id: 'papaya', name: 'Papaya', category: 'Fruits & Nuts', portionLabel: '1 cup (140 g)', calories: 62, protein: 0.7, carbs: 16, fat: 0.2, source: 'reference' },
  { id: 'almonds', name: 'Almonds', category: 'Fruits & Nuts', portionLabel: '10 pieces (12 g)', calories: 70, protein: 2.5, carbs: 2.5, fat: 6, source: 'reference' },

  // Snacks & beverages
  { id: 'samosa', name: 'Samosa', category: 'Snacks & Beverages', portionLabel: '1 piece (100 g)', calories: 260, protein: 4, carbs: 29, fat: 14, source: 'estimate' },
  { id: 'roasted-chana', name: 'Roasted Chana', category: 'Snacks & Beverages', portionLabel: '30 g handful', calories: 110, protein: 6, carbs: 18, fat: 1.5, source: 'reference' },
  { id: 'chai', name: 'Chai (milk + sugar)', category: 'Snacks & Beverages', portionLabel: '1 cup (150 ml)', calories: 80, protein: 2, carbs: 12, fat: 2.5, source: 'estimate' },
  { id: 'black-coffee', name: 'Black Coffee', category: 'Snacks & Beverages', portionLabel: '1 cup (200 ml)', calories: 2, protein: 0, carbs: 0, fat: 0, source: 'reference' },
  { id: 'coconut-water', name: 'Coconut Water', category: 'Snacks & Beverages', portionLabel: '1 glass (250 ml)', calories: 45, protein: 0.5, carbs: 9, fat: 0, source: 'reference' },
];

export const FOOD_CATEGORIES = [...new Set(FOODS.map((f) => f.category))];
