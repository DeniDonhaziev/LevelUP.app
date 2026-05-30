export type BodyGoal = 'lose' | 'gain' | 'maintain';

export type FoodAnalysisResult = {
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  foods_ru: string;
  advice_ru: string;
};

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
